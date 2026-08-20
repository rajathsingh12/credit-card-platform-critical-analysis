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

type EmitScope = 'client' | 'server-only'

// Single source of truth: `satisfies Record<BetaEventName, EmitScope>` forces every union member to be classified here, so adding a BetaEventName without a row is a compile error.
const EMIT_SCOPE = {
  decision_completed: 'client',
  session_repeat: 'client',
  unresolved_outcome_shown: 'client',
  contextual_report_submitted: 'client',
  correction_retracted: 'server-only',
} as const satisfies Record<BetaEventName, EmitScope>

export const ALL_EVENT_NAMES: readonly BetaEventName[] =
  Object.keys(EMIT_SCOPE) as BetaEventName[]

const VALID_NAMES: ReadonlySet<string> = new Set(ALL_EVENT_NAMES)

export const CLIENT_EVENT_NAMES: ReadonlySet<BetaEventName> = new Set(
  ALL_EVENT_NAMES.filter((name) => EMIT_SCOPE[name] === 'client'),
)

export const SERVER_ONLY_EVENT_NAMES: ReadonlySet<BetaEventName> = new Set(
  ALL_EVENT_NAMES.filter((name) => EMIT_SCOPE[name] === 'server-only'),
)

export function isValidEventName(name: unknown): name is BetaEventName {
  return typeof name === 'string' && VALID_NAMES.has(name)
}
