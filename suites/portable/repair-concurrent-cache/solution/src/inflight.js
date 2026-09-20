export function createInFlightTracker() {
  const pending = new Map();
  return {
    run(key, factory) {
      if (pending.has(key)) return pending.get(key);
      const promise = Promise.resolve().then(factory);
      pending.set(key, promise);
      promise.finally(() => pending.delete(key)).catch(() => {});
      return promise;
    },
  };
}
