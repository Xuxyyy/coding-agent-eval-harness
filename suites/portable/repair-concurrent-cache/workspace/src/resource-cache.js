import {cacheKey} from './cache-key.js';

export function createResourceCache(load) {
  const values = new Map();
  return {
    async get(rawKey) {
      const key = cacheKey(rawKey);
      if (values.has(key)) return values.get(key);
      const value = await load(key);
      values.set(key, value);
      return value;
    },
  };
}
