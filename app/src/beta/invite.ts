import { randomBytes } from 'crypto'

export const BETA_COOKIE = 'beta_access'

export function generateInviteCode(): string {
  return randomBytes(12).toString('hex')
}

export function isValidCodeFormat(code: unknown): code is string {
  return typeof code === 'string' && /^[0-9a-f]{24}$/.test(code)
}
