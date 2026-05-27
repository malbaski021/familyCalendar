import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import localRules from './eslint-rules/index.js';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Local ESLint plugin source — CommonJS, not part of the app.
    'eslint-rules/**',
  ]),
  {
    // Enforce data-testid on interactive elements in feature code.
    // Excluded: test files (don't need testid on test fixtures) and
    // Shadcn UI primitives in `components/ui/**` (library code, consumers
    // attach the testid via props on the wrapping element).
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/components/ui/**'],
    plugins: {
      local: localRules,
    },
    rules: {
      'local/require-data-testid': 'error',
    },
  },
]);

export default eslintConfig;
