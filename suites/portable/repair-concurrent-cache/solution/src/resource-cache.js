import {cacheKey} from './cache-key.js';
import {createInFlightTracker} from './inflight.js';

export function createResourceCache(load) {
  const values = new Map();
  const inFlight = createInFlightTracker();
  return {
    async get(rawKey) {
      const key = cacheKey(rawKey);
      if (values.has(key)) return values.get(key);
      return inFlight.run(key, async () => {
        const value = await load(key);
        values.set(key, value);
        return value;
      });
    },
  };
}
