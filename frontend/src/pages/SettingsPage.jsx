import { useCallback, useEffect, useState } from "react";
import { Check, Clipboard, ExternalLink, KeyRound, RefreshCw, Server, Terminal } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import MessageBanner from "../components/MessageBanner.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent, CardHeader } from "../components/ui/card.jsx";
import { Input } from "../components/ui/input.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";

export default function SettingsPage() {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState(null);
  const [custom, setCustom] = useState("");
  const [serverInfo, setServerInfo] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [keyLoadError, setKeyLoadError] = useState("");
  const [serverLoading, setServerLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotateBusy, setRotateBusy] = useState(false);
  const [rotateError, setRotateError] = useState("");

  const origin = window.location.origin;

  const loadApiKey = useCallback(async () => {
    setLoading(true);
    setKeyLoadError("");
    setApiKey(null);
    try {
      const response = await api.get("/settings/api-key");
      setApiKey(response.apiKey ?? null);
    } catch (requestError) {
      setKeyLoadError(requestError.message || "The API key could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadServerInfo = useCallback(async () => {
    setServerLoading(true);
    setServerError("");
    setServerInfo(null);
    try {
      setServerInfo(await api.get("/settings"));
    } catch (requestError) {
      setServerError(requestError.message || "Server information is unavailable.");
    } finally {
      setServerLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApiKey();
    if (user?.role === "Admin") loadServerInfo();
  }, [user, loadApiKey, loadServerInfo]);

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      setApiKey((await action()).apiKey);
      setCustom("");
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const rotateKey = async () => {
    setRotateBusy(true);
    setRotateError("");
    try {
      const response = await api.post("/settings/api-key/generate");
      setApiKey(response.apiKey);
      setCustom("");
      setRotateOpen(false);
    } catch (requestError) {
      setRotateError(requestError.message || "The API key could not be rotated.");
    } finally {
      setRotateBusy(false);
    }
  };

  const copyText = async (text, label) => {
    try {
      if (window.isSecureContext && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const input = document.createElement("textarea");
        input.value = text;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        let succeeded = false;
        try {
          input.select();
          succeeded = document.execCommand("copy");
        } finally {
          input.remove();
        }
        if (!succeeded) throw new Error("Clipboard unavailable");
      }
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setError("Could not copy that value. Select it and copy manually.");
    }
  };

  const copyButton = (value, label, onDark = false) => {
    const itemName = { api: "API key", mcp: "MCP endpoint", curl: "curl example" }[label] || "value";
    return (
      <>
        <Button type="button" variant="ghost" size="sm" aria-label={`${copied === label ? "Copied" : "Copy"} ${itemName}`} onClick={() => copyText(value, label)} className={`h-8 gap-1.5 rounded-lg px-2 text-[10px] ${onDark ? "text-[#dce8d8] hover:bg-white/10 hover:text-white" : "text-[#57705e] hover:bg-[#eaf0e3]"}`}>
          {copied === label ? <Check size={13} aria-hidden="true" /> : <Clipboard size={13} aria-hidden="true" />}
          {copied === label ? "Copied" : "Copy"}
        </Button>
        <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{copied === label ? `${itemName} copied.` : ""}</span>
      </>
    );
  };

  return (
    <section aria-labelledby="settings-title">
      <PageHeader id="settings-title" number="05" eyebrow="Your integrations" title="Connections." description="Bring your notebook to scripts and assistants, while keeping the keys in your hands." />
      {error && <MessageBanner className="mb-5 mt-0" title="Something needs attention">{error}</MessageBanner>}
      {keyLoadError && <MessageBanner className="mb-5 mt-0" title="API key unavailable">{keyLoadError}<Button type="button" variant="outline" size="sm" onClick={loadApiKey} className="ml-2 h-7 rounded-lg">Retry</Button></MessageBanner>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,.88fr)]">
        <Card className="overflow-hidden rounded-[1.5rem] border-[#dce3d8] bg-[#fffefa] py-0 shadow-none">
          <div className="key-panel bg-[#19382e] px-5 py-5 text-white sm:px-7 sm:py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.19em] text-[#bdcfac]"><KeyRound size={12} /> Private access key</p>
                <h2 className="font-display m-0 text-[1.65rem] font-medium tracking-tight">One key. Your tools.</h2>
                <p className="mb-0 mt-1.5 text-xs leading-5 text-[#bdcbbf]">Use this key to connect MCP clients, devices and scripts.</p>
              </div>
              <span className="hidden size-11 place-items-center rounded-2xl border border-white/15 bg-white/[.06] text-[#d9ed9c] sm:grid"><KeyRound size={19} /></span>
            </div>
            <div className="mt-6 rounded-xl border border-white/15 bg-black/10 p-3.5 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[9px] uppercase tracking-[.16em] text-[#a5b7a9]">Your API key</span>
                {apiKey && copyButton(String(apiKey), "api", true)}
              </div>
              <code className="mt-2 block break-all font-mono text-[12px] leading-6 text-[#f0f2ea] sm:text-[13px]">{loading ? "Loading key…" : keyLoadError ? "Key status unavailable" : apiKey || "No key yet — generate one below."}</code>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button type="button" disabled={busy || loading || Boolean(keyLoadError)} onClick={() => { if (apiKey) { setRotateError(""); setRotateOpen(true); } else run(() => api.post("/settings/api-key/generate")); }} className="h-10 gap-2 rounded-xl bg-[#d9ed9c] px-4 text-[11px] font-semibold text-[#203c2e] hover:bg-[#cbe580]">
                <RefreshCw size={14} className={busy ? "animate-spin" : ""} />{apiKey ? "Rotate key" : "Generate key"}
              </Button>
              <div className="flex min-w-0 flex-1 gap-2">
                <Input aria-label="Custom API key GUID" placeholder="Or set a custom GUID" value={custom} disabled={loading || Boolean(keyLoadError)} onChange={(event) => setCustom(event.target.value)} className="h-10 min-w-0 rounded-xl border-white/15 bg-white/[.08] text-xs text-white shadow-none placeholder:text-[#acb9ae] focus-visible:ring-[#d9ed9c]/40" />
                <Button type="button" variant="ghost" disabled={!custom.trim() || busy || loading || Boolean(keyLoadError)} onClick={() => run(() => api.put("/settings/api-key", { apiKey: custom.trim() }))} className="h-10 rounded-xl border border-white/30 bg-transparent px-3 text-[10px] text-white hover:bg-white/10 hover:text-white">Set</Button>
              </div>
            </div>
          </div>
          <CardContent className="grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
            <div>
              <p className="mb-2 font-mono text-[9px] uppercase tracking-[.16em] text-[#58675d]">MCP endpoint</p>
              <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-[#e4e8df] bg-[#f7f8f3] px-3 py-2">
                <code className="min-w-0 truncate font-mono text-[11px] text-[#3b5947]">{origin}/mcp</code>{copyButton(`${origin}/mcp`, "mcp")}
              </div>
              <p className="mb-0 mt-2 text-[10px] leading-5 text-[#526257]">Transport: streamable HTTP. Authenticate with your API key as a Bearer token.</p>
            </div>
            <div>
              <p className="mb-2 font-mono text-[9px] uppercase tracking-[.16em] text-[#58675d]">API reference</p>
              <a href={`${origin}/api/docs`} target="_blank" rel="noreferrer" className="flex min-h-10 items-center justify-between rounded-xl border border-[#e4e8df] bg-[#f7f8f3] px-3 text-[11px] text-[#3b5947] transition-colors hover:bg-[#eef2e9]">
                Open interactive API docs <ExternalLink size={14} aria-hidden="true" />
              </a>
              <p className="mb-0 mt-2 text-[10px] leading-5 text-[#526257]">Use the external endpoints for watches, shortcuts and small integrations.</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid content-start gap-5">
          <Card className="rounded-[1.5rem] border-[#e1e5dc] bg-[#fffefa] py-0 shadow-none">
            <CardHeader className="px-5 pb-0 pt-5 sm:px-6 sm:pt-6">
              <p className="m-0 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.16em] text-[#58675d]"><Terminal size={13} /> A small example</p>
              <h2 className="font-display m-0 mt-2 text-[1.6rem] font-medium text-[#294333]">Ask your notebook.</h2>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
              <div className="rounded-xl bg-[#1d382d] p-4 text-[#e8eee5]">
                <div className="mb-1 flex justify-end">{copyButton(`curl -H "Authorization: Bearer ${apiKey || "<key>"}" ${origin}/api/external/items`, "curl", true)}</div>
                <pre className="m-0 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-6">{`curl -H "Authorization: Bearer <key>" ${origin}/api/external/items`}</pre>
              </div>
              <p className="mb-0 mt-3 text-[10px] leading-5 text-[#526257]">Keep your key private. You can rotate it at any time; connected clients will need the new one.</p>
            </CardContent>
          </Card>

          {user?.role === "Admin" && <Card className="rounded-[1.5rem] border-[#e1e5dc] bg-[#f0f2eb] py-0 shadow-none">
            <CardHeader className="flex-row items-center gap-3 px-5 pb-0 pt-5 sm:px-6 sm:pt-6">
              <span className="grid size-9 place-items-center rounded-xl bg-white text-[#59735f]"><Server size={16} /></span>
              <div><p className="m-0 font-mono text-[9px] uppercase tracking-[.16em] text-[#58675d]">Administrator</p><h2 className="m-0 mt-1 text-xs font-semibold text-[#405749]">Server details</h2></div>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-3 sm:px-6 sm:pb-6">
              {serverError && <MessageBanner title="Could not load server details" className="mt-0">{serverError}<Button type="button" variant="outline" size="sm" onClick={loadServerInfo} className="ml-2 h-7 rounded-lg">Retry</Button></MessageBanner>}
              <pre className="m-0 overflow-auto rounded-xl bg-white/80 p-3 font-mono text-[10px] leading-5 text-[#465b4c]">{serverLoading ? "Loading…" : serverInfo ? JSON.stringify(serverInfo, null, 2) : serverError ? "Server details unavailable." : "No server details."}</pre>
            </CardContent>
          </Card>}
        </div>
      </div>
      <ConfirmDialog
        open={rotateOpen}
        onOpenChange={setRotateOpen}
        title="Rotate your API key?"
        description="Connected devices and assistants will stop working until you replace the current key with the new one."
        confirmLabel="Rotate key"
        onConfirm={rotateKey}
        busy={rotateBusy}
        error={rotateError}
      />
    </section>
  );
}
