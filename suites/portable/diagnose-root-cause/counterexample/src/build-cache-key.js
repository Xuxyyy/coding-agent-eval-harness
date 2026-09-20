import {normalizeSegment} from './normalize-segment.js';

export function buildCacheKey(route) {
  return route.split('/').filter(Boolean).map(normalizeSegment).join('|');
}
