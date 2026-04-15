'use strict'

// Re-export from spdx-pack bundle for better deduplication.
const { spdxExpressionParse } = require('./spdx-pack')
module.exports = spdxExpressionParse
