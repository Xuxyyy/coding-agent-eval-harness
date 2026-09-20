import {validateUser} from '../shared/validate-user.js';

export function parseUser(input) {
  const errors = validateUser(input);
  return errors.length === 0
    ? {ok: true, value: {username: input.username, role: input.role}}
    : {ok: false, errors};
}
