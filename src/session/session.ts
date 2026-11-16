import type { AuthSession } from '../types/index.js'
import type { TokenManager } from '../token/manager.js'

export class SessionManager {
  constructor(private readonly tokens: TokenManager) {}

  get(): AuthSession | null {
    return this.tokens.getSession()
  }

  isAuthenticated(): boolean {
    return this.tokens.getSession() !== null
  }

  subscribe(listener: (session: AuthSession | null) => void): () => void {
    return this.tokens.subscribe(listener)
  }
}
