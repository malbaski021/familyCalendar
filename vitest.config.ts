import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    css: true,
    // Windows-stable pooling. Re-creating a worker + jsdom environment per
    // test file made `vitest run` intermittently fail with "Timeout waiting
    // for worker to respond" — which silently SKIPPED whole files while still
    // reporting a pass. One long-lived fork, environment built once, files run
    // sequentially inside it. Safe here because `src/test/setup.ts` only stubs
    // `matchMedia` and React Testing Library unmounts after every test.
    pool: 'forks',
    maxWorkers: 1,
    isolate: false,
    fileParallelism: false,
    exclude: ['node_modules', 'dist', '.next', 'src/test/integration/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
