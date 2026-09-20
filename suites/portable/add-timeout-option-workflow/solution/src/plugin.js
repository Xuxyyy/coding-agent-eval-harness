import {resolveOptions} from './resolve-options.js';
import {createClient} from './runtime-client.js';

export function activatePlugin(config = {}, env = {}) {
  return createClient(resolveOptions(config, env));
}
