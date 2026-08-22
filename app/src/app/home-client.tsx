'use client'

import { useEffect, useState } from 'react'
import type { CalcResult, TraceEntry } from '@/engine/types'
import type { EvidenceStatus } from '@/catalog/evidence'

type CardOption = { id: string; name: string; issuer: string; rewardCurrency: string }
type RuleMeta = { evidenceStatus: string; sourceDate: string; retractedAt?: string | null }
type CardResult = { card: CardOption; result: CalcResult; ruleMeta: Record<string, RuleMeta> }

const CATEGORIES = [
  { value: 'dining', label: 'Dining' },
  { value: 'travel', label: 'Travel' },
  { value: 'online', label: 'Online Shopping' },
  { value: 'grocery', label: 'Grocery' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'rent', label: 'Rent' },
  { value: 'wallet-load', label: 'Wallet Load' },
  { value: 'other', label: 'Other' },
]

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

const EVIDENCE_COLORS: Record<EvidenceStatus, { background: string; color: string }> = {
  'officially-documented': { background: '#d4edda', color: '#155724' },
  'statement-verified': { background: '#cce5ff', color: '#004085' },
  'inferred': { background: '#fff3cd', color: '#856404' },
  'community-reported': { background: '#f8d7da', color: '#721c24' },
}

const s: Record<string, React.CSSProperties> = {
  page: { fontFamily: 'system-ui, sans-serif', maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem', color: '#1a1a1a' },
  heading: { fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.25rem' },
  sub: { fontSize: '0.875rem', color: '#555', marginBottom: '1.75rem' },
  field: { marginBottom: '1rem' },
  label: { display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.3rem' },
  input: { display: 'block', width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.625rem', fontSize: '0.9375rem', border: '1px solid #ccc', borderRadius: 6, background: '#fff' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  button: { marginTop: '0.5rem', width: '100%', padding: '0.65rem 1rem', fontSize: '1rem', fontWeight: 600, background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' },
  error: { marginTop: '1rem', padding: '0.75rem', background: '#fff0f0', border: '1px solid #f5c6c6', borderRadius: 6, fontSize: '0.875rem', color: '#b00' },
  badge: { display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700 },
  cardList: { display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: 200, overflowY: 'auto', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 6, background: '#fafafa' },
  cardCheckItem: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', userSelect: 'none' },
  selectLinks: { display: 'flex', gap: '1rem', fontSize: '0.8125rem', marginTop: '0.35rem', alignItems: 'center' },
  linkBtn: { color: '#1a1a1a', textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontSize: '0.8125rem' },
  resultsGrid: { marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', alignItems: 'start' },
  outcomeCard: { padding: '1rem', background: '#f8f8f8', border: '1px solid #ddd', borderRadius: 8 },
  outcomeCardUnresolved: { background: '#fffbf0', border: '1px solid #f0d060' },
  cardName: { fontWeight: 700, fontSize: '1rem' },
  cardIssuer: { fontSize: '0.8125rem', color: '#555', marginBottom: '0.5rem' },
  cardStatusRow: { marginBottom: '0.75rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' as const },
  metricRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: '1px solid #eee', fontSize: '0.875rem' },
  metricLabel: { color: '#555' },
  metricValue: { fontWeight: 600 },
  unresolvedReason: { fontSize: '0.8125rem', color: '#856404', background: '#fff3cd', borderRadius: 4, padding: '0.4rem 0.6rem', margin: '0.5rem 0' },
  traceToggle: { display: 'block', width: '100%', marginTop: '0.75rem', padding: '0.4rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, background: '#fff', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', textAlign: 'left' as const },
  traceSection: { marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  traceEntry: { padding: '0.5rem 0.6rem', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: '0.8125rem' },
  traceApplied: { border: '1px solid #a8d5a2', background: '#f0faf0' },
  traceEntryHeader: { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' as const, marginBottom: '0.25rem' },
  traceRuleId: { fontFamily: 'monospace', fontSize: '0.75rem', color: '#555' },
  traceDate: { fontSize: '0.75rem', color: '#777' },
  traceReason: { color: '#333', marginBottom: '0.2rem' },
  tracePoints: { fontWeight: 600, marginBottom: '0.2rem' },
  traceInputs: { color: '#666', fontSize: '0.75rem', marginBottom: '0.2rem' },
  traceAssumptions: { color: '#555', fontStyle: 'italic', fontSize: '0.75rem', marginBottom: '0.2rem' },
  traceMeta: { display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem', flexWrap: 'wrap' as const },
  traceMetaDate: { fontSize: '0.75rem', color: '#777' },
  assumptionsBlock: { marginTop: '0.5rem', padding: '0.4rem 0.5rem', background: '#f5f5f5', borderRadius: 4, fontSize: '0.8125rem', color: '#555', fontStyle: 'italic' },
  reportBtn: { marginTop: '0.5rem', fontSize: '0.75rem', color: '#555', background: 'none', border: '1px solid #ccc', borderRadius: 4, padding: '0.2rem 0.5rem', cursor: 'pointer' },
  reportForm: { marginTop: '0.5rem', padding: '0.6rem', background: '#fffbf0', border: '1px solid #f0d060', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  reportTextarea: { width: '100%', boxSizing: 'border-box', fontSize: '0.8125rem', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, resize: 'vertical' as const, minHeight: 60 },
  reportInput: { width: '100%', boxSizing: 'border-box', fontSize: '0.8125rem', padding: '0.3rem 0.4rem', border: '1px solid #ccc', borderRadius: 4 },
  reportSubmit: { alignSelf: 'flex-start', fontSize: '0.8125rem', padding: '0.3rem 0.75rem', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' },
  reportSuccess: { fontSize: '0.75rem', color: '#155724', background: '#d4edda', borderRadius: 4, padding: '0.3rem 0.5rem' },
}

const disabledOverride: React.CSSProperties = { background: '#888', cursor: 'not-allowed' }

function formatPaise(paise: number | null): string {
  if (paise === null) return '—'
  return `₹${(paise / 100).toFixed(2)}`
}

function EvidenceBadge({ status }: { status: string | undefined }) {
  if (!status) return null
  const c = EVIDENCE_COLORS[status as EvidenceStatus] ?? { background: '#e9ecef', color: '#333' }
  return <span style={{ ...s.badge, ...c }}>{status.replace(/-/g, ' ')}</span>
}

function ReportForm({ cardId, ruleVersionId }: { cardId: string; ruleVersionId: string }) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    setSubmitting(true)
    try {
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, ruleVersionId, description, sourceUrl: sourceUrl || undefined }),
      })
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return <div style={s.reportSuccess}>Report submitted — thank you. A Data Lead has been created for review.</div>
  }

  return (
    <>
      {!open && (
        <button style={s.reportBtn} type="button" onClick={() => setOpen(true)}>
          Report an issue with this rule
        </button>
      )}
      {open && (
        <form style={s.reportForm} onSubmit={submit}>
          <label style={{ ...s.label, marginBottom: 0 }}>Describe the issue</label>
          <textarea
            style={s.reportTextarea}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. The multiplier for dining is 3x, not 5x"
            required
          />
          <input
            style={s.reportInput}
            type="url"
            value={sourceUrl}
            onChange={e => setSourceUrl(e.target.value)}
            placeholder="Source URL (optional)"
          />
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              style={submitting || !description.trim() ? { ...s.reportSubmit, ...disabledOverride } : s.reportSubmit}
              type="submit"
              disabled={submitting || !description.trim()}
            >
              {submitting ? 'Submitting…' : 'Submit report'}
            </button>
            <button style={{ ...s.reportBtn, marginTop: 0 }} type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </>
  )
}

function TraceSection({
  entries, ruleMeta, cardId,
}: {
  entries: TraceEntry[]
  ruleMeta: Record<string, RuleMeta>
  cardId: string
}) {
  return (
    <div style={s.traceSection}>
      {entries.map(e => (
        <div key={e.ruleId} style={{ ...s.traceEntry, ...(e.applied ? s.traceApplied : {}) }}>
          <div style={s.traceEntryHeader}>
            <span style={s.traceRuleId}>{e.ruleId}</span>
            {e.applied && <span style={{ ...s.badge, background: '#d4edda', color: '#155724' }}>applied</span>}
            {ruleMeta[e.ruleId]?.retractedAt && (
              <span style={{ ...s.badge, background: '#f8d7da', color: '#721c24' }}>retracted</span>
            )}
            <span style={s.traceDate}>eff.&nbsp;{e.ruleEffectiveFrom}</span>
          </div>
          <div style={s.traceReason}>{e.reason}</div>
          {e.pointsAfterCap !== null && (
            <div style={s.tracePoints}>
              {e.pointsAfterCap}&nbsp;pts
              {e.pointsBeforeCap !== null && e.pointsBeforeCap !== e.pointsAfterCap
                ? ` (uncapped: ${e.pointsBeforeCap})` : ''}
            </div>
          )}
          <div style={s.traceInputs}>
            {e.inputs.merchantCategory}&nbsp;·&nbsp;{e.inputs.pointsPerDollar}x
            {e.inputs.capPoints !== null ? ` · cap ${e.inputs.capPoints}` : ''}
            {e.inputs.categories.length > 0
              ? ` · cats: ${e.inputs.categories.join(', ')}`
              : ' · all cats'}
            {e.inputs.exclusions.length > 0 ? ` · excl: ${e.inputs.exclusions.join(', ')}` : ''}
          </div>
          {e.assumptions.length > 0 && (
            <div style={s.traceAssumptions}>
              {e.assumptions.map((a, i) => <div key={i}>{a}</div>)}
            </div>
          )}
          {ruleMeta[e.ruleId] && (
            <div style={s.traceMeta}>
              <EvidenceBadge status={ruleMeta[e.ruleId].evidenceStatus} />
              <span style={s.traceMetaDate}>src&nbsp;{ruleMeta[e.ruleId].sourceDate}</span>
            </div>
          )}
          <ReportForm cardId={cardId} ruleVersionId={e.ruleId} />
        </div>
      ))}
    </div>
  )
}

function OutcomeCard({
  cr, traceOpen, onToggleTrace,
}: {
  cr: CardResult; traceOpen: boolean; onToggleTrace: () => void
}) {
  const { card, result, ruleMeta } = cr
  const appliedMeta = result.ruleApplied ? ruleMeta[result.ruleApplied] : undefined
  const appliedEntry = result.ruleApplied
    ? result.trace.entries.find(e => e.ruleId === result.ruleApplied)
    : undefined
  const isRetracted = !!(appliedMeta?.retractedAt)
  return (
    <div style={{ ...s.outcomeCard, ...(result.resolved ? {} : s.outcomeCardUnresolved) }}>
      <div style={s.cardName}>{card.name}</div>
      <div style={s.cardIssuer}>{card.issuer}</div>
      <div style={s.cardStatusRow}>
        <span style={{ ...s.badge, ...(result.resolved
          ? { background: '#d4edda', color: '#155724' }
          : { background: '#fff3cd', color: '#856404' }) }}>
          {result.resolved ? 'Resolved' : 'Unresolved'}
        </span>
        {isRetracted && (
          <span style={{ ...s.badge, background: '#f8d7da', color: '#721c24' }}>
            rule retracted
          </span>
        )}
      </div>
      <div style={s.metricRow}>
        <span style={s.metricLabel}>Rewards earned</span>
        <span style={s.metricValue}>{result.rewardsEarned}&nbsp;pts</span>
      </div>
      {result.resolved && result.netReturnCents !== null && (
        <div style={s.metricRow}>
          <span style={s.metricLabel}>Net return</span>
          <span style={s.metricValue}>{formatPaise(result.netReturnCents)}</span>
        </div>
      )}
      {result.resolved && result.annualFeeAmortizedCents !== null && (
        <div style={s.metricRow}>
          <span style={s.metricLabel}>Annual fee (monthly)</span>
          <span style={s.metricValue}>{formatPaise(result.annualFeeAmortizedCents)}</span>
        </div>
      )}
      {!result.resolved && <div style={s.unresolvedReason}>{result.reason}</div>}
      {appliedMeta && (
        <div style={s.metricRow}>
          <span style={s.metricLabel}>Evidence</span>
          <EvidenceBadge status={appliedMeta.evidenceStatus} />
        </div>
      )}
      {appliedMeta && (
        <div style={s.metricRow}>
          <span style={s.metricLabel}>Source verified</span>
          <span style={s.metricValue}>{appliedMeta.sourceDate}</span>
        </div>
      )}
      {appliedEntry && (
        <div style={s.metricRow}>
          <span style={s.metricLabel}>Rule effective from</span>
          <span style={s.metricValue}>{appliedEntry.ruleEffectiveFrom}</span>
        </div>
      )}
      {appliedEntry && appliedEntry.assumptions.length > 0 && (
        <div style={s.assumptionsBlock}>
          {appliedEntry.assumptions.map((a, i) => <div key={i}>{a}</div>)}
        </div>
      )}
      <button style={s.traceToggle} onClick={onToggleTrace} type="button">
        {traceOpen ? '▲' : '▼'}&nbsp;Calculation trace&nbsp;({result.trace.entries.length}&nbsp;rules)
      </button>
      {traceOpen && (
        <TraceSection entries={result.trace.entries} ruleMeta={ruleMeta} cardId={card.id} />
      )}
    </div>
  )
}

type CorrectionEntry = {
  id: string
  ruleVersionId: string
  retractionReason: string
  retractedAt: string
  card: { id: string; name: string; issuer: string }
}

function CorrectionHistorySection() {
  const [entries, setEntries] = useState<CorrectionEntry[]>([])
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)

  async function load() {
    if (loaded) { setOpen(true); return }
    const res = await fetch('/api/correction-history')
    const data = await res.json()
    setEntries(data.entries ?? [])
    setLoaded(true)
    setOpen(true)
  }

  return (
    <div style={{ marginTop: '2rem', borderTop: '1px solid #e0e0e0', paddingTop: '1rem' }}>
      <button style={s.linkBtn} type="button" onClick={open ? () => setOpen(false) : load}>
        {open ? '▲' : '▼'}&nbsp;Correction History
      </button>
      {open && (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {entries.length === 0 && (
            <p style={{ fontSize: '0.875rem', color: '#555' }}>No corrections on record.</p>
          )}
          {entries.map(e => (
            <div key={e.id} style={{ padding: '0.6rem 0.75rem', background: '#fff8f0', border: '1px solid #f0c060', borderRadius: 6, fontSize: '0.8125rem' }}>
              <div style={{ fontWeight: 600 }}>{e.card.issuer} — {e.card.name}</div>
              <div style={{ color: '#555', marginTop: '0.2rem' }}>{e.retractionReason}</div>
              <div style={{ color: '#888', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                Rule version {e.ruleVersionId.slice(0, 8)}… retracted {new Date(e.retractedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function toggleItem(set: Set<string>, key: string): Set<string> {
  const next = new Set(set)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

export default function HomeClient() {
  const [cards, setCards] = useState<CardOption[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [amountRupees, setAmountRupees] = useState('')
  const [merchantName, setMerchantName] = useState('')
  const [merchantCategory, setMerchantCategory] = useState('dining')
  const [transactionDate, setTransactionDate] = useState(todayIso())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<CardResult[]>([])
  const [openTraces, setOpenTraces] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/cards')
      .then(r => r.json())
      .then(({ cards }) => {
        setCards(cards)
        if (cards.length > 0) setSelectedIds(new Set([cards[0].id]))
      })
      .catch(() => setError('Failed to load cards'))
  }, [])

  function toggleCard(id: string) {
    setSelectedIds(prev => toggleItem(prev, id))
  }

  function toggleTrace(cardId: string) {
    setOpenTraces(prev => toggleItem(prev, cardId))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResults([])
    const amount = parseFloat(amountRupees)
    if (!amount || amount <= 0) { setError('Enter a valid amount'); return }
    if (selectedIds.size === 0) { setError('Select at least one card'); return }
    setSubmitting(true)
    try {
      const responses = await Promise.all(
        Array.from(selectedIds).map(async cardId => {
          const res = await fetch('/api/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cardId, amountRupees: amount, merchantName, merchantCategory, transactionDate }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error ?? 'Calculation failed')
          const card = cards.find(c => c.id === cardId)!
          return { card, result: data.result as CalcResult, ruleMeta: (data.ruleMeta ?? {}) as Record<string, RuleMeta> }
        })
      )
      setResults(responses)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation failed')
    } finally {
      setSubmitting(false)
    }
  }

  const ready = cards.length > 0
  const canSubmit = ready && selectedIds.size > 0 && !submitting

  return (
    <main style={s.page}>
      <style>{`@media (max-width: 500px) { .form-row { grid-template-columns: 1fr !important; } }`}</style>
      <h1 style={s.heading}>Credit Card Intelligence Platform</h1>
      <p style={s.sub}>Compare rewards across cards for a single transaction — no login required.</p>

      <form onSubmit={handleSubmit} noValidate>
        <div style={s.field}>
          <label style={s.label}>Cards to compare</label>
          {!ready && <div style={{ ...s.input, color: '#888' }}>Loading cards…</div>}
          {ready && (
            <>
              <div style={s.cardList}>
                {cards.map(c => (
                  <label key={c.id} style={s.cardCheckItem}>
                    <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleCard(c.id)} />
                    {c.issuer} — {c.name}
                  </label>
                ))}
              </div>
              <div style={s.selectLinks}>
                <button type="button" style={s.linkBtn} onClick={() => setSelectedIds(new Set(cards.map(c => c.id)))}>Select all</button>
                <button type="button" style={s.linkBtn} onClick={() => setSelectedIds(new Set())}>Clear</button>
                <span style={{ color: '#888' }}>{selectedIds.size} selected</span>
              </div>
            </>
          )}
        </div>

        <div style={s.row} className="form-row">
          <div style={s.field}>
            <label style={s.label} htmlFor="amount">Amount (₹)</label>
            <input id="amount" type="number" min="1" step="0.01" style={s.input} value={amountRupees}
              onChange={e => setAmountRupees(e.target.value)} placeholder="e.g. 2500" required />
          </div>
          <div style={s.field}>
            <label style={s.label} htmlFor="date">Transaction date</label>
            <input id="date" type="date" style={s.input} value={transactionDate}
              onChange={e => setTransactionDate(e.target.value)} required />
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label} htmlFor="merchant">Merchant name (optional)</label>
          <input id="merchant" type="text" style={s.input} value={merchantName}
            onChange={e => setMerchantName(e.target.value)} placeholder="e.g. Swiggy" />
        </div>

        <div style={s.field}>
          <label style={s.label} htmlFor="category">Merchant category</label>
          <select id="category" style={s.input} value={merchantCategory} onChange={e => setMerchantCategory(e.target.value)} required>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <button type="submit" style={{ ...s.button, ...(canSubmit ? {} : disabledOverride) }} disabled={!canSubmit}>
          {submitting ? 'Calculating…' : `Compare ${selectedIds.size > 1 ? `${selectedIds.size} cards` : 'card'}`}
        </button>
      </form>

      {error && <div role="alert" style={s.error}>{error}</div>}

      {results.length > 0 && (
        <div style={s.resultsGrid}>
          {results.map(cr => (
            <OutcomeCard
              key={cr.card.id}
              cr={cr}
              traceOpen={openTraces.has(cr.card.id)}
              onToggleTrace={() => toggleTrace(cr.card.id)}
            />
          ))}
        </div>
      )}

      <CorrectionHistorySection />
    </main>
  )
}
