import React from 'react'
import { createRoot } from 'react-dom/client'
import { UMMUAuthClient } from '@ganz404/js-auth'

const auth = new UMMUAuthClient({
  authServiceUrl: import.meta.env.VITE_AUTH_SERVICE_URL,
  apiBaseUrl: import.meta.env.VITE_API_URL,
})

function App() {
  const [message, setMessage] = React.useState('Signed out')

  React.useEffect(() => {
    if (window.location.pathname === '/oauth/callback') {
      try {
        const session = auth.handleCallback()
        setMessage(`Signed in; access token expires at ${new Date(session.expiresAt).toLocaleTimeString()}`)
        const returnTo = auth.consumeReturnTo()
        if (returnTo) window.history.replaceState(null, '', returnTo)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Login failed')
      }
    } else if (auth.getSession()) {
      setMessage('Signed in')
    }

    return auth.sessions.subscribe((session) => {
      setMessage(session ? 'Signed in' : 'Signed out')
    })
  }, [])

  async function loadProfile() {
    const response = await auth.http.fetch('/api/v1/auth/me')
    setMessage(response.ok ? await response.text() : `Profile request failed (${response.status})`)
  }

  async function signOut() {
    try {
      await auth.logout()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Logout failed')
      return
    }
    setMessage('Signed out')
  }

  return (
    <main>
      <h1>UMMU Auth</h1>
      <p>{message}</p>
      <button onClick={() => auth.login({ returnTo: '/' })}>Sign in with Google</button>
      <button onClick={() => void loadProfile()}>Load profile</button>
      <button onClick={() => void signOut()}>Sign out</button>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
