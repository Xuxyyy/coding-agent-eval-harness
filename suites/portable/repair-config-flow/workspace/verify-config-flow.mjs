import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';

const resolverPath = new URL('./src/resolve-config.js', import.meta.url);
const serverOptionsPath = new URL('./src/server-options.js', import.meta.url);
const regressionPath = new URL('./test/server-options-regression.test.js', import.meta.url);
const originalResolver = readFileSync(resolverPath, 'utf8');
const originalServerOptions = readFileSync(serverOptionsPath, 'utf8');

function run(args) {
  return spawnSync(process.execPath, args, {cwd: new URL('.', import.meta.url), encoding: 'utf8'});
}

try {
  writeFileSync(
    resolverPath,
    "export function resolveConfig() { return {host: 'resolver.invalid', port: 6123, logLevel: 'trace'}; }\n",
  );
  const routed = run([
    '--input-type=module',
    '-e',
    "import {buildServerOptions} from './src/server-options.js'; const actual = buildServerOptions({project:{port:1},environment:{port:2}}); const expected = {host:'resolver.invalid',port:6123,logLevel:'trace'}; if (JSON.stringify(actual) !== JSON.stringify(expected)) { console.error({actual,expected}); process.exit(1); }",
  ]);
  assert.equal(routed.status, 0, routed.stderr || routed.stdout);

  writeFileSync(
    serverOptionsPath,
    "import {DEFAULT_CONFIG} from './default-config.js';\nexport function buildServerOptions({project = {}, environment = {}} = {}) {\n  return {\n    host: DEFAULT_CONFIG.host,\n    port: environment.port ?? project.port ?? DEFAULT_CONFIG.port,\n    logLevel: DEFAULT_CONFIG.logLevel,\n  };\n}\n",
  );
  const regression = run(['--test', new URL(regressionPath).pathname]);
  assert.notEqual(regression.status, 0, 'regression test must reject a port-only repair');
} finally {
  writeFileSync(resolverPath, originalResolver);
  writeFileSync(serverOptionsPath, originalServerOptions);
}
