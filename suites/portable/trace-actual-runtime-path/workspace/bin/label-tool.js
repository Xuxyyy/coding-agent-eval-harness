#!/usr/bin/env node
import {runFormat} from '../src/commands/format.js';

process.stdout.write(`${runFormat(process.argv.slice(2).join(' '))}\n`);
