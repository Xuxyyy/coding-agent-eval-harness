import {ValidationError} from '../errors.js';
import {validateUser} from '../shared/validate-user.js';

export function createUser(input) {
  const errors = validateUser(input);
  if (errors.length > 0) throw new ValidationError(errors);
  return {username: input.username, role: input.role};
}
