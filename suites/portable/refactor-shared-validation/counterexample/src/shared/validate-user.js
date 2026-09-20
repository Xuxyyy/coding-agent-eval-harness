import {ROLES, USERNAME_PATTERN} from '../rules.js';

export function validateUser(input) {
  const errors = [];
  if (!input.username) errors.push('username is required');
  else if (!USERNAME_PATTERN.test(input.username)) errors.push('username is invalid');
  if (!ROLES.has(input.role)) errors.push('role is invalid');
  return errors;
}
