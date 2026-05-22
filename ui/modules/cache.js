/** @format */

import { SNAPSHOT_CACHE_KEY, state } from "./state.js";

const memorySnapshotCache = new Map();

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function tokenScopeFrom(token) {
  return token ? token.slice(0, 24) : "anon";
}

function getCurrentTokenScope() {
  return tokenScopeFrom(state.token);
}

function buildSnapshotCacheKey(scope, suffix = "") {
  return `${getCurrentTokenScope()}:${scope}:${suffix}`;
}

function readSnapshotStore() {
  const raw = sessionStorage.getItem(SNAPSHOT_CACHE_KEY);
  return safeJsonParse(raw || "{}", {});
}

function writeSnapshotStore(store) {
  sessionStorage.setItem(SNAPSHOT_CACHE_KEY, JSON.stringify(store));
}

function readSnapshotCache(cacheKey, ttlMs) {
  const now = Date.now();

  const memoryEntry = memorySnapshotCache.get(cacheKey);
  if (memoryEntry && now - memoryEntry.ts <= ttlMs) {
    return memoryEntry.data;
  }
  if (memoryEntry) {
    memorySnapshotCache.delete(cacheKey);
  }

  const store = readSnapshotStore();
  const entry = store[cacheKey];
  if (!entry) return null;

  if (now - entry.ts > ttlMs) {
    delete store[cacheKey];
    writeSnapshotStore(store);
    return null;
  }

  memorySnapshotCache.set(cacheKey, entry);
  return entry.data;
}

function writeSnapshotCache(cacheKey, data) {
  const entry = { ts: Date.now(), data };
  memorySnapshotCache.set(cacheKey, entry);

  const store = readSnapshotStore();
  store[cacheKey] = entry;
  writeSnapshotStore(store);
}

function removeSnapshotCacheBy(predicate) {
  const store = readSnapshotStore();
  let changed = false;

  Object.keys(store).forEach((key) => {
    if (!predicate(key)) return;
    delete store[key];
    changed = true;
  });

  if (changed) {
    writeSnapshotStore(store);
  }

  Array.from(memorySnapshotCache.keys()).forEach((key) => {
    if (predicate(key)) {
      memorySnapshotCache.delete(key);
    }
  });
}

export function invalidateSnapshotScope(scope, suffixPrefix = "") {
  const prefix = `${getCurrentTokenScope()}:${scope}:`;
  removeSnapshotCacheBy(
    (key) =>
      key.startsWith(prefix) &&
      (!suffixPrefix || key.startsWith(`${prefix}${suffixPrefix}`)),
  );
}

export function clearSnapshotCacheForToken(token) {
  const scopePrefix = `${tokenScopeFrom(token)}:`;
  removeSnapshotCacheBy((key) => key.startsWith(scopePrefix));
}

export async function fetchWithSnapshotCache({
  scope,
  suffix = "",
  ttlMs,
  force = false,
  loader,
}) {
  const cacheKey = buildSnapshotCacheKey(scope, suffix);

  if (!force) {
    const cached = readSnapshotCache(cacheKey, ttlMs);
    if (cached !== null) {
      return cached;
    }
  }

  const freshData = await loader();
  writeSnapshotCache(cacheKey, freshData);
  return freshData;
}
