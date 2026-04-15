'use strict'

// Re-export from external-pack bundle for better deduplication.
const { confirm } = require('../external-pack')
module.exports = confirm
