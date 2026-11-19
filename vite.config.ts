import { defineConfig } from 'vite';

// Relativ base slik at siden virker både lokalt og under /pulselab/ på GitHub Pages.
// To sider bygges: spillet (index.html) og sporingstesten (sporingstest.html).
export default defineConfig({
  base: './',
  worker: { format: 'iife' },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    rollupOptions: { input: ['index.html', 'sporingstest.html'] },
  },
});
