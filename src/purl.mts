/**
 * @file Buffered and incremental PURL requests with bounded concurrent batches.
 */

import { requestSdkApi } from './api-client.mts'
import {
  assertPositivePurlLimit,
  mergeAsyncGenerators,
} from './utils/async-generators.mts'
import { createCloseableGenerator } from './utils/closeable-generator.mts'
import { iterateNdjsonLines } from './utils/ndjson.mts'

import type { SdkApiContext, SdkApiRequest } from './api-client.mts'
import type { QueryParams, RequestOptionsWithHooks } from './types/core.mts'
import type {
  PurlComponents,
  PurlFetchResult,
  PurlRecord,
  PurlStreamOptions,
  PurlStreamResult,
} from './types/purl.mts'
import type { SocketSdkHttpResponse as HttpResponse } from './types/http.mts'

export function createPurlCancellation(
  context: SdkApiContext,
  signal?: AbortSignal | undefined,
): PurlCancellation {
  const controller = new AbortController()
  const signals = new Set([context.requestOptions.signal, signal])
  function abort(): void {
    controller.abort()
  }
  for (const parent of signals) {
    if (parent?.aborted) {
      abort()
    } else {
      parent?.addEventListener('abort', abort, { once: true })
    }
  }
  return {
    __proto__: null,
    context: {
      ...context,
      requestOptions: { ...context.requestOptions, signal: controller.signal },
    },
    cancel(): void {
      abort()
      for (const parent of signals) {
        parent?.removeEventListener('abort', abort)
      }
    },
  } as PurlCancellation
}

export interface PurlCancellation {
  cancel(): void
  context: SdkApiContext & {
    requestOptions: RequestOptionsWithHooks & { signal: AbortSignal }
  }
}

export function createPurlStream(
  context: SdkApiContext,
  reader: (lifetime: PurlCancellation) => AsyncGenerator<PurlStreamResult>,
  signal?: AbortSignal | undefined,
): AsyncGenerator<PurlStreamResult> {
  let lifetime: PurlCancellation | undefined
  async function* records(): AsyncGenerator<PurlStreamResult> {
    signal?.throwIfAborted()
    context.requestOptions.signal?.throwIfAborted()
    lifetime = createPurlCancellation(context, signal)
    try {
      yield* reader(lifetime)
    } finally {
      lifetime.cancel()
    }
  }
  return createCloseableGenerator(records(), () => lifetime?.cancel())
}

export async function fetchPurlRecords(
  context: SdkApiContext,
  request: SdkApiRequest,
  transform?: PurlRecordTransform | undefined,
): Promise<PurlFetchResult> {
  try {
    const response = await requestSdkApi(context, { ...request, stream: false })
    const data: PurlRecord[] = []
    for await (const record of readPurlResponse(response, transform)) {
      data.push(record)
    }
    return { data, status: response.status, success: true }
  } catch (error) {
    return await context.handleApiError(error)
  }
}

export type PurlRecordTransform = (record: PurlRecord) => PurlRecord

export function isPurlObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function isPurlSpecialRecord(value: Record<string, unknown>): boolean {
  const detail = value['value']
  if (!isPurlObject(detail)) {
    return false
  }
  if (value['_type'] === 'purlError') {
    return (
      typeof detail['inputPurl'] === 'string' &&
      typeof detail['error'] === 'string' &&
      (detail['retryable'] === undefined ||
        typeof detail['retryable'] === 'boolean')
    )
  }
  return value['_type'] === 'summary' && isPurlSummary(detail)
}

export function isPurlSummary(value: Record<string, unknown>): boolean {
  const errors = value['errors']
  if (!isPurlObject(errors)) {
    return false
  }
  return [
    value['purl_input'],
    value['resolved'],
    errors['package_not_found'],
    errors['purl_ecosystem_not_enabled'],
    errors['purl_malformed'],
  ].every(
    count =>
      typeof count === 'number' && Number.isSafeInteger(count) && count >= 0,
  )
}

export async function* iteratePurlResponse(
  response: HttpResponse,
  transform?: PurlRecordTransform | undefined,
): AsyncGenerator<PurlRecord> {
  const raw = response.rawResponse?.readableEnded
    ? undefined
    : response.rawResponse
  try {
    for await (const line of iterateNdjsonLines(raw ?? [response.text()])) {
      if (line.trim().length) {
        const record = parsePurlRecord(line)
        yield transform ? transform(record) : record
      }
    }
  } finally {
    raw?.destroy()
  }
}

export function parsePurlRecord(line: string): PurlRecord {
  const value: unknown = JSON.parse(line)
  if (!isPurlObject(value)) {
    throw new TypeError(
      'Invalid PURL record in response: expected an artifact, error, or summary object; retry the request',
    )
  }
  const valid =
    '_type' in value
      ? isPurlSpecialRecord(value)
      : typeof value['type'] === 'string' && typeof value['name'] === 'string'
  if (!valid) {
    throw new TypeError(
      'Invalid PURL record in response: expected an artifact, error, or summary object; retry the request',
    )
  }
  return value as unknown as PurlRecord
}

export function readPurlResponse(
  response: HttpResponse,
  transform?: PurlRecordTransform | undefined,
): AsyncGenerator<PurlRecord> {
  return createCloseableGenerator(
    iteratePurlResponse(response, transform),
    () => response.rawResponse?.destroy(),
  )
}

export function streamBatchPurlRecords(
  context: SdkApiContext,
  path: string,
  payload: PurlComponents,
  options: PurlStreamOptions<QueryParams> = {},
  transform?: PurlRecordTransform | undefined,
): AsyncGenerator<PurlStreamResult> {
  const {
    chunkSize = 1024,
    concurrencyLimit = 10,
    queryParams,
    signal,
  } = { __proto__: null, ...options } as typeof options
  async function* records(
    lifetime: PurlCancellation,
  ): AsyncGenerator<PurlStreamResult> {
    assertPositivePurlLimit(chunkSize, 'chunkSize')
    assertPositivePurlLimit(concurrencyLimit, 'concurrencyLimit')
    function* batches(): Generator<() => AsyncGenerator<PurlStreamResult>> {
      const { components } = payload
      for (let index = 0; index < components.length; index += chunkSize) {
        if (lifetime.context.requestOptions.signal.aborted) {
          return
        }
        const body = { components: components.slice(index, index + chunkSize) }
        yield () =>
          streamPurlRecords(
            lifetime.context,
            { path, method: 'POST', body, query: queryParams },
            transform,
          )
      }
    }
    yield* mergeAsyncGenerators(batches(), concurrencyLimit, () =>
      lifetime.cancel(),
    )
  }
  return createPurlStream(context, records, signal)
}

export function streamPurlRecords(
  context: SdkApiContext,
  request: SdkApiRequest,
  transform?: PurlRecordTransform | undefined,
): AsyncGenerator<PurlStreamResult> {
  async function* records(
    lifetime: PurlCancellation,
  ): AsyncGenerator<PurlStreamResult> {
    try {
      const response = await requestSdkApi(lifetime.context, {
        ...request,
        stream: true,
      })
      for await (const data of readPurlResponse(response, transform)) {
        yield { data, status: response.status, success: true }
      }
    } catch (error) {
      yield await context.handleApiError(error)
    }
  }
  return createPurlStream(context, records)
}
