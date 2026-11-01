import { useEffect, useRef, useState } from "react";
import { ArrowRight, Eye, EyeOff, KeyRound } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { PublicClientApplication } from "@azure/msal-browser";
import AuthFrame from "../components/AuthFrame.jsx";
import MessageBanner from "../components/MessageBanner.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Label } from "../components/ui/label.jsx";
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
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSuccess = () => navigate(location.state?.from || "/items", { replace: true });

  const submit = async (credentials) => {
    setBusy(true);
    setError("");
    try {
      await loginWith(credentials);
      onSuccess();
    } catch (requestError) {
      setError(requestError.message || "Sign in failed. Check your details and try again.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!config.googleClientId) return undefined;
    let mounted = true;
    loadGoogleScript()
      .then(() => {
        if (!mounted || !googleRef.current) return;
        window.google.accounts.id.initialize({
          client_id: config.googleClientId,
          callback: (response) => submit({ googleJwt: response.credential }),
        });
        window.google.accounts.id.renderButton(googleRef.current, { theme: "outline", size: "large", text: "signin_with", shape: "rectangular", width: Math.min(360, googleRef.current.clientWidth || 320) });
      })
      .catch(() => setError("Google sign-in could not be loaded."));
    return () => { mounted = false; };
    // Google identity initializes once when the provider is configured.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const microsoftLogin = async () => {
    setError("");
    setBusy(true);
    try {
      const msal = await getMsal();
      const result = await msal.loginPopup({ scopes: ["openid", "profile", "email"] });
      await submit({ microsoftJwt: result.idToken });
    } catch (requestError) {
      setError(requestError.message || "Microsoft sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame eyebrow="Welcome back" title="Return to your thoughts." description="A quieter place to pick up where you left off.">
      <form onSubmit={(event) => { event.preventDefault(); submit({ email, password }); }} className="grid gap-5">
        {error && <MessageBanner className="my-0" title="Could not sign in">{error}</MessageBanner>}
        <div className="grid gap-2">
          <Label htmlFor="login-email" className="text-[11px] font-semibold text-[#4e6254]">Email address</Label>
          <Input id="login-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required className="h-12 rounded-xl border-[#dfe4da] bg-[#fffefa] px-4 text-sm shadow-none placeholder:text-[#68766c]" />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2"><Label htmlFor="login-password" className="text-[11px] font-semibold text-[#4e6254]">Password</Label><span className="font-mono text-[9px] uppercase tracking-[.12em] text-[#58675d]">Private by design</span></div>
          <div className="relative">
            <KeyRound size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64736a]" aria-hidden="true" />
            <Input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required className="h-12 rounded-xl border-[#dfe4da] bg-[#fffefa] pl-11 pr-12 text-sm shadow-none" />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-[#58675d] hover:bg-[#edf0e8]">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <Button type="submit" disabled={busy} className="mt-1 h-12 justify-between rounded-xl bg-[#244b3d] px-4 text-[12px] font-semibold text-white hover:bg-[#1c3c30]">
          <span>{busy ? "Opening your notebook…" : "Sign in"}</span><ArrowRight size={16} />
        </Button>
      </form>

        {(config.googleClientId || config.microsoftClientId) && <div className="my-7 flex items-center gap-3 text-[9px] font-mono uppercase tracking-[.16em] text-[#58675d]"><span className="h-px flex-1 bg-[#e3e6df]" />Or use a connected account<span className="h-px flex-1 bg-[#e3e6df]" /></div>}
      <div className="grid gap-3">
        {config.googleClientId && <div ref={googleRef} className="flex min-h-11 justify-center [&_div]:max-w-full" />}
        {config.microsoftClientId && <Button type="button" disabled={busy} variant="outline" onClick={microsoftLogin} className="h-11 rounded-xl border-[#dfe4da] bg-[#fffefa] text-xs text-[#43584a] shadow-none hover:bg-[#f0f3ec]">Continue with Microsoft</Button>}
      </div>

      <div className="mt-8 border-t border-[#e3e6df] pt-5 text-center text-xs text-[#58675d]">
        New to Listjj? <Link to="/register" className="font-semibold text-[#315843] underline decoration-[#b7c99b] underline-offset-4 hover:text-[#1e3c2e]">Create an account</Link>
      </div>
    </AuthFrame>
  );
}
