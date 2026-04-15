'use strict'

// Re-export from npm-pack bundle for better deduplication.
const { validateNpmPackageName } = require('./npm-pack')
module.exports = validateNpmPackageName
