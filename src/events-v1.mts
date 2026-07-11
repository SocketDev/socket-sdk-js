/**
 * @file Types for the v1 events endpoint (public API — organization
 *   telemetry ingestion). Hand-written since events has no generated OpenAPI
 *   schema in this SDK yet, mirroring the precedent set by full-scans-v1.mts.
 */
import type { JsonValue } from '@socketsecurity/lib/json/types'

// The wire schema is `additionalProperties: true` with a handful of known
// optional fields — callers may send arbitrary extra keys alongside them.
export type SocketEvent = {
  [key: string]: JsonValue | undefined
  alert_action?: string | undefined
  artifact_purl?: string | undefined
  client_action?: string | undefined
  event_id?: string | undefined
  event_kind?: string | undefined
  event_sender_created_at?: string | undefined
  input_purl?: string | undefined
  user_agent?: string | undefined
}

export type PostEventsData = Record<string, JsonValue>

export type PostEventsResult = {
  cause: undefined
  data: PostEventsData
  error: undefined
  status: 200 | 201
  success: true
}
