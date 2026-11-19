/// <reference lib="webworker" />
// Sporingsarbeideren. All bildetolkning skjer her, på egen tråd, slik at
// tegningen på hovedtråden ikke hakker. Bildene kastes straks de er tolket.
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';
import { loadGraphModel, type GraphModel } from '@tensorflow/tfjs-converter';
import { PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Config, FromWorker, ToWorker } from './types';

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (m: FromWorker, transfer: Transferable[] = []) => ctx.postMessage(m, transfer);

type Infer = (bitmap: ImageBitmap, timestamp: number) => Promise<Float32Array>;
let infer: Infer | null = null;

const MOVENET_SIZE = 192;

async function loadMoveNet(config: Config, base: string): Promise<string> {
  if (config.backend === 'wasm') setWasmPaths(`${base}vendor/tfjs/`);
  const ok = await tf.setBackend(config.backend === 'wasm' ? 'wasm' : 'webgl');
  if (!ok) throw new Error(`TF.js-motoren «${config.backend}» er ikke tilgjengelig`);
  await tf.ready();
  const model: GraphModel = await loadGraphModel(`${base}models/movenet-lightning.json`);

  // Bildet tegnes inn i en kvadratisk flate med svarte kanter (letterbox),
  // slik at proporsjonene bevares.
  const canvas = new OffscreenCanvas(MOVENET_SIZE, MOVENET_SIZE);
  const c2d = canvas.getContext('2d', { willReadFrequently: true })!;
  const rgb = new Int32Array(MOVENET_SIZE * MOVENET_SIZE * 3);

  infer = async (bitmap) => {
    const scale = Math.min(MOVENET_SIZE / bitmap.width, MOVENET_SIZE / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    const ox = (MOVENET_SIZE - w) / 2;
    const oy = (MOVENET_SIZE - h) / 2;
    c2d.fillStyle = '#000';
    c2d.fillRect(0, 0, MOVENET_SIZE, MOVENET_SIZE);
    c2d.drawImage(bitmap, ox, oy, w, h);
    const rgba = c2d.getImageData(0, 0, MOVENET_SIZE, MOVENET_SIZE).data;
    for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
      rgb[j] = rgba[i];
      rgb[j + 1] = rgba[i + 1];
      rgb[j + 2] = rgba[i + 2];
    }
    const input = tf.tensor4d(rgb, [1, MOVENET_SIZE, MOVENET_SIZE, 3], 'int32');
    const output = model.execute(input) as tf.Tensor;
    const raw = (await output.data()) as Float32Array; // [y, x, score] * 17
    input.dispose();
    output.dispose();
    const out = new Float32Array(17 * 3);
    for (let k = 0; k < 17; k++) {
      out[k * 3] = (raw[k * 3 + 1] * MOVENET_SIZE - ox) / w;
      out[k * 3 + 1] = (raw[k * 3] * MOVENET_SIZE - oy) / h;
      out[k * 3 + 2] = raw[k * 3 + 2];
    }
    return out;
  };
  return `TF.js ${tf.version_core}, motor ${tf.getBackend()}`;
}

async function loadMediaPipe(config: Config, base: string): Promise<string> {
  const landmarker = await PoseLandmarker.createFromOptions(
    {
      wasmLoaderPath: `${base}vendor/mediapipe/vision_wasm_internal.js`,
      wasmBinaryPath: `${base}vendor/mediapipe/vision_wasm_internal.wasm`,
    },
    {
      baseOptions: {
        modelAssetPath: `${base}models/pose_landmarker_lite.task`,
        delegate: config.backend === 'GPU' ? 'GPU' : 'CPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
      canvas: new OffscreenCanvas(1, 1),
    },
  );
  infer = async (bitmap, timestamp) => {
    const res = landmarker.detectForVideo(bitmap, timestamp);
    const lm = res.landmarks[0];
    if (!lm) return new Float32Array(0);
    const out = new Float32Array(lm.length * 3);
    for (let k = 0; k < lm.length; k++) {
      out[k * 3] = lm[k].x;
      out[k * 3 + 1] = lm[k].y;
      out[k * 3 + 2] = lm[k].visibility ?? 0;
    }
    return out;
  };
  return `MediaPipe Tasks Vision, delegat ${config.backend}`;
}

ctx.onmessage = async (ev: MessageEvent<ToWorker>) => {
  const msg = ev.data;
  try {
    if (msg.type === 'load') {
      const t0 = performance.now();
      const detail =
        msg.config.model === 'movenet'
          ? await loadMoveNet(msg.config, msg.base)
          : await loadMediaPipe(msg.config, msg.base);
      post({ type: 'loaded', ms: performance.now() - t0, detail });
    } else if (msg.type === 'frame') {
      if (!infer) throw new Error('Modellen er ikke lastet');
      const t0 = performance.now();
      const keypoints = await infer(msg.bitmap, t0);
      const inferMs = performance.now() - t0;
      msg.bitmap.close(); // Bildet kastes her. Bare punktene sendes tilbake.
      post({ type: 'result', id: msg.id, inferMs, keypoints }, [keypoints.buffer]);
    }
  } catch (e) {
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
};
