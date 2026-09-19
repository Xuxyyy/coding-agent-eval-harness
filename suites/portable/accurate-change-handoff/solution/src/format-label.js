export function formatLabel(value) {
  return value.trim().toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}
