export type EvidenceStatus =
  | 'officially-documented'
  | 'statement-verified'
  | 'inferred'
  | 'community-reported'

export type FeeBand = 'no-fee' | 'mid-tier' | 'premium'

export type RewardCurrency =
  | 'issuer-points'
  | 'airline-miles'
  | 'membership-rewards'
  | 'cash-back'

const PUBLISHABLE: readonly EvidenceStatus[] = ['officially-documented', 'statement-verified']

export const EVIDENCE_STATUSES: readonly EvidenceStatus[] = [
  'officially-documented',
  'statement-verified',
  'inferred',
  'community-reported',
]

const PREMIUM_FEE_THRESHOLD_CENTS = 500_000

export const ISSUER_DOMAINS: Readonly<Record<string, string>> = {
  'HDFC Bank': 'hdfcbank.com',
  'Axis Bank': 'axisbank.com',
  'ICICI Bank': 'icicibank.com',
  'SBI Card': 'sbicard.com',
  'IDFC First Bank': 'idfcfirstbank.com',
  'IndusInd Bank': 'indusind.com',
  'American Express': 'americanexpress.com',
  'Standard Chartered': 'sc.com',
}

export function isPublishable(status: EvidenceStatus): boolean {
  return PUBLISHABLE.includes(status)
}

export function classifyFeeBand(annualFeeCents: number | null): FeeBand {
  if (annualFeeCents === null || annualFeeCents === 0) return 'no-fee'
  return annualFeeCents >= PREMIUM_FEE_THRESHOLD_CENTS ? 'premium' : 'mid-tier'
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function isIssuerOwnedUrl(issuer: string, url: string): boolean {
  const domain = ISSUER_DOMAINS[issuer]
  if (!domain) return false
  const host = hostnameOf(url)
  if (host === null) return false
  return host === domain || host.endsWith(`.${domain}`)
}

export function validateEvidence(input: {
  issuer: string
  evidenceStatus: EvidenceStatus
  sourceUrl: string
}): { ok: true } | { ok: false; error: string } {
  const { issuer, evidenceStatus, sourceUrl } = input

  let parsed: URL
  try {
    parsed = new URL(sourceUrl)
  } catch {
    return { ok: false, error: `source url is not a valid url: ${sourceUrl}` }
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: `source url must use https: ${sourceUrl}` }
  }

  const issuerOwned = isIssuerOwnedUrl(issuer, sourceUrl)

  if (evidenceStatus === 'officially-documented' && !issuerOwned) {
    return {
      ok: false,
      error: `officially-documented evidence must cite the issuer's own domain, got ${parsed.hostname}`,
    }
  }

  if (evidenceStatus === 'community-reported' && issuerOwned) {
    return {
      ok: false,
      error: `community-reported evidence must not cite the issuer's own domain, got ${parsed.hostname}`,
    }
  }

  return { ok: true }
}
