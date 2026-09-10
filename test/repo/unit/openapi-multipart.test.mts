/**
 * @file Generated multipart declarations accept binary files and typed
 *   metadata.
 */

import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import { safeDelete } from '@socketsecurity/lib-stable/fs/safe'
import { spawn } from '@socketsecurity/lib-stable/process/spawn/child'
import { expect, it } from 'vitest'

import { renderOpenApiDocumentTypes } from '../../../scripts/repo/generate-types.mts'

import type { OpenAPI3 } from 'openapi-typescript'

it('compiles multipart declarations without weakening named metadata fields', async () => {
  const schema: OpenAPI3 = {
    openapi: '3.0.3',
    info: { title: 'Example uploads', version: '1.0.0' },
    paths: {},
    components: {
      schemas: {
        Upload: {
          type: 'object',
          additionalProperties: { type: 'string', format: 'binary' },
          properties: {
            repository: { type: 'string' },
            rules: {
              type: 'object',
              additionalProperties: { type: 'boolean' },
            },
          },
        },
      },
    },
  }
  const snapshot = JSON.stringify(schema)
  const generated = await renderOpenApiDocumentTypes(schema)
  expect(JSON.stringify(schema)).toBe(snapshot)
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sdk-multipart-'))
  try {
    await writeFile(path.join(directory, 'api.d.mts'), generated)
    await writeFile(
      path.join(directory, 'consumer.mts'),
      "import type { components } from './api.mjs'\n" +
        "type Upload = components['schemas']['Upload']\n" +
        "const upload: Upload = { repository: 'example', rules: { license: true }, 'package.json': new Uint8Array() }\n" +
        '// @ts-expect-error Repository metadata remains a string.\n' +
        'upload.repository = new Uint8Array()\n' +
        '// @ts-expect-error Rules metadata remains a boolean map.\n' +
        'upload.rules = false\n',
    )
    const configPath = path.join(directory, 'tsconfig.json')
    await writeFile(
      configPath,
      JSON.stringify({
        compilerOptions: {
          module: 'nodenext',
          noEmit: true,
          strict: true,
          types: [],
        },
        files: ['consumer.mts'],
      }),
    )
    const checked = await spawn(
      process.execPath,
      [
        path.join(
          import.meta.dirname,
          '../../../node_modules/typescript/bin/tsc',
        ),
        '-p',
        configPath,
      ],
      { stdio: 'pipe', stdioString: true, throws: false },
    )
    expect(checked.stdout).toBe('')
    expect(checked.code).toBe(0)
  } finally {
    await safeDelete(directory)
  }
})
