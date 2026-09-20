export function formatRecord(first, second) {
  const options = first !== null && typeof first === 'object'
    ? first
    : {prefix: first, value: second};
  return `${options.prefix}:${String(options.value).trim()}`;
}
