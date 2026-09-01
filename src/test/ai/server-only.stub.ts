// `server-only` is a build-time marker with no runtime behaviour, and it is not
// installed as a standalone package here — it ships with Next. The AI harness
// runs outside Next, so `vitest.ai.config.ts` aliases the import to this stub.
// Nothing else should import it.
export {};
