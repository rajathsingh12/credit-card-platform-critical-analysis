'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import styles from './admin.module.css'
import {
  adminDownload,
  adminFetch,
  EVIDENCE_STATUSES,
  formatTimestamp,
  todayIso,
  type AdminCatalogCard,
  type AdminLead,
  type AdminReport,
  type EvidenceStatus,
} from './admin-client'

const EVIDENCE_TIERS: Record<string, { tier: 1 | 2 | 3 | 4; glyph: string }> = {
  'officially-documented': { tier: 1, glyph: '●' },
  'statement-verified': { tier: 2, glyph: '◕' },
  'inferred': { tier: 3, glyph: '◐' },
  'community-reported': { tier: 4, glyph: '○' },
}

function EvidenceBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null
  const t = EVIDENCE_TIERS[status]
  if (!t) return <span className="badge badge--neutral">{status.replace(/-/g, ' ')}</span>
  return (
    <span className={`badge badge--evidence-${t.tier}`} title={`Evidence tier ${t.tier} of 4`}>
      <span className="badge__glyph" aria-hidden="true">{t.glyph}</span>
      {status.replace(/-/g, ' ')}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: styles.badgePending,
    verified: styles.badgeVerified,
    approved: styles.badgeApproved,
    rejected: styles.badgeRejected,
  }
  return <span className={`badge ${map[status] ?? 'badge--neutral'}`}>{status}</span>
}

function Banner({ kind, children }: { kind: 'error' | 'success' | 'notice'; children: React.ReactNode }) {
  const cls = kind === 'error' ? 'alert--error' : kind === 'success' ? 'alert--success' : 'alert--warning'
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`alert ${cls}`} style={{ marginTop: 8 }}>{children}</div>
}

function renderJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const NAV = [
  { id: 'queue', label: 'Data Lead queue' },
  { id: 'retract', label: 'Retract rule version' },
  { id: 'delivery', label: 'Managed delivery' },
  { id: 'report', label: 'Report lookup' },
] as const
type ViewId = (typeof NAV)[number]['id']

export default function AdminConsole() {
  const [token, setToken] = useState('')
  const [authed, setAuthed] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [view, setView] = useState<ViewId>('queue')

  function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setTokenError(null)
    if (!token.trim()) {
      setTokenError('Enter an admin token to continue.')
      return
    }
    setAuthed(true)
  }

  function handleSignOut() {
    setToken('')
    setAuthed(false)
  }

  if (!authed) {
    return (
      <main className={styles.page}>
        <h1 className={styles.sectionTitle}>Data Steward Console</h1>
        <p className={styles.sub}>Staff-only admin interface. Enter the admin token to load the steward workflows.</p>
        <form onSubmit={handleSignIn} noValidate>
          <div className="field">
            <label className="label" htmlFor="admin-token">Admin token</label>
            <input id="admin-token" type="password" className="input" value={token}
              onChange={e => setToken(e.target.value)} placeholder="ADMIN_TOKEN" autoComplete="off" spellCheck={false} />
          </div>
          <button type="submit" className="btn btn--primary" disabled={!token.trim()} style={{ marginTop: 12 }}>Sign in</button>
        </form>
        {tokenError && <Banner kind="error">{tokenError}</Banner>}
        <p className={styles.signInNote}>
          The token is held in memory for this browser session only. It is not stored, logged, or embedded in the page bundle.
        </p>
      </main>
    )
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3l7 3v5c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6l7-3z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </span>
          Steward Console
        </div>
        <nav className={styles.nav} aria-label="Console sections">
          {NAV.map(item => (
            <button key={item.id} type="button"
              className={`${styles.navItem} ${view === item.id ? styles.navItemActive : ''}`}
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => setView(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <div className={styles.main}>
        <header className={styles.topbarMain}>
          <strong>Data Steward Console</strong>
          <button type="button" className={`btn btn--secondary btn--sm ${styles.topbarSpacer}`} onClick={handleSignOut}>Sign out</button>
        </header>
        <div className={styles.views}>
          <div hidden={view !== 'queue'}><LeadsSection token={token} /></div>
          <div hidden={view !== 'retract'}><RetractionSection token={token} /></div>
          <div hidden={view !== 'delivery'}><ManagedDeliverySection token={token} /></div>
          <div hidden={view !== 'report'}><ReportDetailSection token={token} /></div>
        </div>
      </div>
    </div>
  )
}

function useRefresh<T>(token: string, url: string): {
  data: T | null
  loading: boolean
  error: string | null
  refresh: () => void
} {
  const [settled, setSettled] = useState<{ key: string; data: T | null; error: string | null }>({
    key: '', data: null, error: null,
  })
  const [nonce, setNonce] = useState(0)

  const key = JSON.stringify([nonce, token, url])
  const refresh = useCallback(() => setNonce(n => n + 1), [])

  useEffect(() => {
    let cancelled = false
    adminFetch<T>(url, token).then(res => {
      if (cancelled) return
      setSettled(prev => res.ok
        ? { key, data: res.value, error: null }
        : { key, data: prev.data, error: res.error.message })
    })
    return () => { cancelled = true }
  }, [token, url, key])

  const current = settled.key === key
  return {
    data: settled.data,
    loading: !current,
    error: current ? settled.error : null,
    refresh,
  }
}

function LeadsSection({ token }: { token: string }) {
  const { data, loading, error, refresh } = useRefresh<{ leads: AdminLead[] }>(token, '/api/admin/leads')

  return (
    <section>
      <div className={styles.rowInline}>
        <h2 className={styles.sectionTitle}>Data Lead queue</h2>
        {data && <span className="badge badge--neutral">{data.leads.length} pending</span>}
        <button type="button" className={`btn btn--secondary btn--sm ${styles.topbarSpacer}`} onClick={refresh} disabled={loading}>Refresh</button>
      </div>
      {loading && <Banner kind="notice">Loading pending Data Leads…</Banner>}
      {error && <Banner kind="error">{error}</Banner>}
      {!loading && !error && data && data.leads.length === 0 && (
        <Banner kind="success">No pending Data Leads. The queue is empty.</Banner>
      )}
      {!loading && !error && data && data.leads.length > 0 && (
        <div>
          {data.leads.map(lead => (
            <LeadCard key={lead.id} lead={lead} token={token} onChanged={refresh} />
          ))}
        </div>
      )}
    </section>
  )
}

function LeadCard({ lead, token, onChanged }: { lead: AdminLead; token: string; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [evidenceStatus, setEvidenceStatus] = useState<EvidenceStatus>('officially-documented')
  const [notes, setNotes] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso())
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ kind: 'error' | 'success'; message: string } | null>(null)

  const verified = lead.evidenceStatus !== null && lead.verificationRecordId !== null

  async function callVerify() {
    setBusy(true)
    setResult(null)
    const res = await adminFetch(
      `/api/admin/leads/${lead.id}/verify`,
      token,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evidenceStatus, notes: notes.trim() || undefined }) }
    )
    setBusy(false)
    if (res.ok) {
      setResult({ kind: 'success', message: 'Lead verified. You can now approve or reject it.' })
      onChanged()
    } else {
      setResult({ kind: 'error', message: res.error.message })
    }
  }

  async function callApprove() {
    setBusy(true)
    setResult(null)
    const res = await adminFetch(
      `/api/admin/leads/${lead.id}/approve`,
      token,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ effectiveFrom }) }
    )
    setBusy(false)
    if (res.ok) {
      setResult({ kind: 'success', message: 'Lead approved — Rule Version published.' })
      onChanged()
    } else {
      setResult({ kind: 'error', message: res.error.message })
    }
  }

  async function callReject() {
    setBusy(true)
    setResult(null)
    const res = await adminFetch(
      `/api/admin/leads/${lead.id}/reject`,
      token,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: rejectReason }) }
    )
    setBusy(false)
    if (res.ok) {
      setResult({ kind: 'success', message: 'Lead rejected.' })
      onChanged()
    } else {
      setResult({ kind: 'error', message: res.error.message })
    }
  }

  return (
    <div className={`card ${styles.panel}`}>
      <div className={styles.rowInline}>
        <span className={styles.cardTitle}>{lead.card.name}</span>
        <StatusBadge status={lead.status} />
        {verified && <EvidenceBadge status={lead.evidenceStatus} />}
      </div>
      <div className={styles.cardSub}>{lead.card.issuer} · {lead.card.network}</div>

      <div className={styles.metaRow}><span className={styles.metaLabel}>Lead ID</span><code className="mono">{lead.id}</code></div>
      <div className={styles.metaRow}><span className={styles.metaLabel}>Source URL</span><a href={lead.sourceUrl} target="_blank" rel="noreferrer">{lead.sourceUrl}</a></div>
      <div className={styles.metaRow}><span className={styles.metaLabel}>Created</span>{formatTimestamp(lead.createdAt)}</div>
      <div className={styles.metaRow}><span className={styles.metaLabel}>Evidence status</span>{lead.evidenceStatus ?? 'not verified'}</div>
      <div className={styles.metaRow}><span className={styles.metaLabel}>Verification record</span>{lead.verificationRecordId ?? '—'}</div>

      <button type="button" className="btn btn--secondary btn--sm" style={{ marginTop: 8 }} onClick={() => setExpanded(e => !e)} aria-expanded={expanded}>
        {expanded ? 'Hide proposed Rule data' : 'Show proposed Rule data'}
      </button>
      {expanded && <pre className={styles.pre} style={{ marginTop: 8 }}>{renderJson(lead.proposedRuleData)}</pre>}

      <div className={styles.actionGroup}>
        <div className={styles.actionGroupTitle}>Verify</div>
        <div className="field">
          <label className="label" htmlFor={`ev-${lead.id}`}>Evidence status</label>
          <select id={`ev-${lead.id}`} className="input" value={evidenceStatus} onChange={e => setEvidenceStatus(e.target.value as EvidenceStatus)}>
            {EVIDENCE_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor={`notes-${lead.id}`}>Notes (optional)</label>
          <textarea id={`notes-${lead.id}`} className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reviewer notes" />
        </div>
        <button type="button" className="btn btn--primary" onClick={callVerify} disabled={busy} style={{ alignSelf: 'flex-start' }}>Verify lead</button>
      </div>

      <div className={styles.actionGroup}>
        <div className={styles.actionGroupTitle}>Approve</div>
        {verified ? (
          <>
            <div className="field">
              <label className="label" htmlFor={`eff-${lead.id}`}>Effective from (YYYY-MM-DD)</label>
              <input id={`eff-${lead.id}`} type="date" className="input" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} />
            </div>
            <button type="button" className="btn btn--primary" onClick={callApprove} disabled={busy || !effectiveFrom} style={{ alignSelf: 'flex-start' }}>{'Approve & publish'}</button>
          </>
        ) : (
          <Banner kind="notice">Verify this lead before it can be approved and published.</Banner>
        )}
      </div>

      <div className={styles.actionGroup}>
        <div className={styles.actionGroupTitle}>Reject</div>
        <div className="field">
          <label className="label" htmlFor={`rej-${lead.id}`}>Reason</label>
          <textarea id={`rej-${lead.id}`} className="input" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Why is this lead being rejected?" />
        </div>
        <button type="button" className="btn btn--secondary" onClick={callReject} disabled={busy || !rejectReason.trim()} style={{ alignSelf: 'flex-start' }}>Reject lead</button>
      </div>

      {result && <Banner kind={result.kind}>{result.message}</Banner>}
    </div>
  )
}

function RetractionSection({ token }: { token: string }) {
  const { data, loading, error, refresh } = useRefresh<{ cards: AdminCatalogCard[] }>(token, '/api/admin/catalog-export')
  const versions = useMemo(() => {
    if (!data) return []
    return data.cards.flatMap(card =>
      card.ruleVersions.map(rv => ({ rv, card }))
    )
  }, [data])

  const [selectedOverride, setSelectedOverride] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ kind: 'error' | 'success'; message: string } | null>(null)

  const selectedId = selectedOverride ?? versions[0]?.rv.id ?? ''
  const selected = versions.find(v => v.rv.id === selectedId)

  async function callRetract() {
    if (!selectedId) return
    setBusy(true)
    setResult(null)
    const res = await adminFetch(
      `/api/admin/rule-versions/${selectedId}/retract`,
      token,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) }
    )
    setBusy(false)
    if (res.ok) {
      setResult({ kind: 'success', message: 'Rule Version retracted.' })
      setReason('')
      refresh()
    } else {
      setResult({ kind: 'error', message: res.error.message })
    }
  }

  return (
    <section>
      <div className={styles.rowInline}>
        <h2 className={styles.sectionTitle}>Retract a published Rule Version</h2>
        <button type="button" className={`btn btn--secondary btn--sm ${styles.topbarSpacer}`} onClick={refresh} disabled={loading}>Refresh</button>
      </div>
      <p className={styles.sub}>Current (non-retracted) Rule Versions come from the Versioned Catalog export.</p>
      {loading && <Banner kind="notice">Loading current Rule Versions…</Banner>}
      {error && <Banner kind="error">{error}</Banner>}
      {!loading && !error && versions.length === 0 && (
        <Banner kind="success">No published Rule Versions available to retract.</Banner>
      )}
      {!loading && !error && versions.length > 0 && (
        <>
          <div className="field">
            <label className="label" htmlFor="rv-select">Rule Version</label>
            <select id="rv-select" className="input" value={selectedId} onChange={e => setSelectedOverride(e.target.value)}>
              {versions.map(({ rv, card }) => {
                const label = `${card.name} (${card.issuer}) — effective ${rv.effectiveFrom}${rv.effectiveTo ? ` to ${rv.effectiveTo}` : ' (open)'} [${rv.id}]`
                return (
                  <option key={rv.id} value={rv.id}>{label}</option>
                )
              })}
            </select>
          </div>
          {selected && (
            <div className={`card ${styles.panel}`} style={{ marginTop: 12 }}>
              <div className={styles.metaRow}><span className={styles.metaLabel}>Card</span>{selected.card.name} · {selected.card.issuer}</div>
              <div className={styles.metaRow}><span className={styles.metaLabel}>Effective from</span>{selected.rv.effectiveFrom}</div>
              <div className={styles.metaRow}><span className={styles.metaLabel}>Effective to</span>{selected.rv.effectiveTo ?? 'open'}</div>
              <div className={styles.metaRow}><span className={styles.metaLabel}>Evidence</span><EvidenceBadge status={selected.rv.evidenceStatus} /></div>
              <details style={{ marginTop: 8 }}>
                <summary className="hint" style={{ cursor: 'pointer' }}>Rule data</summary>
                <pre className={styles.pre} style={{ marginTop: 8 }}>{renderJson(selected.rv.ruleData)}</pre>
              </details>
            </div>
          )}
          <div className="field" style={{ marginTop: 12 }}>
            <label className="label" htmlFor="retract-reason">Reason (required)</label>
            <textarea id="retract-reason" className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this Rule Version being retracted?" />
          </div>
          <button type="button" className="btn btn--primary" onClick={callRetract} disabled={busy || !reason.trim() || !selectedId} style={{ marginTop: 12 }}>Retract Rule Version</button>
          {result && <Banner kind={result.kind}>{result.message}</Banner>}
        </>
      )}
    </section>
  )
}

function ManagedDeliverySection({ token }: { token: string }) {
  const [since, setSince] = useState(todayIso())
  const [until, setUntil] = useState(todayIso())
  const [catalogBusy, setCatalogBusy] = useState(false)
  const [feedBusy, setFeedBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function downloadCatalog() {
    setCatalogBusy(true)
    setError(null)
    const r = await adminDownload('/api/admin/catalog-export', token)
    setCatalogBusy(false)
    if (!r.ok) setError(r.error.message)
  }

  async function downloadFeed() {
    setError(null)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) { setError('Since date must be YYYY-MM-DD.'); return }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) { setError('Until date must be YYYY-MM-DD.'); return }
    setFeedBusy(true)
    const r = await adminDownload(`/api/admin/change-feed?since=${since}&until=${until}`, token)
    setFeedBusy(false)
    if (!r.ok) setError(r.error.message)
  }

  return (
    <section>
      <h2 className={styles.sectionTitle}>Managed delivery</h2>
      <div className={`card ${styles.panel}`} style={{ marginTop: 12 }}>
        <div className={styles.cardTitle}>Versioned Catalog</div>
        <div className={styles.cardSub}>Download the current Versioned Catalog as JSON.</div>
        <button type="button" className="btn btn--primary" onClick={downloadCatalog} disabled={catalogBusy}>
          {catalogBusy ? 'Downloading…' : 'Download catalog'}
        </button>
      </div>
      <div className={`card ${styles.panel}`}>
        <div className={styles.cardTitle}>Change Feed</div>
        <div className={styles.cardSub}>Download a bounded Change Feed for an explicit since/until range.</div>
        <div className={styles.rowInline}>
          <div className="field">
            <label className="label" htmlFor="feed-since">Since (YYYY-MM-DD)</label>
            <input id="feed-since" type="date" className="input" value={since} onChange={e => setSince(e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="feed-until">Until (YYYY-MM-DD)</label>
            <input id="feed-until" type="date" className="input" value={until} onChange={e => setUntil(e.target.value)} />
          </div>
        </div>
        <button type="button" className="btn btn--primary" onClick={downloadFeed} disabled={feedBusy} style={{ marginTop: 12 }}>
          {feedBusy ? 'Downloading…' : 'Download change feed'}
        </button>
      </div>
      {error && <Banner kind="error">{error}</Banner>}
    </section>
  )
}

function ReportDetailSection({ token }: { token: string }) {
  const [reportId, setReportId] = useState('')
  const [report, setReport] = useState<AdminReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const id = reportId.trim()
    if (!id) { setError('Enter a Contextual Report ID.'); return }
    setLoading(true)
    setError(null)
    setReport(null)
    const res = await adminFetch<AdminReport>(`/api/admin/reports/${encodeURIComponent(id)}`, token)
    setLoading(false)
    if (res.ok) setReport(res.value)
    else setError(res.error.message)
  }

  return (
    <section>
      <h2 className={styles.sectionTitle}>Contextual Report detail</h2>
      <p className={styles.sub}>Open a Contextual Report to review its card, Rule Version, evidence, and stored Calculation Trace context.</p>
      <div className={styles.rowInline}>
        <div className="field" style={{ flex: 1, minWidth: 240 }}>
          <label className="label" htmlFor="report-id">Report ID</label>
          <input id="report-id" className="input" value={reportId} onChange={e => setReportId(e.target.value)} placeholder="report id" />
        </div>
        <button type="button" className="btn btn--primary" onClick={load} disabled={loading} style={{ alignSelf: 'flex-end' }}>
          {loading ? 'Loading…' : 'Open report'}
        </button>
      </div>
      {error && <Banner kind="error">{error}</Banner>}
      {report && (
        <div className={`card ${styles.panel}`} style={{ marginTop: 12 }}>
          <span className={styles.cardTitle}>Report {report.id}</span>
          <div className={styles.metaRow}><span className={styles.metaLabel}>Card</span>{report.card.name} · {report.card.issuer} · {report.card.network}</div>
          <div className={styles.metaRow}><span className={styles.metaLabel}>Created</span>{formatTimestamp(report.createdAt)}</div>
          <div className={styles.metaRow}><span className={styles.metaLabel}>Source URL</span>{report.sourceUrl ?? '—'}</div>
          <div className={styles.actionGroup}>
            <div className={styles.actionGroupTitle}>Description</div>
            <div>{report.description}</div>
          </div>
          {report.ruleVersion ? (
            <div className={styles.actionGroup}>
              <div className={styles.actionGroupTitle}>Rule Version</div>
              <div className={styles.metaRow}><span className={styles.metaLabel}>ID</span><code className="mono">{report.ruleVersion.id}</code></div>
              <div className={styles.metaRow}><span className={styles.metaLabel}>Effective</span>{report.ruleVersion.effectiveFrom} → {report.ruleVersion.effectiveTo ?? 'open'}</div>
              <div className={styles.metaRow}><span className={styles.metaLabel}>Retracted</span>{report.ruleVersion.retractedAt ? formatTimestamp(report.ruleVersion.retractedAt) : 'no'}</div>
              <details style={{ marginTop: 8 }}>
                <summary className="hint" style={{ cursor: 'pointer' }}>Rule data</summary>
                <pre className={styles.pre} style={{ marginTop: 8 }}>{renderJson(report.ruleVersion.ruleData)}</pre>
              </details>
            </div>
          ) : (
            <div className={styles.actionGroup}>
              <div className={styles.actionGroupTitle}>Rule Version</div>
              <div className={styles.sub}>No Rule Version linked to this report.</div>
            </div>
          )}
          {report.verificationRecord ? (
            <div className={styles.actionGroup}>
              <div className={styles.actionGroupTitle}>Evidence</div>
              <div className={styles.metaRow}><span className={styles.metaLabel}>Status</span><EvidenceBadge status={report.verificationRecord.evidenceStatus} /></div>
              <div className={styles.metaRow}><span className={styles.metaLabel}>Verified</span>{formatTimestamp(report.verificationRecord.verifiedAt)}</div>
              <div className={styles.metaRow}><span className={styles.metaLabel}>Notes</span>{report.verificationRecord.notes ?? '—'}</div>
            </div>
          ) : (
            <div className={styles.actionGroup}>
              <div className={styles.actionGroupTitle}>Evidence</div>
              <div className={styles.sub}>No verification record.</div>
            </div>
          )}
          <div className={styles.actionGroup}>
            <div className={styles.actionGroupTitle}>Calculation Trace context</div>
            {report.traceContext === null || report.traceContext === undefined ? (
              <div className={styles.sub}>No trace context stored on this report.</div>
            ) : (
              <pre className={styles.pre}>{renderJson(report.traceContext)}</pre>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
