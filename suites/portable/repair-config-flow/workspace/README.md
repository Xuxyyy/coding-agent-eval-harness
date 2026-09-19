# Layered server configuration

`resolveConfig({project, environment})` is the single configuration boundary.
It applies defaults first, project values second, and environment values last.

`buildServerOptions(layers)` must return exactly `host`, `port`, and `logLevel`
from that resolved configuration. Callers rely on this public shape and on the
resolver's precedence rules.
