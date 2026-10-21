import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// En desarrollo, /api va al backend por el proxy: el navegador ve un solo origen
// (sin CORS y con cookies SameSite sin sorpresas). El backend valida el Origin
// (http://localhost:5173) contra CORS_ORIGINS en los métodos que modifican datos.
const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
  preview: { port: 4173, strictPort: true },
  build: { sourcemap: false },
});
