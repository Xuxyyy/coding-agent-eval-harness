import {resolveConfig} from './resolve-config.js';

export function buildServerOptions(layers = {}) {
  const config = resolveConfig(layers);
  return {
    host: config.host,
    port: config.port,
    logLevel: config.logLevel,
  };
}
