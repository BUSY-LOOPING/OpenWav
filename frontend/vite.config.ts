/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 6330,
    host: true,
    proxy: {
      '/api': { target: process.env.VITE_DEV_API_TARGET ?? 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: { sourcemap: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
