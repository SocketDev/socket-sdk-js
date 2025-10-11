/**
 * @fileoverview Fix script that runs lint with auto-fix enabled.
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPath = path.join(__dirname, '..')

// Pass through to lint.mjs with --fix flag.
const args = ['run', 'lint', '--fix', ...process.argv.slice(2)]

const child = spawn('pnpm', args, {
  stdio: 'inherit',
  cwd: rootPath,
  ...(process.platform === 'win32' && { shell: true }),
})

child.on('exit', code => {
  process.exitCode = code || 0
})

child.on('error', error => {
  console.error(`Fix script failed: ${error.message}`)
  process.exitCode = 1
})