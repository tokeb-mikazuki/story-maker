import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode player`: 혼자 실행되는 HTML 파일의 틀(src/generated/player.html)을 만든다. 편집기의 내보내기가 여기에 작품을 끼워 넣는다.
// `--mode single`: 파일 하나(index.html)로 빌드 — 더블클릭으로 열거나 그대로 올릴 수 있다.
export default defineConfig(({ mode }) => ({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [react(), ...(mode === 'single' || mode === 'player' ? [viteSingleFile()] : [])],
  resolve: {
    alias: { '@engine': fileURLToPath(new URL('../../packages/engine/src', import.meta.url)) },
  },
  css: { postcss: {} },
  build: {
    outDir: fileURLToPath(new URL(mode === 'player' ? './src/generated' : mode === 'single' ? '../../dist-studio-single' : '../../dist-studio', import.meta.url)),
    emptyOutDir: true,
    ...(mode === 'player' ? { rollupOptions: { input: fileURLToPath(new URL('./player.html', import.meta.url)) } } : {}),
  },
}));
