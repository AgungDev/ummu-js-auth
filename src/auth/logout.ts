import type { TokenManager } from '../token/manager.js'

export async function logout(
  authServiceUrl: string,
  tokens: TokenManager,
  fetchImpl: typeof globalThis.fetch,
): Promise<void> {
  const accessToken = tokens.getAccessToken()
  tokens.clear()
  if (!accessToken) return

  const response = await fetchImpl(`${authServiceUrl}/api/v1/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error(`Logout failed (HTTP ${response.status}).`)
  }
}
