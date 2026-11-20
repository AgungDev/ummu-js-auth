# @ganz404/js-auth

Browser SDK for the existing UMMU Auth Service. Current version: **0.1.1**.

See [`docs/v0.1.1.md`](./docs/v0.1.1.md) for the release notes and the
Auth Service compatibility audit.

## Important protocol limitation

The inspected Auth Service currently implements Google login at
`GET /auth/google?response=frontend`, token refresh at
`POST /api/v1/auth/refresh`, and logout at `POST /api/v1/auth/logout`. It does
**not** currently expose an OAuth authorization endpoint, a public-client
authorization-code token exchange, or PKCE support. This SDK therefore
delegates Google authorization, OAuth state and OIDC nonce validation, code
exchange, and Google ID-token verification to the service; it does not claim
client-side Authorization Code + PKCE support. The service validates Google
OIDC using `go-oidc`. Do not add a client secret to browser configuration.

For Authorization Code + PKCE, Auth Service must first implement a compatible
public-client OAuth contract. This package deliberately does not invent one.

## Install

```sh
npm install @ganz404/js-auth
```

## Configure Auth Service

Enable Google OIDC on the service and set `GOOGLE_FRONTEND_CALLBACK_URL` to the
frontend callback, for example `http://localhost:5173/oauth/callback`. The
service's Google callback validates its HttpOnly state cookie and nonce, then
redirects to the configured frontend URL with access and refresh tokens in the
URL fragment. The SDK immediately removes the fragment and requires a
same-tab login marker before accepting a callback.

## Quick start

```ts
import { UMMUAuthClient } from '@ganz404/js-auth'

export const auth = new UMMUAuthClient({
  authServiceUrl: 'https://auth.example.ummu.ac.id',
  apiBaseUrl: 'https://api.example.ummu.ac.id',
  // tokenStorage: 'session', // optional; memory is the default
})

// Start the service-managed Google login in response to a user action.
auth.login({ returnTo: '/' })
```

At the configured callback route:

```ts
const session = auth.handleCallback()
console.log(session.expiresAt)
const returnTo = auth.consumeReturnTo()
if (returnTo) window.history.replaceState(null, '', returnTo)
```

`handleCallback()` clears the URL fragment with `history.replaceState`, checks
that a login was initiated in this tab, and stores the access/refresh tokens.
OAuth state and OIDC nonce are generated and validated by Auth Service, not by
this SDK.

## Protected HTTP requests and session

```ts
const response = await auth.http.fetch('/api/v1/auth/me')
const session = auth.sessions.get()
const unsubscribe = auth.sessions.subscribe((nextSession) => {
  console.log(nextSession ? 'signed in' : 'signed out')
})

await auth.logout()
unsubscribe()
```

The HTTP client attaches `Authorization: Bearer <access_token>`. On HTTP 401,
it exchanges the stored refresh token at the service's `/api/v1/auth/refresh`
endpoint, stores the rotated token pair, and retries the request once. Logout
clears local tokens and calls the protected service logout endpoint; a network
or server failure is reported to the caller.

Automatic bearer-token attachment and refresh are restricted to the configured
`apiBaseUrl` origin. Requests to other origins are sent without the SDK's
tokens and are not automatically retried after HTTP 401.

Tokens are kept in memory by default. `tokenStorage: 'session'` opts into
`sessionStorage`; browser storage is accessible to same-origin JavaScript and
therefore increases exposure to XSS. No client secret is supported or needed.

## React + Vite example

See [`examples/react-vite`](./examples/react-vite). Set the service callback
URL to `http://localhost:5173/oauth/callback`, copy its `.env.example` to `.env`,
build the SDK package, then install and run the example.

## Build, tests, and publishing

```sh
npm install
npm test
npm run build
npm publish --access public
```

The package is configured as `@ganz404/js-auth@0.1.0` with public npm access.
