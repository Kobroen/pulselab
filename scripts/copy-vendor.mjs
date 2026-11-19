// Kopierer WebAssembly-filene til public/vendor slik at alt serveres fra egen
// adresse. Ingenting lastes fra tredjepart når siden kjører.
import { cpSync, mkdirSync } from 'node:fs';

const out = 'public/vendor';
mkdirSync(`${out}/mediapipe`, { recursive: true });
mkdirSync(`${out}/tfjs`, { recursive: true });

for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) {
  cpSync(`node_modules/@mediapipe/tasks-vision/wasm/${f}`, `${out}/mediapipe/${f}`);
}
for (const f of [
  'tfjs-backend-wasm.wasm',
  'tfjs-backend-wasm-simd.wasm',
  'tfjs-backend-wasm-threaded-simd.wasm',
]) {
  cpSync(`node_modules/@tensorflow/tfjs-backend-wasm/dist/${f}`, `${out}/tfjs/${f}`);
}
console.log('vendor: WebAssembly-filer kopiert til public/vendor');
