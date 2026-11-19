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

type Source = ImageBitmap | VideoFrame | ImageData;
interface Inference {
  keypoints: Float32Array;
  prepMs: number;
  modelMs: number;
}
type Infer = (source: Source, timestamp: number) => Promise<Inference>;
let infer: Infer | null = null;

const sizeOf = (s: Source) =>
  'displayWidth' in s ? { w: s.displayWidth, h: s.displayHeight } : { w: s.width, h: s.height };

const MOVENET_SIZE = 192;

async function loadMoveNet(config: Config, base: string): Promise<string> {
  if (config.backend === 'wasm') setWasmPaths(`${base}vendor/tfjs/`);
  const ok = await tf.setBackend(config.backend === 'wasm' ? 'wasm' : 'webgl');
  if (!ok) throw new Error(`TF.js-motoren «${config.backend}» er ikke tilgjengelig`);
  await tf.ready();
  const model: GraphModel = await loadGraphModel(`${base}models/movenet-lightning.json`);

  // Bildet legges inn i en kvadratisk flate med svarte kanter (letterbox),
  // slik at proporsjonene bevares.
  const N = MOVENET_SIZE;
  const canvas = new OffscreenCanvas(N, N);
  const c2d = canvas.getContext('2d', { willReadFrequently: true })!;
  const rgb = new Int32Array(N * N * 3);

  infer = async (source) => {
    const t0 = performance.now();
    const { w: sw, h: sh } = sizeOf(source);
    const scale = Math.min(N / sw, N / sh);
    const w = Math.round(sw * scale);
    const h = Math.round(sh * scale);
    const ox = (N - w) >> 1;
    const oy = (N - h) >> 1;

    if (source instanceof ImageData) {
      // Piksler: nedskalering med nærmeste nabo, rett i minnet.
      const src = source.data;
      rgb.fill(0);
      for (let y = 0; y < h; y++) {
        const sy = Math.min(sh - 1, (y / scale) | 0);
        let j = ((y + oy) * N + ox) * 3;
        for (let x = 0; x < w; x++) {
          const i = (sy * sw + Math.min(sw - 1, (x / scale) | 0)) * 4;
          rgb[j++] = src[i];
          rgb[j++] = src[i + 1];
          rgb[j++] = src[i + 2];
        }
      }
    } else {
      c2d.fillStyle = '#000';
      c2d.fillRect(0, 0, N, N);
      c2d.drawImage(source, ox, oy, w, h);
      const rgba = c2d.getImageData(0, 0, N, N).data;
      for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
        rgb[j] = rgba[i];
        rgb[j + 1] = rgba[i + 1];
        rgb[j + 2] = rgba[i + 2];
      }
    }
    const t1 = performance.now();

    const input = tf.tensor4d(rgb, [1, N, N, 3], 'int32');
    const output = model.execute(input) as tf.Tensor;
    const raw = (await output.data()) as Float32Array; // [y, x, score] * 17
    input.dispose();
    output.dispose();
    const keypoints = new Float32Array(17 * 3);
    for (let k = 0; k < 17; k++) {
      keypoints[k * 3] = (raw[k * 3 + 1] * N - ox) / w;
      keypoints[k * 3 + 1] = (raw[k * 3] * N - oy) / h;
      keypoints[k * 3 + 2] = raw[k * 3 + 2];
    }
    return { keypoints, prepMs: t1 - t0, modelMs: performance.now() - t1 };
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
  // MediaPipe klargjør bildet selv, så all tid regnes som modelltid.
  infer = async (source, timestamp) => {
    const t0 = performance.now();
    const res = landmarker.detectForVideo(source, timestamp);
    const lm = res.landmarks[0];
    const keypoints = new Float32Array(lm ? lm.length * 3 : 0);
    if (lm) {
      for (let k = 0; k < lm.length; k++) {
        keypoints[k * 3] = lm[k].x;
        keypoints[k * 3 + 1] = lm[k].y;
        keypoints[k * 3 + 2] = lm[k].visibility ?? 0;
      }
    }
    return { keypoints, prepMs: 0, modelMs: performance.now() - t0 };
  };
  return `MediaPipe Tasks Vision, delegat ${config.backend}`;
}

// Kamerastrøm: arbeideren leser bildene selv og beholder bare det nyeste.
let latest: VideoFrame | null = null;
let wake: (() => void) | null = null;

async function pump(readable: ReadableStream<VideoFrame>) {
  const reader = readable.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    latest?.close();
    latest = value;
    wake?.();
    wake = null;
  }
}

async function takeLatest(): Promise<VideoFrame> {
  if (!latest) await new Promise<void>((r) => (wake = r));
  const frame = latest!;
  latest = null;
  return frame;
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
    } else if (msg.type === 'stream') {
      void pump(msg.readable);
    } else if (msg.type === 'frame') {
      if (!infer) throw new Error('Modellen er ikke lastet');
      const t0 = performance.now();
      const source: Source = msg.bitmap
        ? msg.bitmap
        : msg.pixels
          ? new ImageData(new Uint8ClampedArray(msg.pixels.data), msg.pixels.width, msg.pixels.height)
          : await takeLatest();
      const t1 = performance.now();
      const r = await infer(source, t1);
      // Bildet kastes her. Bare punktene sendes tilbake.
      if (!(source instanceof ImageData)) source.close();
      post(
        {
          type: 'result',
          id: msg.id,
          waitMs: t1 - t0,
          prepMs: r.prepMs,
          modelMs: r.modelMs,
          doneAt: performance.timeOrigin + performance.now(),
          keypoints: r.keypoints,
        },
        [r.keypoints.buffer],
      );
    }
  } catch (e) {
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
};
