export function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}
