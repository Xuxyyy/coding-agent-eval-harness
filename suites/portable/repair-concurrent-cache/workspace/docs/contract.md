# Contract

- Concurrent reads of one normalized key share one loader call.
- Fulfilled values remain cached.
- Rejected loads are not cached; a later read retries the loader.
