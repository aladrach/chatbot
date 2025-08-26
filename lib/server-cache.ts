type CacheEntry<T> = { value: T; expiresAt: number };

const DEFAULT_TTL_SECONDS = 600; // 10 minutes

type CacheStore = Map<string, CacheEntry<any>>;

function getStore(): CacheStore {
  const g = globalThis as any;
  if (!g.__inMemoryServerCache) {
    g.__inMemoryServerCache = new Map<string, CacheEntry<any>>();
  }
  return g.__inMemoryServerCache as CacheStore;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function getCached<T = unknown>(namespace: string, key: string): T | undefined {
  const store = getStore();
  const fullKey = `${namespace}|${key}`;
  const entry = store.get(fullKey);
  if (!entry) return undefined;
  if (entry.expiresAt <= nowSeconds()) {
    store.delete(fullKey);
    return undefined;
  }
  return entry.value as T;
}

export function setCached<T = unknown>(namespace: string, key: string, value: T, ttlSeconds = DEFAULT_TTL_SECONDS): void {
  const store = getStore();
  const fullKey = `${namespace}|${key}`;
  const entry: CacheEntry<T> = { value, expiresAt: nowSeconds() + Math.max(1, ttlSeconds) };
  store.set(fullKey, entry);
}


