import {formatRecord} from '../../core/src/index.js';
export const activate = (name) => formatRecord({prefix: 'plugin', value: name});
