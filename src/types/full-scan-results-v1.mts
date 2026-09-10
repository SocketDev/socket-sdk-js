/**
 * @file Advanced v1 full-scan result records and polling states.
 */
import type { SocketArtifact, SocketSdkGenericResult } from './core.mts'

export type FullScanScore = {
  value: {
    result: number
    components?: Record<string, number> | undefined
    formula?: string | undefined
  }
}
export type FullScanScoresRecord = {
  _type: 'scores'
  value: Record<
    | 'supplyChainRisk'
    | 'quality'
    | 'maintenance'
    | 'vulnerability'
    | 'license'
    | 'overall',
    FullScanScore
  >
}
export type FullScanV1Record = SocketArtifact | FullScanScoresRecord
export type FullScanV1Failure = {
  code: string
  retryable: boolean
  message: string
}
export type FullScanV1Processing = {
  status: 'processing'
  id: string
  progress?: number | undefined
}
export type FullScanV1Complete = {
  status: 'complete'
  records: AsyncGenerator<FullScanV1Record>
  scannedAt?: string | undefined
}
export type FullScanV1Failed = { status: 'failed'; error: FullScanV1Failure }
export type FullScanV1Data =
  | FullScanV1Processing
  | FullScanV1Complete
  | FullScanV1Failed
export type FullScanV1Result = SocketSdkGenericResult<FullScanV1Data>
export type FullScanV1TerminalResult = SocketSdkGenericResult<
  FullScanV1Complete | FullScanV1Failed
>
export type PollFullScanV1Options = {
  maxPollMs?: number | undefined
  pollIntervalMs?: number | undefined
  signal?: AbortSignal | undefined
}
