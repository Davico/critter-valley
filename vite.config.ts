import { defineConfig } from 'vite';
export default defineConfig({ base: './', build: { assetsInlineLimit: 100000000, chunkSizeWarningLimit: 2000 } });
