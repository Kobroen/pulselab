/// <reference lib="webworker" />
// Sporingsarbeideren til spillet. All bildetolkning skjer her, på egen tråd.
// Den kjører MoveNet Lightning på prosessoren (WebAssembly), som var det mest
// stabile oppsettet i målingene på Chromebook. Bildene kastes straks de er tolket.
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-wasm';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';
import { loadGraphModel, type GraphModel } from '@tensorflow/tfjs-converter';

export type TilArbeider =
  | { type: 'last'; base: string }
  | { type: 'bilde'; bitmap: ImageBitmap; punkter: Float32Array };

export type FraArbeider =
  | { type: 'klar'; ms: number }
  | { type: 'feil'; melding: string }
  // punkter: [x, y, sikkerhet] per ledd, x og y normalisert 0..1 i kamerabildet.
  | { type: 'punkter'; punkter: Float32Array; ms: number };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const send = (m: FraArbeider, overfør: Transferable[] = []) => ctx.postMessage(m, overfør);

const STØRRELSE = 192;
let modell: GraphModel | null = null;
const flate = new OffscreenCanvas(STØRRELSE, STØRRELSE);
const c2d = flate.getContext('2d', { willReadFrequently: true })!;
const rgb = new Int32Array(STØRRELSE * STØRRELSE * 3);

async function last(base: string) {
  setWasmPaths(`${base}vendor/tfjs/`);
  if (!(await tf.setBackend('wasm'))) throw new Error('WebAssembly-motoren er ikke tilgjengelig');
  await tf.ready();
  modell = await loadGraphModel(`${base}models/movenet-lightning.json`);
  // Første kjøring er treg. Den tas her, slik at spillet starter mykt.
  const varm = tf.zeros([1, STØRRELSE, STØRRELSE, 3], 'int32');
  const ut = modell.execute(varm) as tf.Tensor;
  await ut.data();
  varm.dispose();
  ut.dispose();
}

async function tolk(bitmap: ImageBitmap, ut: Float32Array) {
  // Bildet legges midt i en kvadratisk flate med svarte kanter, slik at proporsjonene bevares.
  const skala = Math.min(STØRRELSE / bitmap.width, STØRRELSE / bitmap.height);
  const b = bitmap.width * skala;
  const h = bitmap.height * skala;
  const ox = (STØRRELSE - b) / 2;
  const oy = (STØRRELSE - h) / 2;
  c2d.fillStyle = '#000';
  c2d.fillRect(0, 0, STØRRELSE, STØRRELSE);
  c2d.drawImage(bitmap, ox, oy, b, h);
  const rgba = c2d.getImageData(0, 0, STØRRELSE, STØRRELSE).data;
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i];
    rgb[j + 1] = rgba[i + 1];
    rgb[j + 2] = rgba[i + 2];
  }
  const inn = tf.tensor4d(rgb, [1, STØRRELSE, STØRRELSE, 3], 'int32');
  const res = modell!.execute(inn) as tf.Tensor;
  const rå = (await res.data()) as Float32Array; // [y, x, sikkerhet] * 17
  inn.dispose();
  res.dispose();
  for (let k = 0; k < 17; k++) {
    ut[k * 3] = (rå[k * 3 + 1] * STØRRELSE - ox) / b;
    ut[k * 3 + 1] = (rå[k * 3] * STØRRELSE - oy) / h;
    ut[k * 3 + 2] = rå[k * 3 + 2];
  }
}

ctx.onmessage = async (ev: MessageEvent<TilArbeider>) => {
  const m = ev.data;
  try {
    if (m.type === 'last') {
      const t0 = performance.now();
      await last(m.base);
      send({ type: 'klar', ms: performance.now() - t0 });
    } else {
      if (!modell) throw new Error('Modellen er ikke lastet');
      const t0 = performance.now();
      await tolk(m.bitmap, m.punkter);
      m.bitmap.close(); // Bildet kastes her. Bare punktene sendes tilbake.
      send({ type: 'punkter', punkter: m.punkter, ms: performance.now() - t0 }, [m.punkter.buffer]);
    }
  } catch (e) {
    if (m.type === 'bilde') m.bitmap.close();
    send({ type: 'feil', melding: e instanceof Error ? e.message : String(e) });
  }
};
