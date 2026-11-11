import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Web demo: one self-contained HTML file you can double-click (no server, no install).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: { target: 'es2022', outDir: 'demo', emptyOutDir: true, chunkSizeWarningLimit: 4000 }
});
