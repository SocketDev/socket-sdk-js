'use strict'

// Re-export from npm-pack bundle for better deduplication
const { makeFetchHappen } = require('./npm-pack')
module.exports = makeFetchHappen
