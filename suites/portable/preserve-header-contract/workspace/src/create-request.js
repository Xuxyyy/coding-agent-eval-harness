import {mergeHeaders} from './merge-headers.js';

const DEFAULT_HEADERS = Object.freeze({
  Accept: 'application/json',
  'User-Agent': 'portable-client/1.0',
});

export function createRequest(url, {method = 'GET', headers = {}} = {}) {
  return {
    method,
    url,
    headers: mergeHeaders(DEFAULT_HEADERS, headers),
  };
}
