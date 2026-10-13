import { defineConfig } from 'vite';

export default defineConfig({
  // 상위 폴더(홈 디렉터리)의 postcss/tailwind 설정을 끌어오지 않도록 비워 둔다
  css: { postcss: {} },
  base: './',
});
