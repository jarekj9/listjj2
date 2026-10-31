import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";

export default function SettingsPage() {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState(null);
  const [custom, setCustom] = useState("");
  const [serverInfo, setServerInfo] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const origin = window.location.origin;

  useEffect(() => {
    api.get("/settings/api-key").then((r) => setApiKey(r.apiKey)).catch((e) => setError(e.message));
    if (user?.role === "Admin") api.get("/settings").then(setServerInfo).catch(() => {});
  }, [user]);

  const run = async (fn) => {
    try {
      setError("");
      setApiKey((await fn()).apiKey);
      setCustom("");
    } catch (err) {
      setError(err.message);
    }
  };

  const copy = async () => {
    try {
      if (window.isSecureContext && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(apiKey || "");
      } else {
        const input = document.createElement("textarea");
        input.value = apiKey || "";
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        let copied = false;
        try {
          input.select();
          copied = document.execCommand("copy");
        } finally {
          input.remove();
        }
        if (!copied) throw new Error("Clipboard access is unavailable.");
      }
      setError("");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy the API key. Select and copy it manually.");
    }
  };

  return (
    <div className="page narrow wide-md">
      <section className="card">
        <h2>API key</h2>
        <p className="muted">
          Used by the external API and by the MCP server. Keep it secret.
        </p>
        <p className="key">
          <code>{apiKey || "not generated"}</code>
          {apiKey && (
            <button className="ghost small" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </button>
          )}
        </p>
        <div className="row wrap">
          <button
            onClick={() => {
              if (!apiKey || window.confirm("Generate a new key? The old one stops working.")) {
                run(() => api.post("/settings/api-key/generate"));
              }
            }}
          >
            Generate new key
          </button>
          <input placeholder="or set a custom GUID" value={custom} onChange={(e) => setCustom(e.target.value)} className="grow" />
          <button className="ghost" disabled={!custom.trim()} onClick={() => run(() => api.put("/settings/api-key", { apiKey: custom.trim() }))}>
            Set key
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      <section className="card">
        <h2>MCP server</h2>
        <p className="muted">Connect an AI assistant with streamable HTTP transport:</p>
        <pre>{`URL:     ${origin}/mcp
Header:  Authorization: Bearer <your API key>`}</pre>
        <p className="muted small">Tools: get_categories, add_category, add_item, update_item, delete_item, delete_category, get_items_by_category.</p>
      </section>

      <section className="card">
        <h2>External API</h2>
        <pre>{`curl -H "Authorization: Bearer <key>" ${origin}/api/external/items
curl -H "Authorization: Bearer <key>" -H "Content-Type: application/json" \\
     -d '{"name":"milk","categoryName":"Shopping"}' ${origin}/api/external/items
curl -H "Authorization: Bearer <key>" ${origin}/api/external/categories/Shopping/first-item`}</pre>
          <p className="muted small">Interactive API docs: <a href={`${origin}/api/docs`} target="_blank" rel="noreferrer">/api/docs</a></p>
      </section>

      {serverInfo && (
        <section className="card">
          <h2>Server</h2>
          <pre>{JSON.stringify(serverInfo, null, 2)}</pre>
        </section>
      )}
    </div>
  );
}
