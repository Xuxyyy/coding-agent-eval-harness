# Request headers

`createRequest(url, options)` returns exactly `method`, `url`, and `headers`.
Default headers are merged before caller headers. Header names are compared
case-insensitively, and the caller wins a conflict without losing the caller's
key spelling. Merging must not mutate either input object.
