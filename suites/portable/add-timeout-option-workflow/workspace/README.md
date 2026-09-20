# Options workflow

Option defaults are authored in `definitions/options.js`. The generated source
must be updated through `npm run generate`. Resolution order is defaults,
project configuration, environment, then explicit CLI values in the app.
