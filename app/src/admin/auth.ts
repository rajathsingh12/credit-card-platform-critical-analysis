export function checkAdminAuth(authorizationHeader: string | null | undefined): boolean {
  const token = process.env.ADMIN_TOKEN
  if (!token) return false
  if (!authorizationHeader) return false
  const provided = authorizationHeader.replace(/^Bearer\s+/i, '').trim()
  return provided === token
}
