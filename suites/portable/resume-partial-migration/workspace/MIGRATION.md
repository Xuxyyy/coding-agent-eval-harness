# Interrupted migration

`renderEntry` now accepts `{prefix, value}`. Core and CLI are complete. The
plugin and app callers still use the removed positional form and must be updated.
Do not restore the positional form or edit completed files.
