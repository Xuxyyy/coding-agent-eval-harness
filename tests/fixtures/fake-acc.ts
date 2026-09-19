import {chmodSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

export function writeFakeAcc(root: string): string {
  const executable = join(root, 'fake-acc');
  const configSolution = `import {resolveConfig} from './resolve-config.js';

export function buildServerOptions(layers = {}) {
  const config = resolveConfig(layers);
  return {
    host: config.host,
    port: config.port,
    logLevel: config.logLevel,
  };
}
`;
  const configTest = `import assert from 'node:assert/strict';
import test from 'node:test';
import {buildServerOptions} from '../src/server-options.js';
test('resolved configuration',()=>assert.deepEqual(buildServerOptions({project:{host:'project',port:4100,logLevel:'warn'},environment:{host:'environment',port:5200,logLevel:'debug'}}),{host:'environment',port:5200,logLevel:'debug'}));
`;
  const headerSolution = `export function mergeHeaders(defaultHeaders = {}, callerHeaders = {}) {
  const merged = {};
  const spellingByName = new Map();
  for (const [key, value] of [...Object.entries(defaultHeaders), ...Object.entries(callerHeaders)]) {
    const name = key.toLowerCase();
    const previousSpelling = spellingByName.get(name);
    if (previousSpelling !== undefined) delete merged[previousSpelling];
    merged[key] = value;
    spellingByName.set(name, key);
  }
  return merged;
}
`;
  const headerTest = `import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequest} from '../src/index.js';
test('case-insensitive caller precedence',()=>{const headers={accept:'text/plain'};assert.deepEqual(createRequest('https://example.test',{headers}).headers,{'User-Agent':'portable-client/1.0',accept:'text/plain'});assert.deepEqual(headers,{accept:'text/plain'})});
`;
  writeFileSync(
    executable,
    `#!/usr/bin/env node
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
if(process.argv.includes('--version')){console.log('fake-acc 2.0');process.exit(0)}
if(process.env.FAKE_MODE==='malformed'){console.log('not-json');process.exit(0)}
if(process.env.FAKE_MODE!=='noedit'){
  if(existsSync('src/clamp.js')){}
  else if(existsSync('src/server-options.js')){writeFileSync('src/server-options.js',${JSON.stringify(configSolution)});writeFileSync('test/server-options-regression.test.js',${JSON.stringify(configTest)})}
  else if(existsSync('src/merge-headers.js')){writeFileSync('src/merge-headers.js',${JSON.stringify(headerSolution)});writeFileSync('test/header-case-regression.test.js',${JSON.stringify(headerTest)})}
  else if(existsSync('README.md')){mkdirSync('src',{recursive:true});writeFileSync('src/slugify.js',"export function slugify(text){return text.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}\\n")}
  else if(existsSync('src/sum.js')){writeFileSync('src/sum.js',readFileSync('src/sum.js','utf8').replace('numbers.length - 1','numbers.length'))}
  else if(existsSync('src/token-preview.js')){writeFileSync('src/token-preview.js',readFileSync('src/token-preview.js','utf8').replace('slice(0, 2)','slice(0, 4)').replace('slice(-2)','slice(-4)'))}
  else if(existsSync('src/title.js')){writeFileSync('src/title.js',"import {WORD_SEPARATOR} from './constants.js';\\n\\nexport function normalizeTitle(value) {\\n  return value.trim().toLowerCase().replace(/\\\\s+/g, WORD_SEPARATOR);\\n}\\n")}
  else if(existsSync('src/parse-port.js')){writeFileSync('src/parse-port.js',"export function parsePort(value) {\\n  if (typeof value !== 'string' || !/^\\\\d+$/.test(value)) return null;\\n  const port = Number(value);\\n  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;\\n}\\n");writeFileSync('test/parse-port-regression.test.js',"import assert from 'node:assert/strict';\\nimport test from 'node:test';\\nimport {parsePort} from '../src/parse-port.js';\\ntest('regression',()=>assert.equal(parsePort('8080oops'),null));\\n")}
}
console.log(JSON.stringify({type:'text_delta',text:'done'}));
console.log(JSON.stringify({kind:'result',stopped:'done',usage:{prompt:4,completion:2,total:6},prompts:0,steps:1}));
`,
  );
  chmodSync(executable, 0o755);
  return executable;
}
