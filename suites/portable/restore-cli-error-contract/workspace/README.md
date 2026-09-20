# Count CLI

`node bin/tool.js --count N` prints `count:N` to stdout and exits 0. Invalid
counts print `error: --count must be an integer` to stderr, keep stdout empty,
and exit 2.
