import {DEFAULT_OPTIONS} from './options.generated.js';

export function resolveOptions(config = {}, env = {}) {
  return {
    retries: env.TOOL_RETRIES === undefined
      ? (config.retries ?? DEFAULT_OPTIONS.retries)
      : Number(env.TOOL_RETRIES),
    requestTimeoutMs: env.TOOL_TIMEOUT_MS === undefined
      ? (config.requestTimeoutMs ?? DEFAULT_OPTIONS.requestTimeoutMs)
      : Number(env.TOOL_TIMEOUT_MS),
  };
}
