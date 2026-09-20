import {DEFAULT_TIMEOUT_MS} from './defaults.js';
import {requestLine} from './logger.js';

export function createHandler(action, options = {}) {
<<<<<<< timeout-change
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return async (request) => action(request, {timeoutMs});
=======
  const log = options.log ?? (() => {});
  return async (request) => {
    log(requestLine(request));
    return action(request, {});
  };
>>>>>>> logging-change
}
