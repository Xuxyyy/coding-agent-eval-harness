import {DEFAULT_CONFIG} from './default-config.js';

export function buildServerOptions({project = {}, environment = {}} = {}) {
  return {
    host: DEFAULT_CONFIG.host,
    port: environment.port ?? project.port ?? DEFAULT_CONFIG.port,
    logLevel: DEFAULT_CONFIG.logLevel,
  };
}
