import {renderEntry} from '../../core/src/render-entry.js';

export function activate(value) {
  return renderEntry({prefix: 'plugin', value});
}
