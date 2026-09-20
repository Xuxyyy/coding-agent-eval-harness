export function renderEntry(options, legacyValue) {
  const {prefix, value} = typeof options === 'object'
    ? options
    : {prefix: options, value: legacyValue};
  return `${prefix}: ${value}`;
}
