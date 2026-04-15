'use strict'

// Re-export from external-pack bundle for better deduplication.
const { yoctocolorsCjs } = require('./external-pack')
module.exports = yoctocolorsCjs
module.exports.default = yoctocolorsCjs
