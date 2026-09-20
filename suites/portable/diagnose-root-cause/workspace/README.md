# Cache key contract

`buildCacheKey(route)` splits a route on literal `/` separators and decodes each
segment independently. An encoded slash (`%2F`) belongs to one segment and must
not create another cache-key boundary.

This task is investigation-only. Report the cause without editing files.
