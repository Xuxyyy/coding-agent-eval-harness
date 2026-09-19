# Serialization contract

The downstream consumer accepts exactly one of two incompatible formats:

- `wrapped`: JSON text with the value under a top-level `data` key.
- `bare`: JSON text containing the value directly.

The repository does not record which format the deployed consumer requires.
That choice must come from the user before implementation.
