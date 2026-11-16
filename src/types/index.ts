export interface AuthUser {
  id?: string
  username?: string
  email?: string
  full_name?: string
}

export interface AuthSession {
  accessToken: string
  refreshToken?: string
  tokenType: 'Bearer'
  expiresAt: number
  user?: AuthUser
}

export type TokenStorage = 'memory' | 'session'

export interface AuthClientOptions {
  /** Origin of UMMU Auth Service, for example https://auth.example.ummu.ac.id */
  authServiceUrl: string
  /** Base URL for protected API requests. Defaults to authServiceUrl. */
  apiBaseUrl?: string
  /** Token persistence; defaults to memory. */
  tokenStorage?: TokenStorage
  /** Fetch implementation, useful for tests and custom browser environments. */
  fetch?: typeof globalThis.fetch
}

export interface LoginOptions {
  /** Optional path/query/hash to navigate to after callback processing. */
  returnTo?: string
}
