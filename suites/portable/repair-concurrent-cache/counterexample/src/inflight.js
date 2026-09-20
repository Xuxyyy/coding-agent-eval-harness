export function createInFlightTracker() {
  const pending = new Map();
  return {
    run(key, factory) {
      if (!pending.has(key)) pending.set(key, Promise.resolve().then(factory));
      return pending.get(key);
    },
  };
}
