import {DEFAULT_TIMEOUT_MS} from './defaults.js';

export function createHandler(action, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return async (request) => action(request, {timeoutMs});
}
