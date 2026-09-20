import {normalizeKey} from './normalize-key.js';

export function buildCacheKey(namespace, key) {
  return `${normalizeKey(namespace)}:${normalizeKey(key)}`;
}
