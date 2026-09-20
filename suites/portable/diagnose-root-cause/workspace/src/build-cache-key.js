import {normalizeSegment} from './normalize-segment.js';

export function buildCacheKey(route) {
  return decodeURIComponent(route)
    .split('/')
    .filter(Boolean)
    .map(normalizeSegment)
    .join('|');
}
