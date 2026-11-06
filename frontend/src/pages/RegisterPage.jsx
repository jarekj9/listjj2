import { useState } from "react";
import { ArrowRight, KeyRound } from "lucide-react";
import { Link } from "react-router-dom";
import AuthFrame from "../components/AuthFrame.jsx";
import MessageBanner from "../components/MessageBanner.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Label } from "../components/ui/label.jsx";
import { api } from "../api.js";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [adminBootstrapToken, setAdminBootstrapToken] = useState("");
  const [error, setError] = useState("");
  const [doneMessage, setDoneMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (password !== confirm) return setError("Those passwords do not match yet.");
    setBusy(true);
    try {
      const result = await api.post("/auth/register", {
        email: email.trim(),
        password,
        adminBootstrapToken: adminBootstrapToken || undefined,
      });
      setDoneMessage(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  if (doneMessage) {
    const approvalRequired = /must approve/i.test(doneMessage);
    return (
      <AuthFrame
        eyebrow={approvalRequired ? "Approval pending" : "You are on the list"}
        title={approvalRequired ? "Please wait for approval." : "Your space is ready."}
        description={approvalRequired ? "Your account is created. An administrator must approve it before you can use your workspace." : "Your administrator account is ready. Sign in to open your workspace."}
      >
        <MessageBanner type="success" title="Account created">{doneMessage}</MessageBanner>
        <Button asChild className="mt-4 h-11 w-full justify-between rounded-xl bg-[#244b3d] px-4 text-white hover:bg-[#1c3c30]"><Link to="/login">Continue to sign in <ArrowRight size={15} /></Link></Button>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame eyebrow="Make it your own" title="A place to keep things." description="Create an account for notes, plans, and the ideas you want to find again.">
      <form onSubmit={submit} className="grid gap-4">
        {error && <MessageBanner className="my-0" title="Could not create account">{error}</MessageBanner>}
        <div className="grid gap-2"><Label htmlFor="register-email" className="text-[11px] font-semibold text-[#4e6254]">Email address</Label><Input id="register-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" className="h-11 rounded-xl border-[#dfe4da] bg-[#fffefa] px-4 text-sm shadow-none placeholder:text-[#68766c]" /></div>
        <div className="grid gap-2"><Label htmlFor="register-password" className="text-[11px] font-semibold text-[#4e6254]">Password <span className="font-normal text-[#58675d]">· 6 characters minimum</span></Label><Input id="register-password" type="password" autoComplete="new-password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required className="h-11 rounded-xl border-[#dfe4da] bg-[#fffefa] px-4 text-sm shadow-none" /></div>
        <div className="grid gap-2"><Label htmlFor="register-confirm" className="text-[11px] font-semibold text-[#4e6254]">Confirm password</Label><Input id="register-confirm" type="password" autoComplete="new-password" minLength={6} value={confirm} onChange={(event) => setConfirm(event.target.value)} required className="h-11 rounded-xl border-[#dfe4da] bg-[#fffefa] px-4 text-sm shadow-none" /></div>
        <div className="rounded-xl border border-[#e3e6dc] bg-[#f0f2eb] p-3.5">
          <Label htmlFor="admin-bootstrap" className="flex items-center gap-2 text-[10px] font-semibold text-[#4c6053]"><KeyRound size={13} aria-hidden="true" />Initial admin setup token <span className="font-normal text-[#58675d]">· optional</span></Label>
          <Input id="admin-bootstrap" type="password" autoComplete="off" value={adminBootstrapToken} onChange={(event) => setAdminBootstrapToken(event.target.value)} placeholder="For the configured admin email only" className="mt-2 h-10 rounded-lg border-[#dce2d8] bg-[#fffefa] text-xs shadow-none" />
          <p className="mb-0 mt-2 text-[10px] leading-4 text-[#526257]">Regular accounts wait for approval. The setup token activates only the configured first administrator.</p>
        </div>
        <Button type="submit" disabled={busy} className="mt-1 h-11 justify-between rounded-xl bg-[#244b3d] px-4 text-[12px] font-semibold text-white hover:bg-[#1c3c30]">{busy ? "Creating your account…" : "Create account"}<ArrowRight size={15} /></Button>
      </form>
      <p className="mb-0 mt-7 border-t border-[#e3e6df] pt-5 text-center text-xs text-[#58675d]">Already have an account? <Link to="/login" className="font-semibold text-[#244b3d] underline decoration-[#303030] underline-offset-4">Sign in</Link></p>
    </AuthFrame>
  );
}
