#!/usr/bin/env node
/**
 * @file `setup:rust` — provision the Rust toolchain and fetch crates through
 *   the locked path, so a dev machine gets exactly what CI gets.
 *   Self-detecting: skips with a clear line unless the repo has a first-party
 *   `Cargo.toml`. Requires `rustup` (it never `curl | sh` — it fails loud with
 *   the install instruction), installs the `rust-toolchain.toml` pin when
 *   present, then runs `cargo fetch --locked` per manifest dir so the
 *   dependency set is exactly the soaked `Cargo.lock`.
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'

import { findOwnCargoManifests } from '../update/cargo.mts'
import { resolveEcosystemOptions, skipResult } from './ecosystems.mts'
import { isMainModule } from '../_shared/is-main-module.mts'

import type {
  EcosystemStepOptions,
  EcosystemStepResult,
} from './ecosystems.mts'

/**
 * Extract the pinned toolchain channel from a `rust-toolchain.toml` body — the
 * `channel = "…"` key under the `[toolchain]` table. Also tolerates a legacy
 * bare-channel file (the whole trimmed body is the channel, e.g. `1.96.1`).
 * Returns undefined when no channel is declared.
 */
export function parseRustToolchainPin(tomlText: string): string | undefined {
  let inToolchain = false
  for (const rawLine of tomlText.split(/\r?\n/)) {
    const line = (rawLine.split('#')[0] ?? '').trim()
    if (line === '') {
      continue
    }
    const section = /^\[([^\]]+)\]$/.exec(line)
    if (section) {
      inToolchain = section[1]!.trim() === 'toolchain'
      continue
    }
    if (inToolchain) {
      const match = /^channel\s*=\s*["']([^"']+)["']/.exec(line)
      if (match) {
        return match[1]!
      }
    }
  }
  const bare = tomlText.trim()
  if (bare !== '' && !bare.includes('[') && !bare.includes('=')) {
    return bare.split(/\s+/)[0]
  }
  return undefined
}

/**
 * The skip reason for `setup:rust`, or undefined when the step should run. Pure
 * over the manifest count so the decision is unit-testable without a
 * filesystem.
 */
export function rustSkipReason(options: {
  readonly manifestCount: number
}): string | undefined {
  return options.manifestCount > 0
    ? undefined
    : 'no first-party Cargo.toml (repo has no Rust crates)'
}

/**
 * Ensure the pinned Rust toolchain is installed and every first-party crate's
 * dependencies are fetched from the committed `Cargo.lock`.
 */
export async function setupRust(
  options?: EcosystemStepOptions | undefined,
): Promise<EcosystemStepResult> {
  const { commandExists, logger, repoRoot, runCommand } =
    resolveEcosystemOptions(options)
  const manifests = findOwnCargoManifests(repoRoot)
  const skip = rustSkipReason({ manifestCount: manifests.length })
  if (skip) {
    return skipResult(logger, 'setup:rust', skip)
  }
  if (!(await commandExists('rustup'))) {
    logger.fail(
      'setup:rust: rustup is not installed.\n' +
        '  Where: this dev machine (a first-party Cargo.toml is present).\n' +
        '  Saw: no rustup on PATH; wanted the Rust toolchain manager.\n' +
        '  Fix: install rustup from https://rustup.rs, then re-run pnpm run setup:rust.',
    )
    return { ok: false, reason: 'rustup not installed', skipped: false }
  }
  const pinFile = path.join(repoRoot, 'rust-toolchain.toml')
  if (existsSync(pinFile)) {
    const channel = parseRustToolchainPin(readFileSync(pinFile, 'utf8'))
    if (channel) {
      logger.log(`setup:rust — ensuring toolchain ${channel}`)
      // rustup toolchain install is idempotent — it no-ops when the pin is
      // already present, so this installs the pin only when missing.
      const installed = await runCommand('rustup', [
        'toolchain',
        'install',
        channel,
      ])
      if (installed.exitCode !== 0) {
        logger.fail(
          `setup:rust: rustup could not install toolchain ${channel}.\n` +
            `  Where: rustup toolchain install ${channel}.\n` +
            `  Saw: exit ${installed.exitCode}; wanted the pinned toolchain present.\n` +
            '  Fix: check network + the rust-toolchain.toml channel, then re-run.',
        )
        return {
          ok: false,
          reason: `toolchain ${channel} install failed`,
          skipped: false,
        }
      }
    }
  }
  for (const manifest of manifests) {
    const dir = path.dirname(manifest)
    logger.log(
      `setup:rust — cargo fetch --locked (${path.relative(repoRoot, dir) || '.'})`,
    )
    const fetched = await runCommand('cargo', ['fetch', '--locked'], {
      cwd: dir,
    })
    if (fetched.exitCode !== 0) {
      logger.fail(
        `setup:rust: cargo fetch --locked failed in ${dir}.\n` +
          `  Where: cargo fetch --locked (cwd ${dir}).\n` +
          `  Saw: exit ${fetched.exitCode}; wanted every crate resolved from the committed Cargo.lock.\n` +
          '  Fix: run pnpm run update (or cargo generate-lockfile) to refresh the lock, then re-run.',
      )
      return { ok: false, reason: 'cargo fetch failed', skipped: false }
    }
  }
  logger.log(`setup:rust — fetched crates for ${manifests.length} manifest(s).`)
  return { ok: true, skipped: false }
}

if (isMainModule(import.meta.url)) {
  setupRust().then(
    result => {
      if (!result.ok) {
        process.exitCode = 1
      }
    },
    (e: unknown) => {
      getDefaultLogger().error(e)
      process.exitCode = 1
    },
  )
}
