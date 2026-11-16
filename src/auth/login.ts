import type { LoginOptions } from '../types/index.js'

export const LOGIN_PENDING_KEY = 'ummu.js-auth.login-pending'
export const RETURN_TO_KEY = 'ummu.js-auth.return-to'

export function startGoogleLogin(
  authServiceUrl: string,
  options: LoginOptions = {},
): void {
  globalThis.sessionStorage.setItem(LOGIN_PENDING_KEY, '1')
  if (options.returnTo) {
    globalThis.sessionStorage.setItem(RETURN_TO_KEY, options.returnTo)
  } else {
    globalThis.sessionStorage.removeItem(RETURN_TO_KEY)
  }
  globalThis.location.assign(`${authServiceUrl}/auth/google?response=frontend`)
}
