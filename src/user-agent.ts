/**
 * Generate a User-Agent string from package.json data.
 * Creates standardized User-Agent format with optional homepage URL.
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
