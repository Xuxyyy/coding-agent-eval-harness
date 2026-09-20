export function buildCacheKey(namespace, key) {
  return `${namespace.trim()}:${key.trim()}`;
}
