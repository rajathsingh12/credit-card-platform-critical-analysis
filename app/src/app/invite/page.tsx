'use client'

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

const s: Record<string, React.CSSProperties> = {
  page: { fontFamily: 'system-ui, sans-serif', maxWidth: 400, margin: '6rem auto', padding: '0 1rem', color: '#1a1a1a' },
  heading: { fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.25rem' },
  sub: { fontSize: '0.875rem', color: '#555', marginBottom: '1.5rem' },
  field: { marginBottom: '1rem' },
  label: { display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.3rem' },
  input: { display: 'block', width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.625rem', fontSize: '0.9375rem', border: '1px solid #ccc', borderRadius: 6, background: '#fff', fontFamily: 'monospace' },
  button: { width: '100%', padding: '0.65rem 1rem', fontSize: '1rem', fontWeight: 600, background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', marginTop: '0.25rem' },
  buttonDisabled: { width: '100%', padding: '0.65rem 1rem', fontSize: '1rem', fontWeight: 600, background: '#888', color: '#fff', border: 'none', borderRadius: 6, cursor: 'not-allowed', marginTop: '0.25rem' },
  error: { marginTop: '0.75rem', padding: '0.6rem 0.75rem', background: '#fff0f0', border: '1px solid #f5c6c6', borderRadius: 6, fontSize: '0.875rem', color: '#b00' },
  revoked: { marginBottom: '1rem', padding: '0.6rem 0.75rem', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 6, fontSize: '0.875rem', color: '#856404' },
}

function InviteForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const revoked = searchParams.get('revoked') === '1'

  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/invite/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Invalid invite code')
        return
      }
      router.push('/')
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main style={s.page}>
      <h1 style={s.heading}>Beta Access</h1>
      <p style={s.sub}>Enter your invite code to access the calculator.</p>
      {revoked && (
        <div role="alert" style={s.revoked}>
          Your invite code has been revoked. Contact the team for a new one.
        </div>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <div style={s.field}>
          <label style={s.label} htmlFor="code">Invite code</label>
          <input
            id="code"
            type="text"
            style={s.input}
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="24-character code"
            autoComplete="off"
            spellCheck={false}
            required
          />
        </div>
        <button
          type="submit"
          style={submitting || !code.trim() ? s.buttonDisabled : s.button}
          disabled={submitting || !code.trim()}
        >
          {submitting ? 'Verifying…' : 'Enter'}
        </button>
      </form>
      {error && <div role="alert" style={s.error}>{error}</div>}
    </main>
  )
}

export default function InvitePage() {
  return (
    <Suspense>
      <InviteForm />
    </Suspense>
  )
}
