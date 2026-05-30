import { useEffect, useState } from 'react'
import './App.css'

function randomChallenge(): Uint8Array {
  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)
  return challenge
}

function useWebAuthnParam(): boolean {
  return new URLSearchParams(window.location.search).get('webAuthn') === 'true'
}

function App() {
  const webAuthnMode = useWebAuthnParam()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('Checking conditional passkey support…')
  const [conditionalAvailable, setConditionalAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false

    async function startConditionalPasskey() {
      if (!window.PublicKeyCredential) {
        setConditionalAvailable(false)
        setStatus('WebAuthn is not supported in this browser.')
        return
      }

      const available =
        typeof PublicKeyCredential.isConditionalMediationAvailable === 'function'
          ? await PublicKeyCredential.isConditionalMediationAvailable()
          : false

      if (cancelled) return

      setConditionalAvailable(available)

      if (!available) {
        setStatus('Conditional passkey UI is not available in this browser.')
        return
      }

      setStatus('Conditional passkey UI is active — focus the email field to see suggestions.')

      try {
        const credential = await navigator.credentials.get({
          mediation: 'conditional',
          publicKey: {
            challenge: randomChallenge(),
            rpId: window.location.hostname,
            userVerification: 'preferred',
          },
        })

        if (cancelled) return

        if (credential) {
          setStatus(`Passkey selected (${credential.type}).`)
        }
      } catch (error) {
        if (cancelled) return

        if (error instanceof DOMException && error.name === 'AbortError') {
          setStatus('Conditional passkey UI is active — focus the email field to see suggestions.')
          return
        }

        setStatus(
          error instanceof Error ? error.message : 'Conditional passkey request failed.',
        )
      }
    }

    void startConditionalPasskey()

    return () => {
      cancelled = true
    }
  }, [])

  const autoComplete = webAuthnMode ? 'webauthn' : 'email'

  return (
    <div className="app">
      <header className="app-header">
        <h1>Passkey Demo</h1>
        <p className="tagline">
          Conditional WebAuthn UI with an email field
        </p>
      </header>

      <main className="card">
        <form className="login-form" onSubmit={(event) => event.preventDefault()}>
          <label className="field-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete={autoComplete}
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <p className="hint">
            <code>autoComplete=&quot;{autoComplete}&quot;</code>
            {webAuthnMode ? (
              <> — enabled via <code>?webAuthn=true</code></>
            ) : (
              <> — add <code>?webAuthn=true</code> for passkey autocomplete</>
            )}
          </p>

          <button type="submit" className="submit-button">
            Continue
          </button>
        </form>

        <output className="status" aria-live="polite">
          {conditionalAvailable === true && (
            <span className="status-badge status-badge--ok">Conditional UI</span>
          )}
          {conditionalAvailable === false && (
            <span className="status-badge status-badge--warn">Unavailable</span>
          )}
          {status}
        </output>
      </main>

      <footer className="app-footer">
        <p>
          Focus the email input to trigger browser passkey autofill when credentials exist for{' '}
          <code>{window.location.hostname}</code>.
        </p>
      </footer>
    </div>
  )
}

export default App
