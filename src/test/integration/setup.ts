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

  // Point the app's own server helpers at the local stack. `createServiceClient`
  // reads the production variable names, so without this bridge any test that
  // imports real server code (rather than building its own client) would fail
  // against the developer's or CI's absent cloud credentials.
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_LOCAL_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.SUPABASE_LOCAL_ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_LOCAL_SERVICE_KEY;
});
