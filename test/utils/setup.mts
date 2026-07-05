/**
 * @file Vitest setup file for test utilities.
 */

import process from 'node:process'

import nock from 'nock'
import { beforeAll } from 'vitest'

import { getAbortSignal } from '@socketsecurity/lib/process/abort'
import { setMaxEventTargetListeners } from '@socketsecurity/lib/events/warning/handler'

// Disable debug output during tests
process.env['DEBUG'] = ''
delete process.env['NODE_DEBUG']

// Explicitly disable nock verbose logging to prevent circular structure errors
if (typeof nock.recorder !== 'undefined') {
  try {
    // @ts-expect-error - nock.recorder might not be typed
    nock.recorder.rec = false
  } catch {
    // Ignore if recorder doesn't exist or can't be configured
  }
}

// Increase max listeners for abortSignal to prevent warnings during high-concurrency tests.
// The batchPackageStream method can add many concurrent abort listeners. Acquired
// lazily inside beforeAll (not at module eval) per socket/no-module-eval-side-effects.
beforeAll(() => {
  setMaxEventTargetListeners(getAbortSignal(), 50)
})
