#!/usr/bin/env node

/**
 * @fileoverview Script to help rebase and consolidate v2.0 commits
 */

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const run = cmd => execSync(cmd, { encoding: 'utf8' }).trim()

// Get all commits since v1.11.2
const commits = run('git log --format="%H %s" v1.11.2..HEAD')
  .split('\n')
  .reverse() // Oldest first for rebase

console.log(`Found ${commits.length} commits to process`)

// Group commits by category
const groups = {
  claude: [],
  test: [],
  config: [],
  deps: [],
  docs: [],
  scripts: [],
  api: [],
  esm: [],
  features: [],
  other: []
}

// Categorize each commit
commits.forEach(line => {
  const [hash, ...messageParts] = line.split(' ')
  const message = messageParts.join(' ')

  if (message.includes('claude.mjs')) {
    groups.claude.push({ hash, message })
  } else if (message.startsWith('test:')) {
    groups.test.push({ hash, message })
  } else if (message.includes('config') || message.includes('.config') || message.includes('biome') || message.includes('vitest') || message.includes('eslint')) {
    groups.config.push({ hash, message })
  } else if (message.startsWith('deps:')) {
    groups.deps.push({ hash, message })
  } else if (message.startsWith('docs:')) {
    groups.docs.push({ hash, message })
  } else if (message.includes('script') && !message.includes('claude')) {
    groups.scripts.push({ hash, message })
  } else if (message.includes('API') || message.includes('OpenAPI') || message.includes('type definitions')) {
    groups.api.push({ hash, message })
  } else if (message.includes('2.0.0') || message.includes('ESM')) {
    groups.esm.push({ hash, message })
  } else if (message.includes('429') || message.includes('timeout') || message.includes('response size') || message.includes('token validation')) {
    groups.features.push({ hash, message })
  } else {
    groups.other.push({ hash, message })
  }
})

// Print summary
console.log('\nCommit groups:')
Object.entries(groups).forEach(([name, commits]) => {
  if (commits.length > 0) {
    console.log(`  ${name}: ${commits.length} commits`)
  }
})

// Generate rebase todo
const rebaseTodo = []

// Keep important feature commits separate
const importantHashes = new Set([
  '8e940dc', // feat: update OpenAPI type definitions
  '1045efe', // fix: replace yargs-parser with registry parseArgs
  '5755c81', // feat: bump version to 2.0.0
  '3399d38', // Implement 429 rate limit handling
  '5074f6c', // Add default HTTP timeout
  '8e357dc', // Add response size limits
  'cc53fd0', // Add API token validation
])

// Build rebase todo
const processedHashes = new Set()

// First, add all the claude.mjs commits to squash together
if (groups.claude.length > 0) {
  rebaseTodo.push(`pick ${groups.claude[0].hash.substring(0, 7)} ${groups.claude[0].message}`)
  processedHashes.add(groups.claude[0].hash.substring(0, 7))

  for (let i = 1; i < groups.claude.length; i++) {
    const shortHash = groups.claude[i].hash.substring(0, 7)
    if (!importantHashes.has(shortHash)) {
      rebaseTodo.push(`squash ${shortHash} ${groups.claude[i].message}`)
      processedHashes.add(shortHash)
    }
  }
}

// Add test commits to squash
if (groups.test.length > 0) {
  const firstTestCommit = groups.test.find(c => !processedHashes.has(c.hash.substring(0, 7)))
  if (firstTestCommit) {
    rebaseTodo.push(`pick ${firstTestCommit.hash.substring(0, 7)} ${firstTestCommit.message}`)
    processedHashes.add(firstTestCommit.hash.substring(0, 7))

    groups.test.forEach(c => {
      const shortHash = c.hash.substring(0, 7)
      if (!processedHashes.has(shortHash) && !importantHashes.has(shortHash)) {
        rebaseTodo.push(`squash ${shortHash} ${c.message}`)
        processedHashes.add(shortHash)
      }
    })
  }
}

// Add other commits
commits.forEach(line => {
  const [hash] = line.split(' ')
  const shortHash = hash.substring(0, 7)

  if (!processedHashes.has(shortHash)) {
    const [, ...messageParts] = line.split(' ')
    const message = messageParts.join(' ')

    if (importantHashes.has(shortHash)) {
      rebaseTodo.push(`pick ${shortHash} ${message}`)
    } else {
      // Group remaining commits logically
      rebaseTodo.push(`pick ${shortHash} ${message}`)
    }
    processedHashes.add(shortHash)
  }
})

// Write rebase todo file
const todoFile = '/tmp/git-rebase-todo-v2'
writeFileSync(todoFile, rebaseTodo.join('\n'))

console.log(`\nRebase todo written to ${todoFile}`)
console.log('\nTo apply this rebase plan:')
console.log('1. Review the plan: cat /tmp/git-rebase-todo-v2')
console.log('2. Start interactive rebase: GIT_SEQUENCE_EDITOR="cp /tmp/git-rebase-todo-v2" git rebase -i v1.11.2')
console.log('3. Or manually: git rebase -i v1.11.2 and paste the todo content')