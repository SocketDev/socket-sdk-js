/**
 * @file Decide the npm nightly version and whether today's build is already published.
 */

import { appendFileSync } from 'node:fs'
import https from 'node:https'

const STABLE_VERSION = /^(\d+)\.(\d+)\.(\d+)$/u
const NIGHTLY_VERSION = /^\d+\.\d+\.\d+-nightly\.\d{8}$/u
const PACKAGE_NAME =
  /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/u

export interface NightlyPlan {
  skip: boolean
  version: string
}

export interface NpmManifest {
  name: string
  version: string
}

function nightlyPlanError(where: string, saw: string, fix: string): Error {
  return new Error(
    `Nightly plan failed. Where: ${where}. Saw ${saw}. Wanted an npm nightly plan. Fix: ${fix}`,
  )
}

export function utcNightlyDay(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

export function readNightlyEcosystem(argv: readonly string[]): string {
  let ecosystem = ''
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? ''
    if (arg === '--ecosystem') {
      const value = argv[index + 1] ?? ''
      if (!value || value.startsWith('-')) {
        throw nightlyPlanError(
          '--ecosystem',
          'a missing ecosystem name',
          'pass --ecosystem npm.',
        )
      }
      ecosystem = value
      index += 1
      continue
    }
    if (arg.startsWith('--ecosystem=')) {
      ecosystem = arg.slice('--ecosystem='.length)
      continue
    }
    throw nightlyPlanError(
      'argv',
      arg,
      'pass only --ecosystem npm.',
    )
  }
  return ecosystem
}

export function readNpmManifest(text: string): NpmManifest {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw nightlyPlanError(
      'package.json',
      'invalid JSON',
      'restore the package manifest.',
    )
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw nightlyPlanError(
      'package.json',
      'a non-object manifest',
      'restore the package manifest.',
    )
  }
  const name = Reflect.get(parsed, 'name')
  const version = Reflect.get(parsed, 'version')
  if (typeof name !== 'string' || typeof version !== 'string') {
    throw nightlyPlanError(
      'package.json',
      'a missing name or version',
      'set name and version in the manifest.',
    )
  }
  return { name, version }
}

export function nightlyVersionForStable(version: string, day: string): string {
  const match = STABLE_VERSION.exec(version)
  if (!match || !/^\d{8}$/u.test(day)) {
    throw nightlyPlanError(
      `package version ${version} and day ${day}`,
      'a value that is not X.Y.Z plus YYYYMMDD',
      'plan from the stable package.json version.',
    )
  }
  return `${match[1]}.${match[2]}.${match[3]}-nightly.${day}`
}

export function npmVersionUrl(name: string, version: string): string {
  if (!PACKAGE_NAME.test(name) || !NIGHTLY_VERSION.test(version)) {
    throw nightlyPlanError(
      'npm registry URL',
      `name ${name} and version ${version}`,
      'plan a nightly from the package name and stable version.',
    )
  }
  return `https://registry.npmjs.org/${name.replaceAll('/', '%2f')}/${version}`
}

function requestNpmStatus(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      { headers: { accept: 'application/json' } },
      response => {
        response.resume()
        resolve(response.statusCode ?? 0)
      },
    )
    request.setTimeout(20_000, () => {
      request.destroy(
        nightlyPlanError(
          url,
          'a timeout',
          'retry the nightly plan.',
        ),
      )
    })
    request.on('error', reject)
  })
}

export async function npmVersionIsPublished(url: string): Promise<boolean> {
  const status = await requestNpmStatus(url)
  if (status === 200) {
    return true
  }
  if (status === 404) {
    return false
  }
  throw nightlyPlanError(
    url,
    `HTTP ${status}`,
    'retry when the npm registry answers 200 or 404.',
  )
}

export function writeNightlyOutputs(
  plan: NightlyPlan,
  outputPath: string | undefined,
): void {
  if (!NIGHTLY_VERSION.test(plan.version)) {
    throw nightlyPlanError(
      'GitHub output',
      `version ${plan.version}`,
      'plan an X.Y.Z-nightly.YYYYMMDD version.',
    )
  }
  if (!outputPath) {
    return
  }
  const skip = plan.skip ? 'true' : 'false'
  appendFileSync(outputPath, `skip=${skip}\nversion=${plan.version}\n`)
}

export async function planNpmNightly(config: {
  argv: readonly string[]
  day: string
  manifestText: string
  outputPath: string | undefined
  published?: (url: string) => Promise<boolean>
}): Promise<NightlyPlan> {
  const ecosystem = readNightlyEcosystem(config.argv)
  if (ecosystem !== 'npm') {
    throw nightlyPlanError(
      '--ecosystem',
      ecosystem || 'a missing ecosystem',
      'pass --ecosystem npm.',
    )
  }
  const manifest = readNpmManifest(config.manifestText)
  const version = nightlyVersionForStable(manifest.version, config.day)
  const published = await (config.published ?? npmVersionIsPublished)(
    npmVersionUrl(manifest.name, version),
  )
  const plan = { skip: published, version }
  writeNightlyOutputs(plan, config.outputPath)
  return plan
}
