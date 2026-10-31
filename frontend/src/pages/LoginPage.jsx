import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { PublicClientApplication } from "@azure/msal-browser";
import { useAuth } from "../auth.jsx";
import { config } from "../config.js";

let msalInstance = null;
async function getMsal() {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication({
      auth: {
        clientId: config.microsoftClientId,
        authority: `https://login.microsoftonline.com/${config.microsoftTenantId}`,
        redirectUri: `${window.location.origin}/login`,
      },
      cache: { cacheLocation: "sessionStorage" },
    });
    await msalInstance.initialize();
  }
  return msalInstance;
}

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function LoginPage() {
  const { loginWith } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const googleRef = useRef(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSuccess = () => navigate(location.state?.from || "/items", { replace: true });

  const submit = async (credentials) => {
    setBusy(true);
    setError("");
    try {
      await loginWith(credentials);
      onSuccess();
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!config.googleClientId) return;
    loadGoogleScript()
      .then(() => {
        window.google.accounts.id.initialize({
          client_id: config.googleClientId,
          callback: (response) => submit({ googleJwt: response.credential }),
        });
        if (googleRef.current) {
          window.google.accounts.id.renderButton(googleRef.current, { theme: "outline", size: "large", text: "signin_with" });
        }
      })
      .catch(() => setError("Could not load Google sign-in."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const microsoftLogin = async () => {
    try {
      const msal = await getMsal();
      const result = await msal.loginPopup({ scopes: ["openid", "profile", "email"] });
      await submit({ microsoftJwt: result.idToken });
    } catch (err) {
      setError(err.message || "Microsoft sign-in failed.");
    }
  };

  return (
    <div className="page narrow">
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          submit({ email, password });
        }}
      >
        <h2>Listjj</h2>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="submit" disabled={busy}>
            Log in
          </button>
          <Link to="/register" className="button ghost">
            Register
          </Link>
        </div>

        {(config.googleClientId || config.microsoftClientId) && <hr />}
        {config.googleClientId && <div ref={googleRef} className="center" />}
        {config.microsoftClientId && (
          <button type="button" className="ghost wide" onClick={microsoftLogin} disabled={busy}>
            Sign in with Microsoft
          </button>
        )}
      </form>
    </div>
  );
}
