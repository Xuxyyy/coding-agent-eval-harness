export function mergeHeaders(defaultHeaders = {}, callerHeaders = {}) {
  const merged = {};
  for (const [key, value] of Object.entries(defaultHeaders)) merged[key.toLowerCase()] = value;
  for (const [key, value] of Object.entries(callerHeaders)) merged[key.toLowerCase()] = value;
  Object.assign(callerHeaders, merged);
  return merged;
}
