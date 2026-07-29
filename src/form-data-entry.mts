/**
 * @file Standalone bundle entry for `form-data`. The SDK ships zero runtime
 *   dependencies, so form-data must be IN the bundle — but its module body
 *   binds node:http's native HTTPParser at eval, which breaks V8 startup
 *   snapshots when it loads with the main entry. Building it as its own CJS
 *   chunk keeps the bytes in the package while `getFormData()` in
 *   `file-upload.mts` defers the require (and therefore the eval) to the
 *   first multipart upload.
 */

import FormDataCtor from 'form-data'

import type { MultipartFormConstructor } from './file-upload.mts'

// Annotated structurally so the emitted declaration file does not import
// the form-data package consumers never install.
export const FormData: MultipartFormConstructor =
  FormDataCtor as unknown as MultipartFormConstructor
