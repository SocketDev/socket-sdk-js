import type { MultipartFormConstructor } from '../file-upload.mts'

/**
 * Declared structurally via `MultipartFormConstructor` so the published
 * declarations never import the `form-data` package, which consumers of this
 * zero-runtime-dependency SDK do not install.
 */
declare const FormData: MultipartFormConstructor
export default FormData
