// Opt-in prompt-quality harness: `npm run test:ai`.
//
// Deliberately separate from the unit and integration configs, and NOT part of
// CI, because it calls the real Groq API. Prompt quality is the one thing a
// mocked test cannot check — a widened category or a reworded instruction can
// regress silently — so this exists to be run by hand after prompt changes.
// It skips itself when GROQ_API_KEY is absent.
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/test/ai/**/*.test.ts'],
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    // Real network round trips against a free-tier quota; be patient and never
    // run these in parallel.
    testTimeout: 45000,
  },
  resolve: {
    alias: {
      // The AI modules are marked `server-only`; that marker has no runtime
      // behaviour and no package to resolve outside Next.
      'server-only': path.resolve(__dirname, './src/test/ai/server-only.stub.ts'),
      '@': path.resolve(__dirname, './src'),
    },
  },
});
