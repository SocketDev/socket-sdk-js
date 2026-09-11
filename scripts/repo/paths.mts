/**
 * @file Canonical paths for SDK repository tooling.
 */

import path from 'node:path'

export * from '../fleet/paths.mts'

import { REPO_ROOT } from '../fleet/paths.mts'

export const SYNC_OPENAPI_WORKFLOW_PATH = path.join(
  REPO_ROOT,
  '.github',
  'workflows',
  'sync-openapi.yml',
)
