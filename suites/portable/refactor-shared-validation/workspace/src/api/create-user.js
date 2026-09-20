import {ValidationError} from '../errors.js';
import {ROLES, USERNAME_PATTERN} from '../rules.js';

export function createUser(input) {
  const errors = [];
  if (!input.username) errors.push('username is required');
  else if (!USERNAME_PATTERN.test(input.username)) errors.push('username is invalid');
  if (!ROLES.has(input.role)) errors.push('role is invalid');
  if (errors.length > 0) throw new ValidationError(errors);
  return {username: input.username, role: input.role};
}
