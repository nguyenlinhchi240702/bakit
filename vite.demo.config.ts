import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };
import { viteSingleFile } from 'vite-plugin-singlefile';

// Web demo: one self-contained HTML file you can double-click (no server, no install).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { target: 'es2022', outDir: 'demo', emptyOutDir: true, chunkSizeWarningLimit: 4000 }
});
