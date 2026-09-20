import {DEFAULT_TIMEOUT_MS} from './defaults.js';
import {requestLine} from './logger.js';

export function createHandler(action, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const log = options.log ?? (() => {});
  return async (request) => {
    log(requestLine(request));
    return action(request, {timeoutMs});
  };
}
