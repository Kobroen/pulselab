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

export type ToWorker =
  | { type: 'load'; config: Config; base: string }
  | { type: 'frame'; id: number; bitmap: ImageBitmap };

export type FromWorker =
  | { type: 'loaded'; ms: number; detail: string }
  | { type: 'error'; message: string }
  // keypoints: [x, y, score] per punkt, x og y normalisert 0..1 i kamerabildet.
  | { type: 'result'; id: number; inferMs: number; keypoints: Float32Array };
