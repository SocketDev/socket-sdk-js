/**
 * @file Organization API path construction.
 */
export function createOrgApiPath(
  orgSlug: string,
  ...segments: string[]
): string {
  return ['orgs', orgSlug, ...segments].map(encodeURIComponent).join('/')
}
