import { startGoogleLogin, LOGIN_PENDING_KEY, RETURN_TO_KEY } from './login.js'
import { logout as logoutService } from './logout.js'
import { AuthenticatedHttpClient } from '../http/client.js'
import { SessionManager } from '../session/session.js'
import { TokenManager } from '../token/manager.js'
import type { AuthClientOptions, AuthSession, LoginOptions } from '../types/index.js'

function normalizeServiceUrl(value: string): string {
  const url = new URL(value)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error('authServiceUrl must be an HTTP(S) origin without credentials, path, query, or fragment.')
  }
  return url.toString().replace(/\/+$/, '')
}

function parseCallbackFragment(fragment: string): AuthSession {
  const params = new URLSearchParams(fragment.replace(/^#/, ''))
  const error = params.get('error')
  if (error) {
    throw new Error(`Google login failed: ${error}`)
  }

  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  const tokenType = params.get('token_type')
  const expiresIn = Number(params.get('expires_in'))
  if (
    !accessToken ||
    !refreshToken ||
    tokenType?.toLowerCase() !== 'bearer' ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0
  ) {
    throw new Error('Auth callback did not contain valid token data.')
  }

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresAt: Date.now() + expiresIn * 1000,
  }
}

export class UMMUAuthClient {
  readonly sessions: SessionManager
  readonly http: AuthenticatedHttpClient
  private readonly authServiceUrl: string
  private readonly tokens: TokenManager
  private readonly fetchImpl: typeof globalThis.fetch

  constructor(options: AuthClientOptions) {
    this.authServiceUrl = normalizeServiceUrl(options.authServiceUrl)
    const apiBaseUrl = normalizeServiceUrl(options.apiBaseUrl ?? options.authServiceUrl)
    this.tokens = new TokenManager(options.tokenStorage ?? 'memory')
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis)
    this.sessions = new SessionManager(this.tokens)
    this.http = new AuthenticatedHttpClient(
      apiBaseUrl,
      this.authServiceUrl,
      this.tokens,
      this.fetchImpl,
    )
  }

  login(options?: LoginOptions): void {
    startGoogleLogin(this.authServiceUrl, options)
  }

  handleCallback(): AuthSession {
    const fragment = globalThis.location.hash
    globalThis.history.replaceState(
      null,
      '',
      `${globalThis.location.pathname}${globalThis.location.search}`,
    )
    const isPending = globalThis.sessionStorage.getItem(LOGIN_PENDING_KEY) === '1'
    globalThis.sessionStorage.removeItem(LOGIN_PENDING_KEY)
    if (!isPending) {
      globalThis.sessionStorage.removeItem(RETURN_TO_KEY)
      throw new Error('No UMMU login is pending in this browser session.')
    }

    const session = parseCallbackFragment(fragment)
    this.tokens.setSession(session)
    return session
  }

  consumeReturnTo(): string | null {
    const returnTo = globalThis.sessionStorage.getItem(RETURN_TO_KEY)
    globalThis.sessionStorage.removeItem(RETURN_TO_KEY)
    return returnTo
  }

  getSession(): AuthSession | null {
    return this.sessions.get()
  }

  logout(): Promise<void> {
    return logoutService(this.authServiceUrl, this.tokens, this.fetchImpl)
  }
}
