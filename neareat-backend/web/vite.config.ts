/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ADR-001 #1-#3: SPA, Express tarafından aynı origin'den `/panel/*` altında servis edilir.
// Geliştirmede `/api` ve `/odeme` yerel backend'e proxy'lenir → aynı origin çalışılır,
// oturum çerezi (`__Host-eatlas_sid`) birinci taraf kalır.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const BACKEND = env.EATLAS_BACKEND_URL || 'http://localhost:3000';

export default defineConfig({
  base: '/panel/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: false },
      '/odeme': { target: BACKEND, changeOrigin: false },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
