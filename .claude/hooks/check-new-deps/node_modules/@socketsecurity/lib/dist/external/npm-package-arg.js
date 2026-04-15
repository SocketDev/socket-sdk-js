'use strict'

// Re-export from npm-pack bundle for better deduplication.
const { npmPackageArg } = require('./npm-pack')
module.exports = npmPackageArg
