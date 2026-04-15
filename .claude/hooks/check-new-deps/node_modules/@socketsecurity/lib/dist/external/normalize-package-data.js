'use strict'

// Re-export from npm-pack bundle for better deduplication.
const { normalizePackageData } = require('./npm-pack')
module.exports = normalizePackageData
