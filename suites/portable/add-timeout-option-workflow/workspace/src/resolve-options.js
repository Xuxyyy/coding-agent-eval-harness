import {DEFAULT_OPTIONS} from './options.generated.js';

export function resolveOptions(config = {}, env = {}) {
  return {
    retries: env.TOOL_RETRIES === undefined
      ? (config.retries ?? DEFAULT_OPTIONS.retries)
      : Number(env.TOOL_RETRIES),
  };
}
