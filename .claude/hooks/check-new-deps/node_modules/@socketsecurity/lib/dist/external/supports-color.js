'use strict'

// Re-export from external-pack bundle for better deduplication.
const { supportsColor } = require('./external-pack')
// supports-color is an ESM module, re-export all properties.
const exported = supportsColor.default || supportsColor
Object.assign(module.exports, exported)
module.exports.default = exported
