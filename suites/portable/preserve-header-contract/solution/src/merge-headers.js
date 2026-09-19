export function mergeHeaders(defaultHeaders = {}, callerHeaders = {}) {
  const merged = {};
  const spellingByName = new Map();

  for (const [key, value] of [...Object.entries(defaultHeaders), ...Object.entries(callerHeaders)]) {
    const name = key.toLowerCase();
    const previousSpelling = spellingByName.get(name);
    if (previousSpelling !== undefined) delete merged[previousSpelling];
    merged[key] = value;
    spellingByName.set(name, key);
  }

  return merged;
}
