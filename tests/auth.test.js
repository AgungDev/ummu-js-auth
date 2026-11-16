import assert from 'node:assert/strict'
import test from 'node:test'
import { UMMUAuthClient } from '../dist/auth/client.js'
import { TokenManager } from '../dist/token/manager.js'

function fakeBrowser(hash = '') {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
    key: () => null,
    get length() {
      return values.size
    },
  }
  const browser = {
    location: { hash, pathname: '/oauth/callback', search: '' },
    sessionStorage: storage,
    history: { replaceState: (...args) => browser.history.calls.push(args), calls: [] },
  }
  globalThis.window = browser
  globalThis.location = browser.location
  globalThis.sessionStorage = storage
  globalThis.history = browser.history
  return { storage, browser }
}

test('accepts service callback tokens only after login was initiated', () => {
  const { storage } = fakeBrowser(
    '#access_token=access&refresh_token=refresh&token_type=Bearer&expires_in=900',
  )
  storage.setItem('ummu.js-auth.login-pending', '1')
  const client = new UMMUAuthClient({ authServiceUrl: 'https://auth.example.test' })

  const session = client.handleCallback()

  assert.equal(session.accessToken, 'access')
  assert.equal(session.refreshToken, 'refresh')
  assert.equal(client.getSession()?.tokenType, 'Bearer')
  assert.equal(storage.getItem('ummu.js-auth.login-pending'), null)
})

test('clears callback fragment and rejects unsolicited callbacks', () => {
  const { browser } = fakeBrowser(
    '#access_token=unexpected&token_type=Bearer&expires_in=900',
  )
  const client = new UMMUAuthClient({ authServiceUrl: 'https://auth.example.test' })

  assert.throws(() => client.handleCallback(), /No UMMU login is pending/)
  assert.deepEqual(browser.history.calls[0], [null, '', '/oauth/callback'])
})

test('uses memory-only token storage by default', () => {
  const manager = new TokenManager()
  manager.setSession({
    accessToken: 'token',
    tokenType: 'Bearer',
    expiresAt: Date.now() + 60_000,
  })

  assert.equal(manager.getAccessToken(), 'token')
  assert.equal(manager.getSession()?.accessToken, 'token')
})

test('retains a persisted refresh token after the access token expires', () => {
  const { storage } = fakeBrowser()
  const manager = new TokenManager('session')
  manager.setSession({
    accessToken: 'expired-access',
    refreshToken: 'usable-refresh',
    tokenType: 'Bearer',
    expiresAt: Date.now() - 1,
  })

  const restored = new TokenManager('session')

  assert.equal(restored.getSession()?.refreshToken, 'usable-refresh')
  assert.equal(storage.getItem('ummu.js-auth.session') !== null, true)
})

test('clears local tokens on logout even when service logout fails', async () => {
  const { storage } = fakeBrowser(
    '#access_token=access&refresh_token=refresh&token_type=Bearer&expires_in=900',
  )
  storage.setItem('ummu.js-auth.login-pending', '1')
  const fetchImpl = async (input, init) => {
    assert.equal(input, 'https://auth.example.test/api/v1/auth/logout')
    assert.equal(init.headers.Authorization, 'Bearer access')
    return new Response(null, { status: 503 })
  }
  const client = new UMMUAuthClient({
    authServiceUrl: 'https://auth.example.test',
    fetch: fetchImpl,
  })
  client.handleCallback()

  await assert.rejects(client.logout(), /Logout failed \(HTTP 503\)/)
  assert.equal(client.getSession(), null)
})
