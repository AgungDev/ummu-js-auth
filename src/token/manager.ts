import type { AuthSession, TokenStorage } from '../types/index.js'

const SESSION_KEY = 'ummu.js-auth.session'

function isAuthSession(value: unknown): value is AuthSession {
  if (typeof value !== 'object' || value === null) return false
  const session = value as Record<string, unknown>
  return (
    typeof session.accessToken === 'string' &&
    session.accessToken.length > 0 &&
    session.tokenType === 'Bearer' &&
    typeof session.expiresAt === 'number' &&
    Number.isFinite(session.expiresAt) &&
    (session.expiresAt > Date.now() ||
      (typeof session.refreshToken === 'string' && session.refreshToken.length > 0))
  )
}

export class TokenManager {
  private session: AuthSession | null = null
  private readonly storage: Storage | null
  private readonly listeners = new Set<(session: AuthSession | null) => void>()

  constructor(storage: TokenStorage = 'memory') {
    this.storage = storage === 'session' ? globalThis.sessionStorage : null
    if (this.storage) this.session = this.readStoredSession()
  }

  getSession(): AuthSession | null {
    return this.session ? { ...this.session } : null
  }

  getAccessToken(): string | null {
    return this.session?.accessToken ?? null
  }

  setSession(session: AuthSession): void {
    this.session = { ...session }
    if (this.storage) {
      this.storage.setItem(SESSION_KEY, JSON.stringify(this.session))
    }
    this.notify()
  }

  clear(): void {
    this.session = null
    this.storage?.removeItem(SESSION_KEY)
    this.notify()
  }

  subscribe(listener: (session: AuthSession | null) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private readStoredSession(): AuthSession | null {
    const raw = this.storage?.getItem(SESSION_KEY)
    if (!raw) return null

    try {
      const session: unknown = JSON.parse(raw)
      if (isAuthSession(session)) return session
    } catch {
      this.storage?.removeItem(SESSION_KEY)
      return null
    }

    this.storage?.removeItem(SESSION_KEY)
    return null
  }

  private notify(): void {
    const session = this.getSession()
    for (const listener of this.listeners) listener(session)
  }
}
