export function requestLine(request) {
  return `${request.method} ${request.path}`;
}
