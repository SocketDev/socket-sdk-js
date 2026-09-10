/**
 * @file Socket API generation validates inputs before changing artifacts.
 */

import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { safeDelete } from '@socketsecurity/lib-stable/fs/safe'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { generateSdkContracts } from '../../../scripts/repo/generate-sdk.mts'
import { renderOpenApiTypes } from '../../../scripts/repo/generate-types.mts'
import {
  findOpenApiDrift,
  normalizeOpenApiDocument,
  OPENAPI_CONTRACTS,
  readOpenApiInputs,
  writeOpenApiArtifacts,
} from '../../../scripts/repo/openapi-contracts.mts'

const directories: string[] = []

async function createContractDirectory(): Promise<string> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), 'sdk-openapi-contracts-'),
  )
  directories.push(directory)
  return directory
}

function createOpenApiFixture(): Record<string, unknown> {
  return {
    openapi: '3.0.3',
    info: { title: 'Example API', version: '1.0.0' },
    paths: {
      '/v1/example': {
        get: {
          responses: {
            200: {
              description: 'Complete',
              content: {
                'application/x-ndjson': {
                  schema: {
                    type: 'object',
                    properties: { inputPurl: { type: 'string' } },
                  },
                },
              },
            },
            202: {
              description: 'Processing',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['status'],
                    properties: {
                      status: { type: 'string', enum: ['processing'] },
                    },
                  },
                },
              },
            },
            204: { description: 'Empty' },
          },
        },
      },
    },
    components: {
      schemas: {
        PurlErrorSchema: {
          type: 'object',
          required: ['error', 'inputPurl', 'retryable'],
          properties: {
            error: { type: 'string' },
            inputPurl: { type: 'string' },
            retryable: { type: 'boolean' },
          },
        },
        Bundle: { type: 'string', format: 'binary' },
        OpenSelector: { type: 'object' },
        ClosedSelector: { type: 'object', additionalProperties: false },
      },
    },
  }
}

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await safeDelete(directory)
  }
})

describe('Socket OpenAPI inputs', () => {
  it('reads both local snapshots without using the downloader', async () => {
    const rootPath = await createContractDirectory()
    for (const contract of OPENAPI_CONTRACTS) {
      await writeFile(
        path.join(rootPath, contract.snapshot),
        JSON.stringify(createOpenApiFixture()),
      )
    }
    const download = vi.fn(async () => createOpenApiFixture())
    const inputs = await readOpenApiInputs({
      rootPath,
      offline: true,
      download,
    })
    expect(inputs.map(input => input.contract.version)).toEqual(['v0', 'v1'])
    expect(download).not.toHaveBeenCalled()
  })

  it('leaves both snapshots untouched when one downloaded schema is malformed', async () => {
    const rootPath = await createContractDirectory()
    for (const contract of OPENAPI_CONTRACTS) {
      await writeFile(
        path.join(rootPath, contract.snapshot),
        'preserved snapshot',
      )
    }
    const download = vi.fn(async (url: string) =>
      url.includes('/v0/') ? createOpenApiFixture() : { error: 'unavailable' },
    )
    await expect(
      generateSdkContracts({ rootPath, download }),
    ).rejects.toBeInstanceOf(Error)
    for (const contract of OPENAPI_CONTRACTS) {
      expect(
        await readFile(path.join(rootPath, contract.snapshot), 'utf8'),
      ).toBe('preserved snapshot')
    }
    expect(download).toHaveBeenCalledTimes(2)
  })

  it('normalizes retryability without changing the input document', () => {
    const fixture = createOpenApiFixture()
    const before = JSON.parse(JSON.stringify(fixture)) as Record<
      string,
      unknown
    >
    const normalized = normalizeOpenApiDocument(fixture)
    expect(normalized.components?.schemas?.['PurlErrorSchema']).toMatchObject({
      required: ['error', 'inputPurl'],
    })
    expect(fixture).toEqual(before)
  })

  it('rejects partial schemas that omit operation responses', () => {
    const fixture = createOpenApiFixture()
    fixture['paths'] = { '/v1/example': { get: {} } }
    expect(() => normalizeOpenApiDocument(fixture)).toThrow(Error)
  })

  it('rejects references that could read files or contact another service', () => {
    for (const reference of [
      'file:///example-schema.json',
      'https://example.com/schema.json',
    ]) {
      const fixture = createOpenApiFixture()
      fixture['components'] = { schemas: { Example: { $ref: reference } } }
      expect(() => normalizeOpenApiDocument(fixture)).toThrow(Error)
    }
  })

  it('keeps v1 path types, response media, statuses, and binary bodies', async () => {
    const output = await renderOpenApiTypes(
      normalizeOpenApiDocument(createOpenApiFixture()),
      'v1',
    )
    expect(output).toContain('"/v1/example"')
    expect(output).toContain('"application/x-ndjson"')
    expect(output).toContain('202:')
    expect(output).toContain('204:')
    expect(output).toContain('Bundle: Uint8Array')
    expect(output).toContain('retryable?: boolean')
    expect(output).toContain('OpenSelector: Record<string, unknown>')
    expect(output).toContain('ClosedSelector: Record<string, never>')
  })
})

describe('OpenAPI artifact freshness', () => {
  it('regenerates both recorded contracts and checks them without changing files', async () => {
    const rootPath = await createContractDirectory()
    const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))
    for (const directory of ['types', 'src/types', '.config/fleet']) {
      await mkdir(path.join(rootPath, directory), { recursive: true })
    }
    for (const contract of OPENAPI_CONTRACTS) {
      await writeFile(
        path.join(rootPath, contract.snapshot),
        await readFile(path.join(repositoryRoot, contract.snapshot)),
      )
    }
    await writeFile(path.join(rootPath, '.config/fleet/oxfmtrc.json'), '{}')
    await writeFile(
      path.join(rootPath, 'src/index.mts'),
      "export type { OrganizationsResult } from './types/strict.mts'\n",
    )
    const changes = await generateSdkContracts({ rootPath, offline: true })
    expect(changes).toEqual(
      expect.arrayContaining(
        OPENAPI_CONTRACTS.map(contract => path.join(rootPath, contract.types)),
      ),
    )
    expect(
      await generateSdkContracts({ rootPath, offline: true, check: true }),
    ).toEqual([])
    const typesPath = path.join(rootPath, OPENAPI_CONTRACTS[1]!.types)
    await writeFile(typesPath, 'changed contract')
    expect(
      await generateSdkContracts({ rootPath, offline: true, check: true }),
    ).toEqual([typesPath])
    expect(await readFile(typesPath, 'utf8')).toBe('changed contract')
  })

  it('reports missing and changed artifacts without writing them', async () => {
    const directory = await createContractDirectory()
    const existingPath = path.join(directory, 'existing.json')
    const missingPath = path.join(directory, 'missing.json')
    await writeFile(existingPath, 'old')
    expect(
      await findOpenApiDrift([
        { filePath: existingPath, content: 'new' },
        { filePath: missingPath, content: 'new' },
      ]),
    ).toEqual([existingPath, missingPath])
    expect(await readFile(existingPath, 'utf8')).toBe('old')
    await expect(readFile(missingPath)).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  it('writes complete artifacts that pass the next freshness check', async () => {
    const directory = await createContractDirectory()
    const artifacts = [
      {
        filePath: path.join(directory, 'example.json'),
        content: '{"version":1}\n',
      },
    ]
    await writeOpenApiArtifacts(artifacts)
    expect(await findOpenApiDrift(artifacts)).toEqual([])
  })

  it('propagates filesystem errors instead of reporting ordinary drift', async () => {
    const directory = await createContractDirectory()
    const directoryPath = path.join(directory, 'directory.json')
    await mkdir(directoryPath)
    await expect(
      findOpenApiDrift([{ filePath: directoryPath, content: '' }]),
    ).rejects.toMatchObject({ code: 'EISDIR' })
  })
})
