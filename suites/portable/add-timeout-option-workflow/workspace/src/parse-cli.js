export function parseCli(argv) {
  const options = {};
  const retryIndex = argv.indexOf('--retries');
  if (retryIndex !== -1) options.retries = Number(argv[retryIndex + 1]);
  return options;
}
