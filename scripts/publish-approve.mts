/**
 * @file Approve the most-recently-staged version of this package on npm.
 *   Companion to `pnpm publish --stage` for socket-sdk-js. Two-step publish
 *   workflow:
 *
 *   1. CI runs `pnpm run publish:stage` — uploads the SDK tarball to npm staging
 *      via the OIDC trusted-publisher token. Nothing publicly visible yet.
 *   2. Human runs `pnpm run publish:approve` — this script lists the user's
 *      currently-staged packages, filters to the entry matching the package
 *      name + current version, and calls `pnpm stage approve <id>`. `pnpm stage
 *      approve` interactively prompts for 2FA OTP; the registry then promotes
 *      the staged tarball to its public dist-tag. The split exists because
 *      `pnpm stage approve` requires a human 2FA approval; the CI workflow
 *      can't supply OTP. Keeping promotion gated on a human's 2FA token
 *      preserves the OIDC + provenance attestation from the stage-publish leg.
 *      Flags: `--dry-run` (report-only), `--otp <code>` (pre-supply OTP),
 *      `--reject` (discard staged tarball instead of promoting).
 */

// oxlint-disable-next-line socket/prefer-async-spawn -- streaming stdio required to forward `pnpm stage approve` 2FA prompts.
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { parseArgs } from '@socketsecurity/lib-stable/argv/parse'
import { getDefaultLogger } from '@socketsecurity/lib-stable/logger'

const logger = getDefaultLogger()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPath = path.join(__dirname, '..')
const WIN32 = process.platform === 'win32'

/**
 * One entry from `pnpm stage list --json`. The full shape includes more fields;
 * we only need the few we filter on. Keying is `<name>@<version>` inside the
 * top-level object.
 */
interface StageListEntry {
  name?: string
  version?: string
  stageId?: string
  id?: string
}

async function main(): Promise<void> {
  try {
    const { values } = parseArgs({
      options: {
        'dry-run': { default: false, type: 'boolean' },
        help: { default: false, type: 'boolean' },
        otp: { type: 'string' },
        reject: { default: false, type: 'boolean' },
      },
      allowPositionals: false,
      strict: false,
    })

    if (values['help']) {
      logger.log('')
      logger.log('Usage: pnpm publish:approve [options]')
      logger.log('')
      logger.log('Options:')
      logger.log('  --help         Show this help message')
      logger.log('  --dry-run      Report what would be approved, no calls')
      logger.log(
        '  --otp <code>   Pre-supply 2FA OTP (skips interactive prompt)',
      )
      logger.log(
        '  --reject       Reject the staged tarball instead of approving',
      )
      logger.log('')
      logger.log('Examples:')
      logger.log(
        '  pnpm run publish:approve              # approve current version',
      )
      logger.log(
        '  pnpm run publish:approve --reject     # discard staged tarball',
      )
      process.exitCode = 0
      return
    }

    const dryRun = !!values['dry-run']
    const otp = typeof values['otp'] === 'string' ? values['otp'] : undefined
    const reject = !!values['reject']

    const pkgJson = JSON.parse(
      await fs.readFile(path.join(rootPath, 'package.json'), 'utf8'),
    ) as { name: string; version: string }
    const { name, version } = pkgJson

    logger.log('')
    logger.log(`Looking for staged ${name}@${version}…`)
    const stageId = await findStageIdForCurrentVersion(name, version)
    if (!stageId) {
      logger.fail(
        `No staged ${name}@${version} found. Did you run \`pnpm run publish:stage\` first?`,
      )
      process.exitCode = 1
      return
    }
    logger.log(`Found stage id: ${stageId}`)

    const verb = reject ? 'reject' : 'approve'
    if (dryRun) {
      logger.log(`[dry-run] pnpm stage ${verb} ${stageId}`)
      process.exitCode = 0
      return
    }

    const stageArgs = ['stage', verb, stageId]
    if (otp) {
      stageArgs.push('--otp', otp)
    }
    const code = await runCommand('pnpm', stageArgs)
    if (code !== 0) {
      logger.fail(`pnpm stage ${verb} ${stageId} exited with status ${code}`)
      process.exitCode = code ?? 1
      return
    }
    logger.success(`${name}@${version} ${reject ? 'rejected' : 'approved'}`)
    process.exitCode = 0
  } catch (e) {
    logger.error(e)
    process.exitCode = 1
  }
}

main().catch((e: unknown) => {
  logger.error(e)
  process.exitCode = 1
})

/**
 * Run `pnpm stage list --json` and find the entry for the given package +
 * version. Returns the stageId, or undefined if no match.
 *
 * `pnpm stage list` output shape is a top-level object keyed by
 * `<name>@<version>` with the entry as the value. We don't rely on the key
 * matching exactly because pnpm formats stdout with surrounding progress lines;
 * instead we parse the first balanced JSON object and scan its values for one
 * whose name + version match.
 */
export async function findStageIdForCurrentVersion(
  name: string,
  version: string,
): Promise<string | undefined> {
  const { stdout } = await runCommandWithOutput('pnpm', [
    'stage',
    'list',
    '--json',
  ])
  const startIdx = stdout.indexOf('{')
  if (startIdx === -1) {
    return undefined
  }
  // Find a balanced JSON object starting at startIdx.
  let depth = 0
  let endIdx = -1
  let inString = false
  let escape = false
  for (let i = startIdx, { length } = stdout; i < length; i += 1) {
    const ch = stdout[i]!
    if (escape) {
      escape = false
      continue
    }
    if (ch === '\\') {
      escape = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) {
      continue
    }
    if (ch === '{') {
      depth += 1
    } else if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        endIdx = i + 1
        break
      }
    }
  }
  if (endIdx === -1) {
    return undefined
  }
  let parsed: Record<string, StageListEntry | undefined>
  try {
    parsed = JSON.parse(stdout.slice(startIdx, endIdx)) as Record<
      string,
      StageListEntry | undefined
    >
  } catch {
    return undefined
  }
  // Prefer key lookup (`<name>@<version>`).
  const key = `${name}@${version}`
  if (parsed[key]?.stageId) {
    return parsed[key].stageId
  }
  // Fall back to value scan (in case pnpm changes the key format).
  for (const entry of Object.values(parsed)) {
    if (entry?.name === name && entry?.version === version && entry?.stageId) {
      return entry.stageId
    }
  }
  return undefined
}

/**
 * Spawn a command and forward stdio. Returns the exit code.
 */
function runCommand(cmd: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: rootPath,
      shell: WIN32,
      stdio: 'inherit',
    })
    child.on('error', reject)
    child.on('exit', code => {
      resolve(code ?? 0)
    })
  })
}

/**
 * Spawn a command and capture stdout + stderr. Returns the trimmed text.
 */
function runCommandWithOutput(
  cmd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: rootPath,
      shell: WIN32,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', chunk => {
      stdout += chunk.toString('utf8')
    })
    child.stderr?.on('data', chunk => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', reject)
    child.on('exit', code => {
      resolve({ stdout, stderr, code: code ?? 0 })
    })
  })
}
