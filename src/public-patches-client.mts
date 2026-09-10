/**
 * @file Public free-tier patch search, package references, and binary
 *   downloads.
 */

import {
  createSdkApiContext,
  requestSdkBytes,
  requestSdkJson,
} from './api-client.mts'

import type { SdkApiContext } from './api-client.mts'
import type { SocketSdkGenericResult } from './types/core.mts'
import type {
  GetPatchPackagesResponse,
  PatchesBatchResponse,
  PatchSearchResponse,
  PatchViewResponse,
} from './types/patches.mts'
import type { PublicApiClientOptions, PurlComponents } from './types/purl.mts'

export const SOCKET_PATCH_API_URL = 'https://patches-api.socket.dev/'

export type SocketPatchClientOptions = Omit<
  PublicApiClientOptions,
  'apiToken' | 'authScheme'
>

export class SocketPatchClient {
  readonly #context: SdkApiContext

  constructor(options: SocketPatchClientOptions = {}) {
    const opts = { __proto__: null, ...options } as typeof options
    this.#context = createSdkApiContext({
      ...opts,
      apiToken: undefined,
      baseUrl: opts.baseUrl ?? SOCKET_PATCH_API_URL,
    })
  }

  fetchPatchesByCVE(
    cveId: string,
  ): Promise<SocketSdkGenericResult<PatchSearchResponse>> {
    return requestSdkJson(this.#context, {
      path: `patch/by-cve/${encodeURIComponent(cveId)}`,
    })
  }

  fetchPatchesByGHSA(
    ghsaId: string,
  ): Promise<SocketSdkGenericResult<PatchSearchResponse>> {
    return requestSdkJson(this.#context, {
      path: `patch/by-ghsa/${encodeURIComponent(ghsaId)}`,
    })
  }

  fetchPatchesByPackage(
    purl: string,
  ): Promise<SocketSdkGenericResult<PatchSearchResponse>> {
    return requestSdkJson(this.#context, {
      path: `patch/by-package/${encodeURIComponent(purl)}`,
    })
  }

  viewPatch(uuid: string): Promise<SocketSdkGenericResult<PatchViewResponse>> {
    return requestSdkJson(this.#context, {
      path: `patch/view/${encodeURIComponent(uuid)}`,
    })
  }

  fetchPatches(
    payload: PurlComponents,
  ): Promise<SocketSdkGenericResult<PatchesBatchResponse>> {
    return requestSdkJson(this.#context, {
      path: 'patch/batch',
      method: 'POST',
      body: payload,
    })
  }

  getPatchPackages(
    uuids: string[],
  ): Promise<SocketSdkGenericResult<GetPatchPackagesResponse>> {
    return requestSdkJson(this.#context, {
      path: 'patch/package',
      method: 'POST',
      body: { uuids },
    })
  }

  getPatchBlob(hash: string): Promise<SocketSdkGenericResult<Uint8Array>> {
    return requestSdkBytes(this.#context, {
      path: `patch/blob/${encodeURIComponent(hash)}`,
    })
  }

  getPatchDiff(uuid: string): Promise<SocketSdkGenericResult<Uint8Array>> {
    return requestSdkBytes(this.#context, {
      path: `patch/diff/${encodeURIComponent(uuid)}`,
    })
  }
}
