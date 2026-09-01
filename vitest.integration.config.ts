import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/test/integration/**/*.test.ts'],
    setupFiles: ['./src/test/integration/setup.ts'],
    pool: 'threads',
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      // Lets integration tests import real `server-only` modules (queue,
      // audit, service client) instead of re-implementing their logic against
      // a raw Supabase client. The marker has no runtime behaviour.
      'server-only': path.resolve(__dirname, './src/test/ai/server-only.stub.ts'),
      '@': path.resolve(__dirname, './src'),
    },
  },
});
