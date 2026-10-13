import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@engine': fileURLToPath(new URL('./packages/engine/src', import.meta.url)) },
  },
});
