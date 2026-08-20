type LeadRow = { status: string; verification_record_id: string | null }

export function isPendingLead(lead: { status: string }): boolean {
  return lead.status === 'pending'
}

export function validateLeadForApproval(
  lead: LeadRow
): { ok: true } | { ok: false; error: string } {
  if (!isPendingLead(lead)) {
    return { ok: false, error: `lead status is '${lead.status}', must be 'pending'` }
  }
  if (!lead.verification_record_id) {
    return { ok: false, error: 'a verification record must be attached before approval' }
  }
  return { ok: true }
}

export function validateLeadForRejection(
  lead: { status: string },
  reason: unknown
): { ok: true } | { ok: false; error: string } {
  if (!isPendingLead(lead)) {
    return { ok: false, error: `lead status is '${lead.status}', must be 'pending'` }
  }
  if (typeof reason !== 'string' || !reason.trim()) {
    return { ok: false, error: 'rejection reason is required' }
  }
  return { ok: true }
}
