'use strict'

// Re-export from external-pack bundle for better deduplication.
const { hasFlag } = require('./external-pack')
// has-flag is an ESM module with default export.
module.exports = hasFlag.default || hasFlag
