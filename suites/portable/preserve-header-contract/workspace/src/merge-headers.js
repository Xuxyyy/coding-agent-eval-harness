export function mergeHeaders(defaultHeaders = {}, callerHeaders = {}) {
  return {...defaultHeaders, ...callerHeaders};
}
