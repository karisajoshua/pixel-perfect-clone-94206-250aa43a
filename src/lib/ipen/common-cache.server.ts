// Server-only cache for IPEN reference data. Kept out of *.functions.ts so
// the server-fn code splitter never has to reach across module scope inside
// a handler body.

type CacheEntry = { at: number; value: unknown };

const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 12 * 60 * 60 * 1000; // 12h

export async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await loader();
  CACHE.set(key, { at: Date.now(), value });
  return value;
}

export function invalidate(key: string): void {
  CACHE.delete(key);
}