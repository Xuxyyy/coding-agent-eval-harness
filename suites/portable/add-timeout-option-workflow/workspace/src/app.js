import {parseCli} from './parse-cli.js';
import {resolveOptions} from './resolve-options.js';
import {createClient} from './runtime-client.js';

export function startApp(argv = [], config = {}, env = {}) {
  const {retries} = resolveOptions(config, env);
  return createClient({retries, ...parseCli(argv)});
}
