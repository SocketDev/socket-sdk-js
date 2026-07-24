/**
 * @file User-Agent string generation utilities. Creates standardized User-Agent
 *   headers from package.json data for API requests.
 */

import os from 'node:os'
import process from 'node:process'

/**
 * Build the SDK's base User-Agent string, including the SDK name/version, the
 * running Node.js version, and the OS platform and architecture. This is used
 * as the default User-Agent for API requests; a caller-supplied token (built
 * with `createUserAgentFromPkgJson`) is appended to it rather than replacing
 * it.
 *
 * Example output: `socketsecurity-sdk/4.0.4 node/v24.14.1 linux/arm64`
 */
export function buildSdkBaseUserAgent(pkgData: {
  name: string
  version: string
}): string {
  const name = pkgData.name.replace('@', '').replace('/', '-')
  return [
    `${name}/${pkgData.version}`,
    `node/${process.version}`,
    `${os.platform()}/${os.arch()}`,
  ].join(' ')
}

/**
 * Generate a User-Agent string from package.json data. Creates standardized
 * User-Agent format with optional homepage URL. Pass the result as `userAgent`
 * in `SocketSdkOptions` to identify your application; it is appended to the
 * SDK's own base User-Agent string.
 */
export function createUserAgentFromPkgJson(pkgData: {
  name: string
  version: string
  homepage?: string | undefined
}): string {
  const { homepage } = pkgData
  const name = pkgData.name.replace('@', '').replace('/', '-')
  /* c8 ignore next - homepage URL is optional in package.json */
  return `${name}/${pkgData.version}${homepage ? ` (${homepage})` : ''}`
}
