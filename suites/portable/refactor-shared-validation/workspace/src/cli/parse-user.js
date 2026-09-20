import {ROLES, USERNAME_PATTERN} from '../rules.js';

export function parseUser(input) {
  const errors = [];
  if (!input.username) errors.push('username is required');
  else if (!USERNAME_PATTERN.test(input.username)) errors.push('username is invalid');
  if (!ROLES.has(input.role)) errors.push('role is invalid');
  return errors.length === 0
    ? {ok: true, value: {username: input.username, role: input.role}}
    : {ok: false, errors};
}
