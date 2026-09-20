# User validation

The API and CLI expose different result shapes but share one validation policy.
Required-name errors precede format errors, which precede role errors. Existing
exports and exact messages are public behavior.
