import { isReleaseTagName } from './release-tags.mts'

const ZERO_SHA = '0000000000000000000000000000000000000000'

export interface PushRefUpdate {
  localRef: string
  localSha: string
  remoteRef: string
  remoteSha: string
}

export function parsePushRefUpdates(
  refLines: readonly string[],
): PushRefUpdate[] {
  const updates: PushRefUpdate[] = []
  for (let i = 0, { length } = refLines; i < length; i += 1) {
    const parts = refLines[i]!.trim().split(/\s+/u)
    const [localRef, localSha, remoteRef, remoteSha] = parts
    if (localRef && localSha && remoteRef && remoteSha) {
      updates.push({ localRef, localSha, remoteRef, remoteSha })
    }
  }
  return updates
}

export function releaseTagMutationError(
  updates: readonly PushRefUpdate[],
): string | undefined {
  for (let i = 0, { length } = updates; i < length; i += 1) {
    const update = updates[i]!
    const tag = update.remoteRef.replace(/^refs\/tags\//u, '')
    if (!update.remoteRef.startsWith('refs/tags/') || !isReleaseTagName(tag)) {
      continue
    }
    if (update.localSha === ZERO_SHA) {
      return `Release tag ${tag} cannot be deleted.`
    }
    if (update.remoteSha !== ZERO_SHA && update.localSha !== update.remoteSha) {
      return `Release tag ${tag} cannot be moved.`
    }
  }
  return undefined
}

export function isReleaseTagCreationOnly(
  updates: readonly PushRefUpdate[],
): boolean {
  return (
    updates.length > 0 &&
    updates.every(update => {
      const tag = update.remoteRef.replace(/^refs\/tags\//u, '')
      return (
        update.remoteRef.startsWith('refs/tags/') &&
        isReleaseTagName(tag) &&
        update.localSha !== ZERO_SHA &&
        update.remoteSha === ZERO_SHA
      )
    })
  )
}
