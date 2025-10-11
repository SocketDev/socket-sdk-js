/**
 * @fileoverview Git utilities for socket-sdk-js.
 * Re-exports git functions from the registry package.
 */

export {
  getChangedFiles,
  getChangedFilesSync,
  getStagedFiles,
  getStagedFilesSync,
  getUnstagedFiles,
  getUnstagedFilesSync,
} from '@socketsecurity/registry/lib/git'
