import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode single`: 파일 하나(index.html)로 빌드 — 더블클릭으로 열거나 그대로 올릴 수 있다.
export default defineConfig(({ mode }) => ({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  resolve: {
    alias: { '@engine': fileURLToPath(new URL('../../packages/engine/src', import.meta.url)) },
  },
  css: { postcss: {} },
  build: {
    outDir: fileURLToPath(new URL(mode === 'single' ? '../../dist-studio-single' : '../../dist-studio', import.meta.url)),
    emptyOutDir: true,
  },
}));
