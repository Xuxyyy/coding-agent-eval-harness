import {renderEntry} from '../../core/src/render-entry.js';

export function renderCli(value) {
  return renderEntry({prefix: 'cli', value});
}
