'use client'

export type AdminError = { status: number; message: string }

export function filenameFromContentDisposition(cd: string | null): string | null {
  if (!cd) return null
  const m = cd.match(/filename="?([^";]+)"?/i)
  return m ? m[1] : null
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const body = await res.json().catch(() => null)
    if (body && typeof body.error === 'string') return body.error
  }
  return fallback
}

export async function adminFetch<T>(
  url: string,
  token: string,
  init?: RequestInit
): Promise<{ ok: true; value: T } | { ok: false; error: AdminError }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })
    if (res.status === 401) {
      return { ok: false, error: { status: 401, message: 'Unauthorized — token is missing, invalid, or not configured on the server.' } }
    }
    if (!res.ok) {
      const message = await parseErrorMessage(res, `Request failed (HTTP ${res.status})`)
      return { ok: false, error: { status: res.status, message } }
    }
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const value = (await res.json()) as T
      return { ok: true, value }
    }
    return { ok: true, value: undefined as unknown as T }
  } catch {
    return { ok: false, error: { status: 0, message: 'Network error — could not reach the server.' } }
  }
}

export async function adminDownload(
  url: string,
  token: string
): Promise<{ ok: true; filename: string } | { ok: false; error: AdminError }> {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
    if (res.status === 401) {
      return { ok: false, error: { status: 401, message: 'Unauthorized — token is missing, invalid, or not configured on the server.' } }
    }
    if (!res.ok) {
      const message = await parseErrorMessage(res, `Download failed (HTTP ${res.status})`)
      return { ok: false, error: { status: res.status, message } }
    }
    const blob = await res.blob()
    const filename = filenameFromContentDisposition(res.headers.get('content-disposition')) ?? 'download.json'
    const objUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objUrl)
    return { ok: true, filename }
  } catch {
    return { ok: false, error: { status: 0, message: 'Network error — could not reach the server.' } }
  }
}

export const EVIDENCE_STATUSES = [
  'officially-documented',
  'statement-verified',
  'inferred',
  'community-reported',
] as const

export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number]

export type AdminLead = {
  id: string
  status: string
  proposedRuleData: unknown
  sourceUrl: string
  createdAt: string
  verificationRecordId: string | null
  evidenceStatus: EvidenceStatus | null
  card: { id: string; name: string; issuer: string; network: string }
}

export type AdminRuleVersion = {
  id: string
  effectiveFrom: string
  effectiveTo: string | null
  evidenceStatus: string
  ruleData: unknown
  redemptionScenarios: unknown[]
}

export type AdminCatalogCard = {
  id: string
  name: string
  issuer: string
  network: string
  rewardCurrency: string
  annualFeeCents: number | null
  ruleVersions: AdminRuleVersion[]
  redemptionScenarios: unknown[]
}

export type AdminReport = {
  id: string
  description: string
  sourceUrl: string | null
  traceContext: unknown
  createdAt: string
  card: { id: string; name: string; issuer: string; network: string }
  ruleVersion: {
    id: string
    ruleData: unknown
    effectiveFrom: string
    effectiveTo: string | null
    retractedAt: string | null
    createdAt: string
  } | null
  verificationRecord: {
    id: string
    evidenceStatus: string
    verifiedAt: string
    notes: string | null
  } | null
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return String(value)
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}