#!/usr/bin/env node

/**
 * @fileoverview Aggressive rebase script to consolidate v2.0 commits into ~15 logical commits
 */

import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const run = cmd => execSync(cmd, { encoding: 'utf8' }).trim()

// Get all commits since v1.11.2
const commits = run('git rev-list --format="%H %s" --reverse v1.11.2..HEAD | grep -v ^commit')
  .split('\n')
  .map(line => {
    const [hash, ...rest] = line.split(' ')
    return { hash: hash.substring(0, 7), message: rest.join(' ') }
  })

console.log(`Found ${commits.length} commits to consolidate into ~15 commits\n`)

// Define the consolidated commit structure
// Each group will become ONE commit with a comprehensive message
const consolidationPlan = [
  {
    name: "docs: improve documentation structure and tone",
    pattern: /docs:|documentation|README|CLAUDE.md|marketing language/i,
    commits: []
  },
  {
    name: "build: update configuration and build system",
    pattern: /build:|config|vitest|eslint|biome|tsconfig|esbuild|oxlint|knip|\.config/i,
    commits: []
  },
  {
    name: "deps: update and clean up dependencies",
    pattern: /deps:|dependencies|lockfile|del package|yargs-parser/i,
    commits: []
  },
  {
    name: "test: improve test infrastructure and coverage",
    pattern: /test:|coverage|test\-/i,
    commits: []
  },
  {
    name: "refactor: enhance script tooling and utilities",
    pattern: /script|claude\.mjs|bump\.mjs|update\.mjs|clean\.mjs|test\.mjs|utils|getRootPath|IIFE|main\(\)/i,
    commits: [],
    exclude: /test:/
  },
  {
    name: "feat: add API token validation",
    pattern: /API token validation/i,
    commits: [],
    keepSeparate: true
  },
  {
    name: "feat: add HTTP client enhancements (timeouts, size limits, rate limiting)",
    pattern: /429|rate limit|timeout|response size|stream size|resilient defaults/i,
    commits: []
  },
  {
    name: "feat: update OpenAPI types and SDK methods",
    pattern: /OpenAPI|API types|types\.ts|api\.d\.ts|SDK method/i,
    commits: []
  },
  {
    name: "refactor: reorganize file structure and requirements",
    pattern: /requirements\.json|quota-utils|data\/sdk-method/i,
    commits: []
  },
  {
    name: "fix: various bug fixes and improvements",
    pattern: /fix:|chore:|refactor:/i,
    commits: [],
    exclude: /test:|script|config|deps:|build:/,
    isDefault: true  // Catch-all for remaining fixes
  },
  {
    name: "feat: migrate to ESM and bump to v2.0.0",
    pattern: /2\.0\.0|ESM|module type/i,
    commits: [],
    keepSeparate: true
  }
]

// Categorize commits
commits.forEach(commit => {
  let categorized = false

  for (const group of consolidationPlan) {
    // Check if commit should be excluded from this group
    if (group.exclude && group.exclude.test(commit.message)) {
      continue
    }

    // Check if commit matches this group
    if (group.pattern.test(commit.message)) {
      group.commits.push(commit)
      categorized = true
      break
    }
  }

  // If not categorized, add to the default catch-all group
  if (!categorized) {
    const defaultGroup = consolidationPlan.find(g => g.isDefault)
    if (defaultGroup) {
      defaultGroup.commits.push(commit)
    }
  }
})

// Generate rebase todo
const rebaseTodo = []
const processedHashes = new Set()

// Process each consolidation group
consolidationPlan.forEach(group => {
  if (group.commits.length === 0) return

  console.log(`${group.name}: ${group.commits.length} commits`)

  if (group.keepSeparate && group.commits.length === 1) {
    // Keep this commit separate
    rebaseTodo.push(`pick ${group.commits[0].hash} ${group.commits[0].message}`)
    processedHashes.add(group.commits[0].hash)
  } else if (group.commits.length > 0) {
    // First commit in group is picked, rest are squashed
    const first = group.commits[0]
    rebaseTodo.push(`pick ${first.hash} ${first.message}`)
    processedHashes.add(first.hash)

    // Squash the rest
    for (let i = 1; i < group.commits.length; i++) {
      const commit = group.commits[i]
      rebaseTodo.push(`squash ${commit.hash} ${commit.message}`)
      processedHashes.add(commit.hash)
    }

    // Add a comment for what this will become
    rebaseTodo.push(`# Will become: ${group.name}`)
  }
})

// Check for any unprocessed commits
const unprocessed = commits.filter(c => !processedHashes.has(c.hash))
if (unprocessed.length > 0) {
  console.log(`\nWarning: ${unprocessed.length} unprocessed commits:`)
  unprocessed.forEach(c => console.log(`  ${c.hash} ${c.message}`))
}

// Write rebase todo
const todoFile = '/tmp/git-rebase-todo-aggressive'
writeFileSync(todoFile, rebaseTodo.join('\n'))

// Calculate final commit count
const finalCommitCount = consolidationPlan.filter(g => g.commits.length > 0).length
console.log(`\n✅ Will consolidate ${commits.length} commits into ~${finalCommitCount} commits`)

console.log(`\nRebase todo written to ${todoFile}`)
console.log('\nCommit messages to use after squashing:')
consolidationPlan.forEach(group => {
  if (group.commits.length > 1) {
    console.log(`  - ${group.name}`)
  }
})

console.log('\nTo apply this aggressive consolidation:')
console.log('1. Review: cat /tmp/git-rebase-todo-aggressive')
console.log('2. Apply: GIT_SEQUENCE_EDITOR="cp /tmp/git-rebase-todo-aggressive" git rebase -i v1.11.2')
console.log('3. Edit each squashed commit message to use the consolidated descriptions above')