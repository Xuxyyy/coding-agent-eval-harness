import {parseCount} from './parse-count.js';
import {runCount} from './run.js';
import {UsageError} from './errors.js';

export async function main(args, streams = {stdout: process.stdout, stderr: process.stderr}) {
  try {
    streams.stdout.write(`${runCount(parseCount(args))}\n`);
    return 0;
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    streams.stdout.write(`error: ${error.message}\n`);
    return 0;
  }
}
