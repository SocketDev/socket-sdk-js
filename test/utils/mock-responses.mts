/**
 * @file Mock utilities for test setup.
 */
import { Readable } from 'node:stream'

import { vi } from 'vitest'

import type * as NodeFs from 'node:fs'

// Mock fs.createReadStream to prevent test-package.json from being created.
vi.mock(import('node:fs'), async () => {
  const actual = await vi.importActual<typeof NodeFs>('node:fs')
  return {
    ...actual,
    // The mock returns a plain Readable for the test fixture rather than a real
    // fs.ReadStream, so cast back to the module's createReadStream type to keep
    // the factory assignable to Partial<typeof import('node:fs')> under vitest's
    // stricter v4 typing. Runtime behavior is unchanged.
    createReadStream: vi.fn((path: string) => {
      // Return a mock readable stream for test-package.json.
      if (path.includes('test-package.json')) {
        const stream = new Readable()
        stream.push('{"name": "test-package", "version": "1.0.0"}')
        // oxlint-disable-next-line socket/prefer-undefined-over-null -- Readable.push(null) is Node's stream-EOF signal.
        stream.push(null)
        return stream
      }
      // For other files, use the actual createReadStream.
      return actual.createReadStream(path)
    }) as unknown as typeof actual.createReadStream,
  }
})
