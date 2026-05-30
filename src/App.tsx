import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import "./App.css";

type DemoMode =
  | "email"
  | "webauthn"
  | "webauthn-allow-credentials"
  | "webauthn-empty-allow-credentials"
  | "webauthn-wrong-challenge";

type AllowCredentialsMode = "omit" | "populated" | "empty";

type ModeConfig = {
  id: DemoMode;
  label: string;
  webAuthn: boolean;
  allowCredentials: AllowCredentialsMode;
  wrongChallenge: boolean;
};

const MODES: ModeConfig[] = [
  {
    id: "email",
    label: "Email",
    webAuthn: false,
    allowCredentials: "omit",
    wrongChallenge: false,
  },
  {
    id: "webauthn",
    label: "WebAuthn",
    webAuthn: true,
    allowCredentials: "omit",
    wrongChallenge: false,
  },
  {
    id: "webauthn-allow-credentials",
    label: "WebAuthn + allowCredentials",
    webAuthn: true,
    allowCredentials: "populated",
    wrongChallenge: false,
  },
  {
    id: "webauthn-empty-allow-credentials",
    label: "WebAuthn + allowCredentials: []",
    webAuthn: true,
    allowCredentials: "empty",
    wrongChallenge: false,
  },
  {
    id: "webauthn-wrong-challenge",
    label: "WebAuthn + allowCredentials + wrong challenge",
    webAuthn: true,
    allowCredentials: "populated",
    wrongChallenge: true,
  },
];

const REGISTERED_CREDENTIAL_KEY = "passkey-demo-credential-id";

const DEMO_CREDENTIAL_ID = Uint8Array.from(
  atob("AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyAh"),
  (char) => char.charCodeAt(0),
);

function randomChallenge(): Uint8Array {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  return challenge;
}

function randomUserId(): Uint8Array {
  const userId = new Uint8Array(16);
  crypto.getRandomValues(userId);
  return userId;
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlToBuffer(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function getStoredCredentialId(): Uint8Array | null {
  const stored = localStorage.getItem(REGISTERED_CREDENTIAL_KEY);
  if (!stored) return null;
  try {
    return base64UrlToBuffer(stored);
  } catch {
    return null;
  }
}

function parseDemoMode(search: string): DemoMode {
  const params = new URLSearchParams(search);

  if (params.get("webAuthn") !== "true") {
    return "email";
  }

  if (
    params.get("allowCredentials") === "true" &&
    params.get("wrongChallenge") === "true"
  ) {
    return "webauthn-wrong-challenge";
  }

  if (params.get("allowCredentials") === "empty") {
    return "webauthn-empty-allow-credentials";
  }

  if (params.get("allowCredentials") === "true") {
    return "webauthn-allow-credentials";
  }

  return "webauthn";
}

function getModeUrl(mode: DemoMode): string {
  const config = MODES.find((entry) => entry.id === mode) ?? MODES[0];
  const url = new URL(window.location.href);

  url.searchParams.delete("webAuthn");
  url.searchParams.delete("allowCredentials");
  url.searchParams.delete("wrongChallenge");

  if (config.webAuthn) {
    url.searchParams.set("webAuthn", "true");
  }

  if (config.allowCredentials === "populated") {
    url.searchParams.set("allowCredentials", "true");
  } else if (config.allowCredentials === "empty") {
    url.searchParams.set("allowCredentials", "empty");
  }

  if (config.wrongChallenge) {
    url.searchParams.set("wrongChallenge", "true");
  }

  return `${url.pathname}${url.search}`;
}

function buildChallenge(wrongChallenge: boolean): BufferSource | string {
  const challenge = randomChallenge();

  if (wrongChallenge) {
    return btoa(String.fromCharCode(...challenge));
  }

  return challenge;
}

async function abortPendingConditionalGet(
  abortRef: RefObject<AbortController | null>,
): Promise<void> {
  abortRef.current?.abort();
  // Android Chrome keeps the WebAuthn slot busy briefly after abort.
  await new Promise((resolve) => setTimeout(resolve, 150));
}

function App() {
  const mode = useMemo(() => parseDemoMode(window.location.search), []);
  const modeConfig = MODES.find((entry) => entry.id === mode) ?? MODES[0];
  const abortRef = useRef<AbortController | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("Checking conditional passkey support…");
  const [conditionalAvailable, setConditionalAvailable] = useState<
    boolean | null
  >(null);
  const [conditionalPaused, setConditionalPaused] = useState(false);
  const [registeredCredentialId, setRegisteredCredentialId] = useState<
    string | null
  >(() => localStorage.getItem(REGISTERED_CREDENTIAL_KEY));
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (!modeConfig.webAuthn || conditionalPaused) {
      return;
    }

    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;
    let cancelled = false;

    async function startConditionalPasskey() {
      if (!window.PublicKeyCredential) {
        setConditionalAvailable(false);
        setStatus("WebAuthn is not supported in this browser.");
        return;
      }

      const available =
        typeof PublicKeyCredential.isConditionalMediationAvailable ===
        "function"
          ? await PublicKeyCredential.isConditionalMediationAvailable()
          : false;

      if (cancelled) return;

      setConditionalAvailable(available);

      if (!available) {
        setStatus(
          "Conditional passkey UI is not available. Try Chrome/Edge 108+ or Safari 17+.",
        );
        return;
      }

      if (modeConfig.wrongChallenge) {
        setStatus(
          "Wrong challenge mode — request should fail. Autofill popup will not appear.",
        );
      } else if (modeConfig.allowCredentials === "empty") {
        setStatus(
          "Empty allowCredentials: [] — conditional request started. This may hang on Android.",
        );
      } else if (
        modeConfig.allowCredentials === "populated" &&
        !getStoredCredentialId()
      ) {
        setStatus(
          "allowCredentials mode uses a demo credential ID. Register a passkey first, or switch to WebAuthn mode.",
        );
      } else if (!registeredCredentialId) {
        setStatus(
          "No passkey registered for this site yet. Register one below, then focus the email field.",
        );
        return;
      } else {
        setStatus(
          "Conditional UI is active — click the email field to see passkey suggestions.",
        );
      }

      try {
        const publicKey: PublicKeyCredentialRequestOptions = {
          challenge: buildChallenge(modeConfig.wrongChallenge) as BufferSource,
          rpId: window.location.hostname,
          userVerification: "preferred",
        };

        if (modeConfig.allowCredentials === "populated") {
          const credentialId = getStoredCredentialId() ?? DEMO_CREDENTIAL_ID;
          publicKey.allowCredentials = [
            {
              type: "public-key",
              id: credentialId,
              transports: ["internal", "hybrid"],
            },
          ];
        } else if (modeConfig.allowCredentials === "empty") {
          publicKey.allowCredentials = [];
        }

        const credential = await navigator.credentials.get({
          mediation: "conditional",
          signal: abortController.signal,
          publicKey,
        });

        if (cancelled) return;

        if (credential) {
          setStatus(`Passkey selected (${credential.type}).`);
        }
      } catch (error) {
        if (cancelled || abortController.signal.aborted) return;

        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setStatus(
          error instanceof Error
            ? error.message
            : "Conditional passkey request failed.",
        );
      }
    }

    void startConditionalPasskey();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [
    modeConfig.webAuthn,
    modeConfig.allowCredentials,
    modeConfig.wrongChallenge,
    registeredCredentialId,
    conditionalPaused,
  ]);

  useEffect(() => {
    if (!modeConfig.webAuthn) {
      setConditionalAvailable(null);
      setStatus("Email mode — no conditional passkey request.");
    }
  }, [modeConfig.webAuthn]);

  async function registerPasskey() {
    if (!window.PublicKeyCredential) {
      setStatus("WebAuthn is not supported in this browser.");
      return;
    }

    setRegistering(true);
    setConditionalPaused(true);

    try {
      await abortPendingConditionalGet(abortRef);

      const username = email.trim() || "demo@example.com";
      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge: randomChallenge(),
          rp: {
            name: "Passkey Demo",
            id: window.location.hostname,
          },
          user: {
            id: randomUserId(),
            name: username,
            displayName: username,
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          authenticatorSelection: {
            residentKey: "required",
            userVerification: "preferred",
          },
        },
      })) as PublicKeyCredential | null;

      if (!credential) {
        setStatus("Passkey registration was cancelled.");
        return;
      }

      const credentialId = bufferToBase64Url(credential.rawId);
      localStorage.setItem(REGISTERED_CREDENTIAL_KEY, credentialId);
      setRegisteredCredentialId(credentialId);
      setStatus(
        "Passkey registered. Focus the email field to see suggestions.",
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? `Registration failed: ${error.message}`
          : "Passkey registration failed.",
      );
    } finally {
      setRegistering(false);
      setConditionalPaused(false);
    }
  }

  function clearRegisteredPasskey() {
    localStorage.removeItem(REGISTERED_CREDENTIAL_KEY);
    setRegisteredCredentialId(null);
    setStatus("Stored passkey cleared for this demo.");
  }

  const autoComplete = modeConfig.webAuthn ? "username webauthn" : "email";

  return (
    <div className="app">
      <header className="app-header">
        <h1>Passkey Demo</h1>
        <p className="tagline">Conditional WebAuthn UI with an email field</p>
        <nav className="mode-nav" aria-label="Autocomplete mode">
          {MODES.map((entry) => (
            <a
              key={entry.id}
              href={getModeUrl(entry.id)}
              className={
                mode === entry.id ? "mode-nav-link is-active" : "mode-nav-link"
              }
              aria-current={mode === entry.id ? "page" : undefined}
            >
              {entry.label}
            </a>
          ))}
        </nav>
      </header>

      <main className="card">
        <form
          className="login-form"
          onSubmit={(event) => event.preventDefault()}
        >
          <label className="field-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="username"
            type="email"
            autoComplete={autoComplete}
            inputMode="email"
            autoFocus={modeConfig.webAuthn}
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <p className="hint">
            <code>autoComplete=&quot;{autoComplete}&quot;</code>
            {modeConfig.allowCredentials === "populated" && (
              <>
                {" "}
                · <code>allowCredentials</code>
                {registeredCredentialId
                  ? " with your registered credential"
                  : " with demo credential ID (won't match)"}
              </>
            )}
            {modeConfig.allowCredentials === "empty" && (
              <>
                {" "}
                · <code>allowCredentials: []</code> (empty array)
              </>
            )}
            {modeConfig.wrongChallenge && (
              <>
                {" "}
                · challenge passed as base64 <code>string</code> (invalid)
              </>
            )}
          </p>

          <div className="button-row">
            <button type="submit" className="submit-button">
              Continue
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void registerPasskey()}
              disabled={registering}
            >
              {registering ? "Registering…" : "Register passkey"}
            </button>
          </div>
        </form>

        <output className="status" aria-live="polite">
          {conditionalAvailable === true && (
            <span className="status-badge status-badge--ok">
              Conditional UI
            </span>
          )}
          {conditionalAvailable === false && (
            <span className="status-badge status-badge--warn">Unavailable</span>
          )}
          {status}
        </output>

        <section className="diagnostics">
          <h2>Why no passkey popup?</h2>
          <ul>
            <li>
              <strong>No passkey on this origin:</strong> conditional UI only
              shows passkeys already saved for{" "}
              <code>{window.location.hostname}</code>. Use{" "}
              <strong>Register passkey</strong> first.
            </li>
            <li>
              <strong>Focus the input:</strong> the suggestion appears in the
              browser autofill dropdown when you click/focus the email field,
              not automatically on page load.
            </li>
            <li>
              <strong>Registration on Android:</strong> cancel any pending
              conditional request before creating a passkey. This demo aborts
              conditional UI automatically when you tap Register passkey.
            </li>
            <li>
              <strong>Discoverable passkey required:</strong> only resident keys
              appear in conditional UI. Registration here creates one.
            </li>
            <li>
              <strong>Empty allowCredentials:</strong>{" "}
              <code>allowCredentials: []</code> with conditional mediation can
              hang on Android and block later WebAuthn calls.
            </li>
            <li>
              <strong>allowCredentials mode:</strong> filters to specific
              credential IDs. Without a matching registered passkey, nothing
              shows.
            </li>
            <li>
              <strong>Wrong challenge mode:</strong> intentionally invalid — the
              request fails and autofill will not work.
            </li>
            <li>
              <strong>Same rpId:</strong> passkeys are bound to{" "}
              <code>{window.location.hostname}</code>. Registering on{" "}
              <code>localhost</code> won't appear on GitHub Pages, and vice
              versa.
            </li>
          </ul>

          <p className="diagnostics-meta">
            Registered passkey:{" "}
            {registeredCredentialId ? (
              <>
                <code>{registeredCredentialId.slice(0, 16)}…</code>{" "}
                <button
                  type="button"
                  className="link-button"
                  onClick={clearRegisteredPasskey}
                >
                  Clear
                </button>
              </>
            ) : (
              <span className="diagnostics-none">none</span>
            )}
          </p>
        </section>
      </main>

      <footer className="app-footer">
        <p>
          Use Chrome/Edge 108+ or Safari 17+. Open via{" "}
          <code>{window.location.origin}</code> (HTTPS or localhost).
        </p>
      </footer>
    </div>
  );
}

export default App;
