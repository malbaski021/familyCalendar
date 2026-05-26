// Integration test setup — runs once before all integration tests.
// Requires a running local Supabase stack: `npm run db:start`
// (CI does this automatically via the supabase/setup-cli action.)

import { config } from 'dotenv';
import { resolve } from 'node:path';
import { beforeAll } from 'vitest';

// Load .env.local for local development; in CI, env vars are injected directly.
config({ path: resolve(process.cwd(), '.env.local'), quiet: true });

beforeAll(() => {
  const required = ['SUPABASE_LOCAL_URL', 'SUPABASE_LOCAL_ANON_KEY', 'SUPABASE_LOCAL_SERVICE_KEY'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing env vars for integration tests: ${missing.join(', ')}\n` +
        `Run \`supabase status\` and copy the values into .env.local, or run \`npm run db:start\` first.`,
    );
  }
});
