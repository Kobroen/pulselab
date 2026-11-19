export type ModelId = 'movenet' | 'mediapipe';
export type BackendId = 'webgl' | 'wasm' | 'GPU' | 'CPU';

export interface Config {
  id: string;
  label: string;
  model: ModelId;
  backend: BackendId;
}

export const CONFIGS: Config[] = [
  { id: 'movenet-webgl', label: 'MoveNet Lightning, grafikkort', model: 'movenet', backend: 'webgl' },
  { id: 'movenet-wasm', label: 'MoveNet Lightning, prosessor', model: 'movenet', backend: 'wasm' },
  { id: 'mediapipe-gpu', label: 'MediaPipe Pose lite, grafikkort', model: 'mediapipe', backend: 'GPU' },
  { id: 'mediapipe-cpu', label: 'MediaPipe Pose lite, prosessor', model: 'mediapipe', backend: 'CPU' },
];

// Bildevei: hvordan kamerabildet kommer fram til sporingsarbeideren.
export type PathId = 'bitmap' | 'pixels' | 'track';

export const PATHS: { id: PathId; label: string }[] = [
  { id: 'bitmap', label: 'Bildeobjekt' },
  { id: 'pixels', label: 'Piksler' },
  { id: 'track', label: 'Kamerastrøm' },
];

export type ToWorker =
  | { type: 'load'; config: Config; base: string }
  // Kamerastrøm: arbeideren leser bildene selv, uten hovedtråden.
  | { type: 'stream'; readable: ReadableStream<VideoFrame> }
  // Uten bitmap og pixels brukes siste bilde fra kamerastrømmen.
  | { type: 'frame'; id: number; bitmap?: ImageBitmap; pixels?: { data: ArrayBuffer; width: number; height: number } };

export type FromWorker =
  | { type: 'loaded'; ms: number; detail: string }
  | { type: 'error'; message: string }
  | {
      type: 'result';
      id: number;
      waitMs: number; // ventetid på nytt kamerabilde (bare kamerastrøm)
      prepMs: number; // klargjøring av bildet før modellen
      modelMs: number; // selve modellen
      doneAt: number; // absolutt tidspunkt da svaret ble sendt
      // keypoints: [x, y, score] per punkt, x og y normalisert 0..1 i kamerabildet.
      keypoints: Float32Array;
    };
