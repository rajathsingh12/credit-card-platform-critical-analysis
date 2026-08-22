'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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

const s: Record<string, React.CSSProperties> = {
  page: { fontFamily: 'system-ui, sans-serif', maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem', color: '#1a1a1a' },
  heading: { fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.25rem' },
  sub: { fontSize: '0.875rem', color: '#555', marginBottom: '1.5rem' },
  section: { marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '1.25rem' },
  sectionTitle: { fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem' },
  field: { marginBottom: '0.75rem' },
  label: { display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.3rem' },
  input: { display: 'block', width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.625rem', fontSize: '0.9375rem', border: '1px solid #ccc', borderRadius: 6, background: '#fff', fontFamily: 'monospace' },
  dateInput: { display: 'block', padding: '0.5rem 0.625rem', fontSize: '0.9375rem', border: '1px solid #ccc', borderRadius: 6, background: '#fff' },
  select: { display: 'block', width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.625rem', fontSize: '0.9375rem', border: '1px solid #ccc', borderRadius: 6, background: '#fff' },
  textarea: { display: 'block', width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.625rem', fontSize: '0.875rem', border: '1px solid #ccc', borderRadius: 6, background: '#fff', fontFamily: 'monospace', minHeight: 60, resize: 'vertical' as const },
  button: { padding: '0.55rem 1rem', fontSize: '0.9375rem', fontWeight: 600, background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' },
  buttonSecondary: { padding: '0.55rem 1rem', fontSize: '0.9375rem', fontWeight: 600, background: '#fff', color: '#1a1a1a', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer' },
  buttonDisabled: { padding: '0.55rem 1rem', fontSize: '0.9375rem', fontWeight: 600, background: '#888', color: '#fff', border: 'none', borderRadius: 6, cursor: 'not-allowed' },
  rowInline: { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' as const },
  error: { marginTop: '0.6rem', padding: '0.6rem 0.75rem', background: '#fff0f0', border: '1px solid #f5c6c6', borderRadius: 6, fontSize: '0.875rem', color: '#b00' },
  success: { marginTop: '0.6rem', padding: '0.6rem 0.75rem', background: '#d4edda', border: '1px solid #a8d5a2', borderRadius: 6, fontSize: '0.875rem', color: '#155724' },
  notice: { padding: '0.6rem 0.75rem', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 6, fontSize: '0.8125rem', color: '#856404' },
  card: { padding: '0.85rem', background: '#f8f8f8', border: '1px solid #ddd', borderRadius: 8, marginBottom: '0.75rem' },
  cardTitle: { fontWeight: 700, fontSize: '0.95rem' },
  cardSub: { fontSize: '0.8125rem', color: '#555', marginBottom: '0.5rem' },
  metaRow: { display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: '#555', padding: '0.2rem 0', borderBottom: '1px solid #eee' },
  metaLabel: { color: '#777' },
  badge: { display: 'inline-block', padding: '0.12rem 0.45rem', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700 },
  badgePending: { background: '#fff3cd', color: '#856404' },
  badgeVerified: { background: '#cce5ff', color: '#004085' },
  badgeApproved: { background: '#d4edda', color: '#155724' },
  badgeRejected: { background: '#f8d7da', color: '#721c24' },
  pre: { padding: '0.6rem', background: '#fafafa', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: '0.75rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const, overflowX: 'auto' as const, maxHeight: 280, overflowY: 'auto' as const },
  actionsRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' as const, marginTop: '0.5rem' },
}

const EVIDENCE_COLORS: Record<string, { background: string; color: string }> = {
  'officially-documented': { background: '#d4edda', color: '#155724' },
  'statement-verified': { background: '#cce5ff', color: '#004085' },
  'inferred': { background: '#fff3cd', color: '#856404' },
  'community-reported': { background: '#f8d7da', color: '#721c24' },
}

function EvidenceBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null
  const c = EVIDENCE_COLORS[status] ?? { background: '#e9ecef', color: '#333' }
  return <span style={{ ...s.badge, ...c }}>{status.replace(/-/g, ' ')}</span>
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, React.CSSProperties> = {
    pending: s.badgePending,
    verified: s.badgeVerified,
    approved: s.badgeApproved,
    rejected: s.badgeRejected,
  }
  return <span style={{ ...s.badge, ...(map[status] ?? { background: '#e9ecef', color: '#333' }) }}>{status}</span>
}

function Banner({ kind, children }: { kind: 'error' | 'success' | 'notice'; children: React.ReactNode }) {
  if (kind === 'error') return <div role="alert" style={s.error}>{children}</div>
  if (kind === 'success') return <div role="status" style={s.success}>{children}</div>
  return <div role="status" style={s.notice}>{children}</div>
}

function renderJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export default function AdminConsole() {
  const [token, setToken] = useState('')
  const [authed, setAuthed] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)

  function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setTokenError(null)
    const trimmed = token.trim()
    if (!trimmed) {
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
      <main style={s.page}>
        <h1 style={s.heading}>Data Steward Console</h1>
        <p style={s.sub}>Staff-only admin interface. Enter the admin token to load the steward workflows.</p>
        <form onSubmit={handleSignIn} noValidate style={{ maxWidth: 460 }}>
          <div style={s.field}>
            <label style={s.label} htmlFor="admin-token">Admin token</label>
            <input
              id="admin-token"
              type="password"
              style={s.input}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="ADMIN_TOKEN"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button type="submit" style={!token.trim() ? s.buttonDisabled : s.button} disabled={!token.trim()}>
            Sign in
          </button>
        </form>
        {tokenError && <Banner kind="error">{tokenError}</Banner>}
        <p style={{ ...s.sub, marginTop: '1rem', fontSize: '0.75rem' }}>
          The token is held in memory for this browser session only. It is not stored, logged, or embedded in the page bundle.
        </p>
      </main>
    )
  }

  return (
    <main style={s.page}>
      <div style={s.rowInline} className="admin-header">
        <h1 style={{ ...s.heading, marginBottom: 0 }}>Data Steward Console</h1>
        <button type="button" style={s.buttonSecondary} onClick={handleSignOut}>Sign out</button>
      </div>
      <p style={s.sub}>Token held in memory for this session. Closing or refreshing the tab clears it.</p>

      <LeadsSection token={token} />
      <RetractionSection token={token} />
      <ManagedDeliverySection token={token} />
      <ReportDetailSection token={token} />
    </main>
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
    <section style={s.section}>
      <div style={s.rowInline} className="admin-leads-header">
        <h2 style={{ ...s.sectionTitle, marginBottom: 0 }}>Data Lead queue</h2>
        <button type="button" style={s.buttonSecondary} onClick={refresh} disabled={loading}>Refresh</button>
      </div>
      {loading && <Banner kind="notice">Loading pending Data Leads…</Banner>}
      {error && <Banner kind="error">{error}</Banner>}
      {!loading && !error && data && data.leads.length === 0 && (
        <Banner kind="success">No pending Data Leads. The queue is empty.</Banner>
      )}
      {!loading && !error && data && data.leads.length > 0 && (
        <div className="admin-leads-list">
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
    <div style={s.card} className="admin-lead-card">
      <div style={s.rowInline}>
        <span style={s.cardTitle}>{lead.card.name}</span>
        <StatusBadge status={lead.status} />
        {verified && <EvidenceBadge status={lead.evidenceStatus} />}
      </div>
      <div style={s.cardSub}>{lead.card.issuer} · {lead.card.network}</div>

      <div style={s.metaRow}><span style={s.metaLabel}>Lead ID</span><code style={{ fontSize: '0.75rem' }}>{lead.id}</code></div>
      <div style={s.metaRow}><span style={s.metaLabel}>Source URL</span><a href={lead.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.8125rem' }}>{lead.sourceUrl}</a></div>
      <div style={s.metaRow}><span style={s.metaLabel}>Created</span>{formatTimestamp(lead.createdAt)}</div>
      <div style={s.metaRow}><span style={s.metaLabel}>Evidence status</span>{lead.evidenceStatus ?? 'not verified'}</div>
      <div style={s.metaRow}><span style={s.metaLabel}>Verification record</span>{lead.verificationRecordId ?? '—'}</div>

      <button type="button" style={{ ...s.buttonSecondary, marginTop: '0.5rem' }} onClick={() => setExpanded(e => !e)} aria-expanded={expanded}>
        {expanded ? 'Hide proposed Rule data' : 'Show proposed Rule data'}
      </button>
      {expanded && <pre style={{ ...s.pre, marginTop: '0.5rem' }} className="admin-lead-rule-data">{renderJson(lead.proposedRuleData)}</pre>}

      <div style={{ marginTop: '0.85rem' }}>
        <div style={s.label}>Verify</div>
        <div style={s.field}>
          <label style={{ ...s.label, fontSize: '0.75rem' }} htmlFor={`ev-${lead.id}`}>Evidence status</label>
          <select id={`ev-${lead.id}`} style={s.select} value={evidenceStatus} onChange={e => setEvidenceStatus(e.target.value as EvidenceStatus)}>
            {EVIDENCE_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
          </select>
        </div>
        <div style={s.field}>
          <label style={{ ...s.label, fontSize: '0.75rem' }} htmlFor={`notes-${lead.id}`}>Notes (optional)</label>
          <textarea id={`notes-${lead.id}`} style={s.textarea} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reviewer notes" />
        </div>
        <button type="button" style={busy ? s.buttonDisabled : s.button} onClick={callVerify} disabled={busy}>Verify lead</button>
      </div>

      <div style={{ marginTop: '0.85rem' }}>
        <div style={s.label}>Approve</div>
        {verified ? (
          <>
            <div style={s.field}>
              <label style={{ ...s.label, fontSize: '0.75rem' }} htmlFor={`eff-${lead.id}`}>Effective from (YYYY-MM-DD)</label>
              <input id={`eff-${lead.id}`} type="date" style={s.dateInput} value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} />
            </div>
            <button type="button" style={busy ? s.buttonDisabled : s.button} onClick={callApprove} disabled={busy || !effectiveFrom}>Approve & publish</button>
          </>
        ) : (
          <div style={s.notice}>Verify this lead before it can be approved and published.</div>
        )}
      </div>

      <div style={{ marginTop: '0.85rem' }}>
        <div style={s.label}>Reject</div>
        <div style={s.field}>
          <label style={{ ...s.label, fontSize: '0.75rem' }} htmlFor={`rej-${lead.id}`}>Reason</label>
          <textarea id={`rej-${lead.id}`} style={s.textarea} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Why is this lead being rejected?" />
        </div>
        <button type="button" style={busy ? s.buttonDisabled : s.buttonSecondary} onClick={callReject} disabled={busy || !rejectReason.trim()}>Reject lead</button>
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
    <section style={s.section}>
      <div style={s.rowInline}>
        <h2 style={{ ...s.sectionTitle, marginBottom: 0 }}>Retract a published Rule Version</h2>
        <button type="button" style={s.buttonSecondary} onClick={refresh} disabled={loading}>Refresh</button>
      </div>
      <p style={{ ...s.sub, marginBottom: '0.75rem' }}>Current (non-retracted) Rule Versions come from the Versioned Catalog export.</p>
      {loading && <Banner kind="notice">Loading current Rule Versions…</Banner>}
      {error && <Banner kind="error">{error}</Banner>}
      {!loading && !error && versions.length === 0 && (
        <Banner kind="success">No published Rule Versions available to retract.</Banner>
      )}
      {!loading && !error && versions.length > 0 && (
        <>
          <div style={s.field}>
            <label style={s.label} htmlFor="rv-select">Rule Version</label>
            <select id="rv-select" style={s.select} value={selectedId} onChange={e => setSelectedOverride(e.target.value)}>
              {versions.map(({ rv, card }) => {
                const label = `${card.name} (${card.issuer}) — effective ${rv.effectiveFrom}${rv.effectiveTo ? ` to ${rv.effectiveTo}` : ' (open)'} [${rv.id}]`
                return (
                  <option key={rv.id} value={rv.id}>{label}</option>
                )
              })}
            </select>
          </div>
          {selected && (
            <div style={s.card}>
              <div style={s.metaRow}><span style={s.metaLabel}>Card</span>{selected.card.name} · {selected.card.issuer}</div>
              <div style={s.metaRow}><span style={s.metaLabel}>Effective from</span>{selected.rv.effectiveFrom}</div>
              <div style={s.metaRow}><span style={s.metaLabel}>Effective to</span>{selected.rv.effectiveTo ?? 'open'}</div>
              <div style={s.metaRow}><span style={s.metaLabel}>Evidence</span><EvidenceBadge status={selected.rv.evidenceStatus} /></div>
              <details style={{ marginTop: '0.4rem' }}>
                <summary style={{ fontSize: '0.8125rem', cursor: 'pointer', color: '#555' }}>Rule data</summary>
                <pre style={{ ...s.pre, marginTop: '0.4rem' }} className="admin-rv-rule-data">{renderJson(selected.rv.ruleData)}</pre>
              </details>
            </div>
          )}
          <div style={s.field}>
            <label style={s.label} htmlFor="retract-reason">Reason (required)</label>
            <textarea id="retract-reason" style={s.textarea} value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this Rule Version being retracted?" />
          </div>
          <button type="button" style={busy ? s.buttonDisabled : s.button} onClick={callRetract} disabled={busy || !reason.trim() || !selectedId}>Retract Rule Version</button>
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
    <section style={s.section}>
      <h2 style={s.sectionTitle}>Managed delivery</h2>
      <div style={s.card}>
        <div style={s.cardTitle}>Versioned Catalog</div>
        <div style={s.cardSub}>Download the current Versioned Catalog as JSON.</div>
        <button type="button" style={catalogBusy ? s.buttonDisabled : s.button} onClick={downloadCatalog} disabled={catalogBusy}>
          {catalogBusy ? 'Downloading…' : 'Download catalog'}
        </button>
      </div>
      <div style={s.card}>
        <div style={s.cardTitle}>Change Feed</div>
        <div style={s.cardSub}>Download a bounded Change Feed for an explicit since/until range.</div>
        <div style={s.rowInline} className="admin-change-feed-controls">
          <div style={s.field}>
            <label style={s.label} htmlFor="feed-since">Since (YYYY-MM-DD)</label>
            <input id="feed-since" type="date" style={s.dateInput} value={since} onChange={e => setSince(e.target.value)} />
          </div>
          <div style={s.field}>
            <label style={s.label} htmlFor="feed-until">Until (YYYY-MM-DD)</label>
            <input id="feed-until" type="date" style={s.dateInput} value={until} onChange={e => setUntil(e.target.value)} />
          </div>
        </div>
        <button type="button" style={feedBusy ? s.buttonDisabled : s.button} onClick={downloadFeed} disabled={feedBusy}>
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
    <section style={s.section}>
      <h2 style={s.sectionTitle}>Contextual Report detail</h2>
      <p style={{ ...s.sub, marginBottom: '0.75rem' }}>Open a Contextual Report to review its card, Rule Version, evidence, and stored Calculation Trace context.</p>
      <div style={s.rowInline}>
        <div style={{ ...s.field, marginBottom: 0, flex: 1, minWidth: 240 }}>
          <label style={s.label} htmlFor="report-id">Report ID</label>
          <input id="report-id" style={s.input} value={reportId} onChange={e => setReportId(e.target.value)} placeholder="report id" />
        </div>
        <button type="button" style={loading ? s.buttonDisabled : s.button} onClick={load} disabled={loading} className="admin-report-load">
          {loading ? 'Loading…' : 'Open report'}
        </button>
      </div>
      {error && <Banner kind="error">{error}</Banner>}
      {report && (
        <div style={s.card} className="admin-report-detail">
          <div style={s.rowInline}>
            <span style={s.cardTitle}>Report {report.id}</span>
          </div>
          <div style={s.metaRow}><span style={s.metaLabel}>Card</span>{report.card.name} · {report.card.issuer} · {report.card.network}</div>
          <div style={s.metaRow}><span style={s.metaLabel}>Created</span>{formatTimestamp(report.createdAt)}</div>
          <div style={s.metaRow}><span style={s.metaLabel}>Source URL</span>{report.sourceUrl ?? '—'}</div>
          <div style={{ marginTop: '0.5rem' }}>
            <div style={s.label}>Description</div>
            <div style={{ fontSize: '0.875rem' }}>{report.description}</div>
          </div>
          {report.ruleVersion ? (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={s.label}>Rule Version</div>
              <div style={s.metaRow}><span style={s.metaLabel}>ID</span><code style={{ fontSize: '0.75rem' }}>{report.ruleVersion.id}</code></div>
              <div style={s.metaRow}><span style={s.metaLabel}>Effective</span>{report.ruleVersion.effectiveFrom} → {report.ruleVersion.effectiveTo ?? 'open'}</div>
              <div style={s.metaRow}><span style={s.metaLabel}>Retracted</span>{report.ruleVersion.retractedAt ? formatTimestamp(report.ruleVersion.retractedAt) : 'no'}</div>
              <details style={{ marginTop: '0.4rem' }}>
                <summary style={{ fontSize: '0.8125rem', cursor: 'pointer', color: '#555' }}>Rule data</summary>
                <pre style={{ ...s.pre, marginTop: '0.4rem' }} className="admin-report-rule-data">{renderJson(report.ruleVersion.ruleData)}</pre>
              </details>
            </div>
          ) : (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={s.label}>Rule Version</div>
              <div style={{ fontSize: '0.875rem', color: '#555' }}>No Rule Version linked to this report.</div>
            </div>
          )}
          {report.verificationRecord ? (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={s.label}>Evidence</div>
              <div style={s.metaRow}><span style={s.metaLabel}>Status</span><EvidenceBadge status={report.verificationRecord.evidenceStatus} /></div>
              <div style={s.metaRow}><span style={s.metaLabel}>Verified</span>{formatTimestamp(report.verificationRecord.verifiedAt)}</div>
              <div style={s.metaRow}><span style={s.metaLabel}>Notes</span>{report.verificationRecord.notes ?? '—'}</div>
            </div>
          ) : (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={s.label}>Evidence</div>
              <div style={{ fontSize: '0.875rem', color: '#555' }}>No verification record.</div>
            </div>
          )}
          <div style={{ marginTop: '0.75rem' }}>
            <div style={s.label}>Calculation Trace context</div>
            {report.traceContext === null || report.traceContext === undefined ? (
              <div style={{ fontSize: '0.875rem', color: '#555' }}>No trace context stored on this report.</div>
            ) : (
              <pre style={s.pre} className="admin-report-trace-context">{renderJson(report.traceContext)}</pre>
            )}
          </div>
        </div>
      )}
    </section>
  )
}