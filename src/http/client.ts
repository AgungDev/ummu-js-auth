import type { AuthSession } from '../types/index.js'
import type { TokenManager } from '../token/manager.js'

interface ApiEnvelope<T> {
  data?: T
  message?: string
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

function readTokenResponse(value: unknown): TokenResponse {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Auth Service returned an invalid token response.')
  }
  const envelope = value as ApiEnvelope<unknown>
  if (typeof envelope.data !== 'object' || envelope.data === null) {
    throw new Error(envelope.message || 'Auth Service returned no token data.')
  }
  const data = envelope.data as Record<string, unknown>
  if (
    typeof data.access_token !== 'string' ||
    !data.access_token ||
    typeof data.refresh_token !== 'string' ||
    !data.refresh_token ||
    data.token_type !== 'Bearer' ||
    typeof data.expires_in !== 'number' ||
    !Number.isFinite(data.expires_in) ||
    data.expires_in <= 0
  ) {
    throw new Error('Auth Service returned an invalid token response.')
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: data.token_type,
    expires_in: data.expires_in,
  }
}

export class AuthenticatedHttpClient {
  private refreshInFlight: Promise<AuthSession | null> | null = null
  private readonly apiOrigin: string

  constructor(
    private readonly apiBaseUrl: string,
    private readonly authServiceUrl: string,
    private readonly tokens: TokenManager,
    private readonly fetchImpl: typeof globalThis.fetch,
  ) {
    this.apiOrigin = new URL(apiBaseUrl).origin
  }

  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = new Request(this.resolveUrl(input), init)
    if (new URL(request.url).origin !== this.apiOrigin) {
      return this.fetchImpl(request)
    }

    const accessToken = this.tokens.getAccessToken()
    if (accessToken) request.headers.set('Authorization', `Bearer ${accessToken}`)

    const response = await this.fetchImpl(request.clone())
    if (response.status !== 401 || !this.tokens.getSession()?.refreshToken) {
      return response
    }

    const refreshed = await this.refreshSession()
    if (!refreshed) return response
    const retry = request.clone()
    retry.headers.set('Authorization', `Bearer ${refreshed.accessToken}`)
    return this.fetchImpl(retry)
  }

  private resolveUrl(input: RequestInfo | URL): RequestInfo | URL {
    if (input instanceof Request) return input
    if (input instanceof URL) return input
    if (/^https?:\/\//i.test(input)) return input
    return `${this.apiBaseUrl}${input.startsWith('/') ? input : `/${input}`}`
  }

  private refreshSession(): Promise<AuthSession | null> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.performRefresh().finally(() => {
        this.refreshInFlight = null
      })
    }
    return this.refreshInFlight
  }

  private async performRefresh(): Promise<AuthSession | null> {
    const current = this.tokens.getSession()
    if (!current?.refreshToken) return null

    const response = await this.fetchImpl(
      `${this.authServiceUrl}/api/v1/auth/refresh`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: current.refreshToken }),
      },
    )
    if (!response.ok) {
      if (this.tokens.getSession()?.refreshToken === current.refreshToken) {
        this.tokens.clear()
      }
      throw new Error(`Token refresh failed (HTTP ${response.status}).`)
    }

    const result = readTokenResponse(await response.json())
    if (this.tokens.getSession()?.refreshToken !== current.refreshToken) return null
    const session: AuthSession = {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      tokenType: 'Bearer',
      expiresAt: Date.now() + result.expires_in * 1000,
      user: current.user,
    }
    this.tokens.setSession(session)
    return session
  }
}
