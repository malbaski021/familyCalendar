import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// The suite runs with `isolate: false` (see vitest.config.ts), so
// @testing-library/react is imported once and its own auto-cleanup `afterEach`
// is registered in whichever test file happened to import it first — later
// files would otherwise accumulate mounted trees in the same jsdom `document`
// and break `getByTestId` with "found multiple elements". Registering cleanup
// here binds it to every test file instead.
afterEach(() => {
  cleanup();
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
