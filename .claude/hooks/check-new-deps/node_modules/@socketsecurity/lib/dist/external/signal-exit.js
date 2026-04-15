'use strict'

// Re-export from external-pack bundle for better deduplication.
const { signalExit } = require('./external-pack')
module.exports = signalExit
