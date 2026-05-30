import { useEffect, useMemo, useState } from "react";
import "./App.css";

type DemoMode =
  | "email"
  | "webauthn"
  | "webauthn-allow-credentials"
  | "webauthn-wrong-challenge";

type ModeConfig = {
  id: DemoMode;
  label: string;
  webAuthn: boolean;
  allowCredentials: boolean;
  wrongChallenge: boolean;
};

const MODES: ModeConfig[] = [
  {
    id: "email",
    label: "Email",
    webAuthn: false,
    allowCredentials: false,
    wrongChallenge: false,
  },
  {
    id: "webauthn",
    label: "WebAuthn",
    webAuthn: true,
    allowCredentials: false,
    wrongChallenge: false,
  },
  {
    id: "webauthn-allow-credentials",
    label: "WebAuthn + allowCredentials",
    webAuthn: true,
    allowCredentials: true,
    wrongChallenge: false,
  },
  {
    id: "webauthn-wrong-challenge",
    label: "WebAuthn + allowCredentials + wrong challenge",
    webAuthn: true,
    allowCredentials: true,
    wrongChallenge: true,
  },
];

const DEMO_CREDENTIAL_ID = Uint8Array.from(
  atob("AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyAh"),
  (char) => char.charCodeAt(0),
);

function randomChallenge(): Uint8Array {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  return challenge;
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

  if (config.allowCredentials) {
    url.searchParams.set("allowCredentials", "true");
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

function App() {
  const mode = useMemo(() => parseDemoMode(window.location.search), []);
  const modeConfig = MODES.find((entry) => entry.id === mode) ?? MODES[0];
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("Checking conditional passkey support…");
  const [conditionalAvailable, setConditionalAvailable] = useState<
    boolean | null
  >(null);

  useEffect(() => {
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
        setStatus("Conditional passkey UI is not available in this browser.");
        return;
      }

      setStatus(
        "Conditional passkey UI is active — focus the email field to see suggestions.",
      );

      try {
        const publicKey: PublicKeyCredentialRequestOptions = {
          challenge: buildChallenge(modeConfig.wrongChallenge) as BufferSource,
          rpId: window.location.hostname,
          userVerification: "preferred",
        };

        if (modeConfig.allowCredentials) {
          publicKey.allowCredentials = [
            {
              type: "public-key",
              id: DEMO_CREDENTIAL_ID,
              transports: ["internal", "hybrid"],
            },
          ];
        }

        const credential = await navigator.credentials.get({
          mediation: "conditional",
          publicKey,
        });

        if (cancelled) return;

        if (credential) {
          setStatus(`Passkey selected (${credential.type}).`);
        }
      } catch (error) {
        if (cancelled) return;

        if (error instanceof DOMException && error.name === "AbortError") {
          setStatus(
            "Conditional passkey UI is active — focus the email field to see suggestions.",
          );
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
    };
  }, [modeConfig.allowCredentials, modeConfig.wrongChallenge]);

  const autoComplete = modeConfig.webAuthn ? "webauthn" : "email";

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
            {modeConfig.allowCredentials && (
              <>
                {" "}
                · <code>allowCredentials</code> with demo credential ID
              </>
            )}
            {modeConfig.wrongChallenge && (
              <>
                {" "}
                · challenge passed as base64 <code>string</code> (invalid)
              </>
            )}
          </p>

          <button type="submit" className="submit-button">
            Continue
          </button>
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
      </main>

      <footer className="app-footer">
        <p>
          Focus the email input to trigger browser passkey autofill when
          credentials exist for <code>{window.location.hostname}</code>.
        </p>
      </footer>
    </div>
  );
}

export default App;
