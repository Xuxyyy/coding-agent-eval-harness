import {DEFAULT_CONFIG} from './default-config.js';

export function buildServerOptions() {
  return {
    host: DEFAULT_CONFIG.host,
    port: DEFAULT_CONFIG.port,
    logLevel: DEFAULT_CONFIG.logLevel,
  };
}
