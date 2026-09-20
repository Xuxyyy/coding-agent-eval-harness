export function renderEntry({prefix, value}) {
  if (typeof prefix !== 'string' || typeof value !== 'string') {
    throw new TypeError('renderEntry requires prefix and value strings');
  }
  return `${prefix}: ${value}`;
}
