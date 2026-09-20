import {UsageError} from './errors.js';
export function parseCount(args) {
  const index = args.indexOf('--count');
  const raw = index < 0 ? undefined : args[index + 1];
  if (raw === undefined || !/^-?\d+$/.test(raw)) throw new UsageError('--count must be an integer');
  return Number(raw);
}
