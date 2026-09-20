import {resolveOptions} from './resolve-options.js';
import {createClient} from './runtime-client.js';

export function activatePlugin(config = {}, env = {}) {
  const {retries} = resolveOptions(config, env);
  return createClient({retries});
}
