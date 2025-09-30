/** @fileoverview Vitest setup file for test utilities. */
import events from 'node:events'

import abortSignal from '@socketsecurity/registry/lib/constants/abort-signal'

// Increase max listeners for abortSignal to prevent warnings during high-concurrency tests.
// The batchPackageStream method can add many concurrent abort listeners.
events.setMaxListeners(50, abortSignal)
