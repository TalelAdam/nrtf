# Doc-Extraction — Extraction Cache Review & Fix

## Summary

- Problem: runtime error `Cannot find module '../cache/extraction-cache.service'` when starting the backend. The compiled `dist` files (and many `src` modules) import `./cache/extraction-cache.service` but the source file was missing.
- Action taken: added a minimal `ExtractionCacheService` implementation at `src/modules/doc-extraction/cache/extraction-cache.service.ts`.

## What I added

- `src/modules/doc-extraction/cache/extraction-cache.service.ts`
  - Implements `ExtractionCacheService` with a small API used across the module:
    - `get<T>(key): Promise<T|null>`
    - `set(key, value, ttlSeconds?): Promise<void>`
  - Prefers Redis when `REDIS_URL` is configured (uses `ioredis`), otherwise falls back to an in-memory Map.
  - Implements `onModuleDestroy()` to close Redis connections cleanly.

## Why this fixes the error

- The Nest module `DocExtractionModule` registers `ExtractionCacheService` as a provider and other services (OCR, extractors, comparison pipeline) import it. Providing a concrete implementation prevents the `MODULE_NOT_FOUND` error at runtime.

## Recommended follow-ups

1. Add `REDIS_URL` to your `.env` for production or CI if you want a shared cache. Example:

   REDIS_URL=redis://localhost:6379

2. Rebuild the backend and restart dev server:

```bash
pnpm --filter backend build
pnpm --filter backend dev
```

3. Run unit tests related to extraction to ensure behaviour (they mock the cache in tests already):

```bash
pnpm --filter backend test -- --testPathPattern=ocr.service.spec
```

4. (Optional) Harden the cache API with TTL semantics and metrics (hit/miss counters) if you rely heavily on cached OCR results.

## Notes

- Tests already mock `ExtractionCacheService` in the doc-extraction tests, so the new implementation should be backward-compatible.
- The implementation is intentionally small and synchronous-friendly; it matches the usage pattern (get/set) across the module.

If you want, I can also:

- Add integration tests for the Redis fallback behaviour.
- Wire configurable prefixing or namespacing for cache keys.

---

Created automatically by code review assistant.
