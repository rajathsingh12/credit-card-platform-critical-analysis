export type BetaEventName =
  | 'decision_completed'
  | 'session_repeat'
  | 'unresolved_outcome_shown'
  | 'contextual_report_submitted'
  | 'correction_retracted'

export interface BetaEvent {
  eventName: BetaEventName
  sessionToken?: string
  payload: Record<string, unknown>
}

const VALID_NAMES = new Set<string>([
  'decision_completed',
  'session_repeat',
  'unresolved_outcome_shown',
  'contextual_report_submitted',
  'correction_retracted',
])

export function isValidEventName(name: unknown): name is BetaEventName {
  return typeof name === 'string' && VALID_NAMES.has(name)
}
