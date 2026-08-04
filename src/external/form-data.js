'use strict'

// Self-contained form-data bundle entry point.
//
// Routing through here keeps the specifier a static literal the bundler can
// follow, so form-data's bytes land INSIDE the SDK bundle. A dynamic
// `createRequire(...)('form-data')` is invisible to bundlers, so it survived
// into the published output as an unresolvable runtime require and took a
// customer's CI down (CE-356).
module.exports = require('form-data')
