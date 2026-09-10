/**
 * @file Advanced patch verification bundle download for authorized
 *   organizations.
 */
import { requestSdkBytes } from './api-client.mts'
import { createOrgApiPath } from './org-api.mts'

import type { SdkApiContext } from './api-client.mts'

export function downloadOrgPatchVerificationBundle(
  context: SdkApiContext,
  orgSlug: string,
  uuid: string,
) {
  return requestSdkBytes(context, {
    maxResponseSize: 100 * 1024 * 1024,
    path: createOrgApiPath(orgSlug, 'patches', 'verify-bundle', uuid),
  })
}
