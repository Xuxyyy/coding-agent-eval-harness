import {renderEntry} from '../../core/src/render-entry.js';

export function start(value) {
  return renderEntry({prefix: 'app', value});
}
