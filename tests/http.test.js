import assert from 'node:assert/strict'
import test from 'node:test'
import { AuthenticatedHttpClient } from '../dist/http/client.js'
import { TokenManager } from '../dist/token/manager.js'

test('adds bearer token to protected API requests', async () => {
  const tokens = new TokenManager()
  tokens.setSession({
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    tokenType: 'Bearer',
    expiresAt: Date.now() + 60_000,
  })
  const fetchImpl = async (request) => {
    assert.equal(request.url, 'https://api.example.test/private')
    assert.equal(request.headers.get('Authorization'), 'Bearer access-token')
    return new Response(null, { status: 200 })
  }
  const client = new AuthenticatedHttpClient(
    'https://api.example.test',
    'https://auth.example.test',
    tokens,
    fetchImpl,
  )

  const response = await client.fetch('/private')

  assert.equal(response.status, 200)
})

test('refreshes after 401 and retries once using the rotated access token', async () => {
  const tokens = new TokenManager()
  tokens.setSession({
    accessToken: 'expired-access',
    refreshToken: 'current-refresh',
    tokenType: 'Bearer',
    expiresAt: Date.now() - 1,
  })
  const requests = []
  const fetchImpl = async (input, init) => {
    requests.push({ input, init })
    if (requests.length === 1) return new Response(null, { status: 401 })
    if (requests.length === 2) {
      assert.equal(input, 'https://auth.example.test/api/v1/auth/refresh')
      assert.deepEqual(JSON.parse(init.body), { refresh_token: 'current-refresh' })
      return Response.json({
        success: true,
        data: {
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          token_type: 'Bearer',
          expires_in: 900,
        },
      })
    }

    assert.equal(input.headers.get('Authorization'), 'Bearer new-access')
    return new Response(null, { status: 200 })
  }
  const client = new AuthenticatedHttpClient(
    'https://api.example.test',
    'https://auth.example.test',
    tokens,
    fetchImpl,
  )

  const response = await client.fetch('/private')

  assert.equal(response.status, 200)
  assert.equal(tokens.getSession()?.refreshToken, 'new-refresh')
  assert.equal(requests.length, 3)
})
