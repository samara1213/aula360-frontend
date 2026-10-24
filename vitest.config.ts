import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
      css: false,
      restoreMocks: true,
      // Las pruebas montan la aplicación completa con muchos pasos de usuario: con
      // todos los archivos en paralelo, algunas rozaban los 5 s por defecto.
      testTimeout: 15_000,
    },
  }),
);
