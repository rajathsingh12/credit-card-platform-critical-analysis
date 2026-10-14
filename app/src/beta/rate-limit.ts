export const WRITE_LIMIT_PER_WINDOW = 30
export const WRITE_WINDOW_MS = 60_000

/** ponytail: in-process window store — per-instance, so on a multi-instance
 *  host the effective limit multiplies by the instance count. Good enough to
 *  stop one invite code hammering the database; move to a shared counter
 *  (Postgres or Redis) if the limit ever needs to be exact. */
const windows = new Map<string, { count: number; resetAt: number }>()

export function takeWriteSlot(key: string, now: number): boolean {
  const window = windows.get(key)
  if (!window || now >= window.resetAt) {
    windows.set(key, { count: 1, resetAt: now + WRITE_WINDOW_MS })
    return true
  }
  if (window.count >= WRITE_LIMIT_PER_WINDOW) return false
  window.count += 1
  return true
}
