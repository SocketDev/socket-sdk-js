import { HTTPError } from 'got'
import { ErrorWithCause } from 'pony-cause'

/**
 * @param {unknown} value
 * @returns {value is { [key: string]: unknown }}
 */
 function ensureObject (value) {
  return !!(value && typeof value === 'object' && !Array.isArray(value))
}

/**
 * @param {HTTPError} err
 * @returns {Record<string,unknown>}
 */
 function getApiErrorDescription (err) {
  /** @type {unknown} */
  let rawBody

  try {
    rawBody = JSON.parse(/** @type {string} */ (err.response.body))
  } catch (cause) {
    throw new ErrorWithCause('Could not parse API error response', { cause })
  }

  const errorDescription = ensureObject(rawBody) ? rawBody['error'] : undefined

  if (!ensureObject(errorDescription)) {
    throw new Error('Invalid body on API error response')
  }

  return errorDescription
}

/**
 * @param {unknown} err
 * @returns {{ success: false, status: number, error: Record<string,unknown> }}
 */
export function handleApiError (err) {
  if (err instanceof HTTPError) {
    if (err.response.statusCode >= 500) {
      throw new ErrorWithCause('API returned an error', { cause: err })
    }

    return {
      success: false,
      status: err.response.statusCode,
      error: getApiErrorDescription(err)
    }
  }

  throw new ErrorWithCause('Unexpected error when calling API', { cause: err })
}
