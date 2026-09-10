/**
 * @file Published Socket SDK transport types match the bundled transport.
 */
import { expectTypeOf, it } from 'vitest'

import type { HttpResponse } from '@socketsecurity/lib/http-request/response-types'
import type { JsonValue } from '@socketsecurity/lib/json/types'
import type { Remap } from '@socketsecurity/lib/objects/types'
import type { SocketSdkHttpResponse } from '../../../src/types/http.mts'
import type {
  RemapSdkType,
  SocketSdkJsonValue,
} from '../../../src/types/util.mts'

it('accepts the bundled HTTP response and preserves concrete transport fields', () => {
  expectTypeOf<HttpResponse>().toExtend<SocketSdkHttpResponse>()
  expectTypeOf<Omit<SocketSdkHttpResponse, 'json'>>().toEqualTypeOf<
    Omit<HttpResponse, 'json'>
  >()
  expectTypeOf<ReturnType<SocketSdkHttpResponse['json']>>().toBeUnknown()
})

it('preserves JSON values in both directions', () => {
  expectTypeOf<SocketSdkJsonValue>().toExtend<JsonValue>()
  expectTypeOf<JsonValue>().toExtend<SocketSdkJsonValue>()
})

it('preserves optional properties when remapping SDK types', () => {
  type Fields = { name: string; revision?: number | undefined }
  expectTypeOf<RemapSdkType<Fields>>().toEqualTypeOf<Remap<Fields>>()
})
