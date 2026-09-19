import {DEFAULT_CONFIG} from './default-config.js';

export function resolveConfig({project = {}, environment = {}} = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...project,
    ...environment,
  };
}
