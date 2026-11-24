/**
 * @file Platform-tolerant timing helpers for tests.
 */

import process from 'node:process'

const TIMEOUT_MULTIPLIER = 5
const MIN_TIMER_QUANTUM_MS = process.platform === 'win32' ? 15.6 : 1

export function tolerantTimeout(ms: number): number {
  return process.platform === 'win32' ? ms * TIMEOUT_MULTIPLIER : ms
}

export function tolerantSleep(ms: number): number {
  return tolerantTimeout(ms)
}

export function minTimerQuantum(ms: number): number {
  return Math.max(ms, MIN_TIMER_QUANTUM_MS)
}
