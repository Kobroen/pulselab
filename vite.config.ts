import { defineConfig } from 'vite';

// Relativ base slik at siden virker både lokalt og under /pulselab/ på GitHub Pages.
export default defineConfig({
  base: './',
  worker: { format: 'iife' },
  build: { target: 'es2020', chunkSizeWarningLimit: 2000 },
});
