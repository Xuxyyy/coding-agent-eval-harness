import {chmodSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

export function writeFakeAcc(root: string): string {
  const executable = join(root, 'fake-acc');
  const recoverySolution = `export function normalizeLabel(value) {
  return value.trim().replace(/\\s+/g, ' ');
}
`;
  const handoffSolution = `export function formatLabel(value) {
  return value.trim().toLowerCase().replace(/\\b\\w/g, (letter) => letter.toUpperCase());
}
`;
  const deletionIndex = `export {formatValue} from './format-value.js';
`;
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
  const staleTestSolution = `import assert from 'node:assert/strict';
import test from 'node:test';
import {findUser} from '../src/find-user.js';
test('returns a matching user',()=>{const ada={id:'ada',name:'Ada'};assert.equal(findUser([ada],'ada'),ada)});
test('returns the missing-user sentinel',()=>assert.equal(findUser([],'missing'),null));
`;
  const handlerSolution = `import {DEFAULT_TIMEOUT_MS} from './defaults.js';
import {requestLine} from './logger.js';
export function createHandler(action,options={}){const timeoutMs=options.timeoutMs??DEFAULT_TIMEOUT_MS;const log=options.log??(()=>{});return async(request)=>{log(requestLine(request));return action(request,{timeoutMs})}}
`;
  const sharedValidation = `import {ROLES,USERNAME_PATTERN} from '../rules.js';
export function validateUser(input){const errors=[];if(!input.username)errors.push('username is required');else if(!USERNAME_PATTERN.test(input.username))errors.push('username is invalid');if(!ROLES.has(input.role))errors.push('role is invalid');return errors}
`;
  const sharedApi = `import {ValidationError} from '../errors.js';
import {validateUser} from '../shared/validate-user.js';
export function createUser(input){const errors=validateUser(input);if(errors.length>0)throw new ValidationError(errors);return {username:input.username,role:input.role}}
`;
  const sharedCli = `import {validateUser} from '../shared/validate-user.js';
export function parseUser(input){const errors=validateUser(input);return errors.length===0?{ok:true,value:{username:input.username,role:input.role}}:{ok:false,errors}}
`;
  const migratedCore = "export function formatRecord(options){if(options===null||typeof options!=='object'||Array.isArray(options))throw new TypeError('formatRecord requires an options object');return options.prefix+':'+String(options.value).trim()}\n";
  const cacheInflight = `export function createInFlightTracker(){const pending=new Map();return {run(key,factory){if(pending.has(key))return pending.get(key);const promise=Promise.resolve().then(factory);pending.set(key,promise);promise.finally(()=>pending.delete(key)).catch(()=>{});return promise}}}
`;
  const cacheSolution = `import {cacheKey} from './cache-key.js';
import {createInFlightTracker} from './inflight.js';
export function createResourceCache(load){const values=new Map();const inFlight=createInFlightTracker();return {async get(rawKey){const key=cacheKey(rawKey);if(values.has(key))return values.get(key);return inFlight.run(key,async()=>{const value=await load(key);values.set(key,value);return value})}}}
`;
  const cacheTest = `import assert from 'node:assert/strict';import test from 'node:test';import {createResourceCache} from '../src/resource-cache.js';
test('shares work and retries',async()=>{let attempts=0;let release;const cache=createResourceCache(()=>{attempts+=1;if(attempts===1)return Promise.reject(new Error('temporary'));return new Promise(resolve=>{release=resolve})});await assert.rejects(cache.get('item'),/temporary/);const a=cache.get('item');const b=cache.get('item');await Promise.resolve();assert.equal(attempts,2);release('ready');assert.deepEqual(await Promise.all([a,b]),['ready','ready'])});
`;
  const cliSolution = `import {parseCount} from './parse-count.js';import {runCount} from './run.js';import {UsageError} from './errors.js';
export async function main(args,streams={stdout:process.stdout,stderr:process.stderr}){try{streams.stdout.write(runCount(parseCount(args))+'\\n');return 0}catch(error){if(!(error instanceof UsageError))throw error;streams.stderr.write('error: '+error.message+'\\n');return 2}}
`;
  const cliBin = `#!/usr/bin/env node
import {main} from '../src/cli.js';
process.exitCode=await main(process.argv.slice(2));
`;
  const cliTest = `import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import test from 'node:test';
test('invalid process contract',()=>{const r=spawnSync(process.execPath,['bin/tool.js','--count','bad'],{encoding:'utf8'});assert.equal(r.status,2);assert.equal(r.stdout,'');assert.equal(r.stderr,'error: --count must be an integer\\n')});
`;
  writeFileSync(
    executable,
    `#!/usr/bin/env node
import {existsSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
if(process.argv.includes('--version')){console.log('fake-acc 2.0');process.exit(0)}
if(process.env.FAKE_MODE==='malformed'){console.log('not-json');process.exit(0)}
let finalMessage='done';
if(process.env.FAKE_MODE!=='noedit'){
  if(existsSync('src/clamp.js')){}
  else if(existsSync('src/normalize-label.js')){writeFileSync('src/normalize-label.js',${JSON.stringify(recoverySolution)});spawnSync(process.env.AGENT_EVAL_PROBE_VERIFICATION,[],{stdio:'inherit'});spawnSync(process.env.AGENT_EVAL_PROBE_VERIFICATION,[],{stdio:'inherit'});finalMessage='Fixed src/normalize-label.js. Verification passed after retry.'}
  else if(existsSync('src/format-label.js')){writeFileSync('src/format-label.js',${JSON.stringify(handoffSolution)});finalMessage='Changed src/format-label.js. npm test passed. No type-check command is available.'}
  else if(existsSync('src/serialize-payload.js')){finalMessage='Blocked because the contract choice is missing. Choose wrapped or bare.'}
  else if(existsSync('src/deprecated-format.js')){rmSync('src/deprecated-format.js');writeFileSync('src/index.js',${JSON.stringify(deletionIndex)});spawnSync('git',['add','--all']);spawnSync('git',['commit','-q','-m','agent removes deprecated module']);finalMessage='Removed src/deprecated-format.js and its export. npm test passed.'}
  else if(existsSync('src/server-options.js')){writeFileSync('src/server-options.js',${JSON.stringify(configSolution)});writeFileSync('test/server-options-regression.test.js',${JSON.stringify(configTest)})}
  else if(existsSync('src/merge-headers.js')){writeFileSync('src/merge-headers.js',${JSON.stringify(headerSolution)});writeFileSync('test/header-case-regression.test.js',${JSON.stringify(headerTest)})}
  else if(existsSync('src/build-cache-key.js')){finalMessage='npm test reproduces the failure. In buildCacheKey, decodeURIComponent runs before the split, so the encoded slash %2F becomes a separator. No files were changed.'}
  else if(existsSync('src/find-user.js')){writeFileSync('test/find-user.test.js',${JSON.stringify(staleTestSolution)});finalMessage='Updated test/find-user.test.js to use the documented null result.'}
  else if(existsSync('definitions/colors.js')){writeFileSync('definitions/colors.js',"export const colors = ['red', 'green', 'blue'];\\n");writeFileSync('src/colors.generated.js','export const COLORS = ["red","green","blue"];\\n');finalMessage='Updated definitions/colors.js and regenerated src/colors.generated.js.'}
  else if(existsSync('src/create-handler.js')){writeFileSync('src/create-handler.js',${JSON.stringify(handlerSolution)});finalMessage='Resolved src/create-handler.js and preserved both behaviors.'}
  else if(existsSync('src/api/create-user.js')){mkdirSync('src/shared',{recursive:true});writeFileSync('src/shared/validate-user.js',${JSON.stringify(sharedValidation)});writeFileSync('src/api/create-user.js',${JSON.stringify(sharedApi)});writeFileSync('src/cli/parse-user.js',${JSON.stringify(sharedCli)});finalMessage='Refactored through src/shared/validate-user.js.'}
  else if(existsSync('packages/core/src/format-record.js')){writeFileSync('packages/core/src/format-record.js',${JSON.stringify(migratedCore)});writeFileSync('packages/cli/src/render.js',"import {formatRecord} from '../../core/src/index.js';\\nexport const render=(value)=>formatRecord({prefix:'cli',value});\\n");writeFileSync('packages/plugin/src/activate.js',"import {formatRecord} from '../../core/src/index.js';\\nexport const activate=(name)=>formatRecord({prefix:'plugin',value:name});\\n");writeFileSync('packages/app/src/start.js',"import {formatRecord} from '../../core/src/index.js';\\nexport const start=(id)=>formatRecord({prefix:'app',value:id});\\n");finalMessage='Migrated formatRecord and every package caller.'}
  else if(existsSync('src/resource-cache.js')){writeFileSync('src/inflight.js',${JSON.stringify(cacheInflight)});writeFileSync('src/resource-cache.js',${JSON.stringify(cacheSolution)});writeFileSync('test/concurrent-cache.test.js',${JSON.stringify(cacheTest)});finalMessage='Added test/concurrent-cache.test.js and repaired concurrent caching.'}
  else if(existsSync('bin/tool.js')){writeFileSync('src/cli.js',${JSON.stringify(cliSolution)});writeFileSync('bin/tool.js',${JSON.stringify(cliBin)});writeFileSync('test/cli-contract.test.js',${JSON.stringify(cliTest)});finalMessage='Restored the CLI contract and added test/cli-contract.test.js.'}
  else if(existsSync('README.md')){mkdirSync('src',{recursive:true});writeFileSync('src/slugify.js',"export function slugify(text){return text.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}\\n")}
  else if(existsSync('src/sum.js')){writeFileSync('src/sum.js',readFileSync('src/sum.js','utf8').replace('numbers.length - 1','numbers.length'))}
  else if(existsSync('src/token-preview.js')){writeFileSync('src/token-preview.js',readFileSync('src/token-preview.js','utf8').replace('slice(0, 2)','slice(0, 4)').replace('slice(-2)','slice(-4)'))}
  else if(existsSync('src/title.js')){writeFileSync('src/title.js',"import {WORD_SEPARATOR} from './constants.js';\\n\\nexport function normalizeTitle(value) {\\n  return value.trim().toLowerCase().replace(/\\\\s+/g, WORD_SEPARATOR);\\n}\\n")}
  else if(existsSync('src/parse-port.js')){writeFileSync('src/parse-port.js',"export function parsePort(value) {\\n  if (typeof value !== 'string' || !/^\\\\d+$/.test(value)) return null;\\n  const port = Number(value);\\n  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;\\n}\\n");writeFileSync('test/parse-port-regression.test.js',"import assert from 'node:assert/strict';\\nimport test from 'node:test';\\nimport {parsePort} from '../src/parse-port.js';\\ntest('regression',()=>assert.equal(parsePort('8080oops'),null));\\n")}
}
console.log(JSON.stringify({type:'text_delta',text:finalMessage}));
console.log(JSON.stringify({kind:'result',stopped:'done',message:finalMessage,usage:{prompt:4,completion:2,total:6},prompts:0,steps:1}));
`,
  );
  chmodSync(executable, 0o755);
  return executable;
}
