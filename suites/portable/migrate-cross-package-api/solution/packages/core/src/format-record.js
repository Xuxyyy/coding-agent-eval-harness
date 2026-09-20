export function formatRecord(options) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('formatRecord requires an options object');
  }
  return `${options.prefix}:${String(options.value).trim()}`;
}
