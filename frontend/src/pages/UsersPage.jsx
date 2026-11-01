import { useEffect, useState } from "react";
import { Check, CirclePlus, KeyRound, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { api } from "../api.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import MessageBanner from "../components/MessageBanner.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table.jsx";

const blankNew = { email: "", password: "", role: "User" };

function RoleSelect({ roles, value, onChange, label, disabled }) {
  const selectedValue = value || "pending";
  const options = selectedValue !== "pending" && !roles.includes(selectedValue) ? [...roles, selectedValue] : roles;
  return (
    <Select value={selectedValue} onValueChange={(next) => onChange(next === "pending" ? "" : next)}>
      <SelectTrigger disabled={disabled} aria-label={label} className="h-9 w-full min-w-[130px] rounded-lg border-[#dfe4da] bg-white text-xs shadow-none"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="pending">Pending approval</SelectItem>
        {options.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState("");
  const [draft, setDraft] = useState(blankNew);
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState("");

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const list = await api.get("/users");
      setUsers(list);
    } catch (error) {
      setLoadError(error.message || "Accounts could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    setRolesLoading(true);
    setRolesError("");
    try {
      setRoles(await api.get("/roles"));
    } catch (error) {
      setRolesError(error.message || "Available roles could not be loaded.");
    } finally {
      setRolesLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadRoles();
  }, []);

  const edit = (user, patch) => setEdits((previous) => ({ ...previous, [user.id]: { ...(previous[user.id] || {}), ...patch } }));

  const saveRow = async (user) => {
    const change = edits[user.id] || {};
    try {
      await api.post("/users", {
        id: user.id,
        email: change.email !== undefined ? change.email : user.email,
        role: change.role !== undefined ? change.role || null : user.role,
        password: change.password || null,
      });
      setEdits((previous) => ({ ...previous, [user.id]: {} }));
      setNotice({ type: "success", text: `Access for ${change.email || user.email} is updated.` });
      await load();
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    }
  };

  const create = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post("/users", { email: draft.email, password: draft.password, role: draft.role || null });
      setDraft(blankNew);
      setNotice({ type: "success", text: `Access created for ${draft.email}.` });
      await load();
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!removeTarget) return;
    setRemoveBusy(true);
    setRemoveError("");
    try {
      await api.del(`/users/${removeTarget.id}`);
      setNotice({ type: "success", text: `${removeTarget.email} and their data were removed.` });
      setRemoveTarget(null);
      await load();
    } catch (error) {
      setRemoveError(error.message || "The account could not be removed.");
    } finally {
      setRemoveBusy(false);
    }
  };

  const pendingCount = users.filter((user) => !user.role).length;

  return (
    <section aria-labelledby="people-title">
      <PageHeader id="people-title" number="04" eyebrow="Keep access thoughtful" title="People & access." description="Invite people into your workspace, approve new accounts and keep credentials current." />
      {notice && <MessageBanner type={notice.type} className="mb-5 mt-0" title={notice.type === "error" ? "Could not complete that" : "Saved"}>{notice.text}<button type="button" onClick={() => setNotice(null)} className="ml-2 underline underline-offset-2">Dismiss</button></MessageBanner>}
      {rolesError && <MessageBanner className="mb-5 mt-0" title="Roles unavailable">{rolesError}<Button type="button" variant="outline" size="sm" disabled={rolesLoading} onClick={loadRoles} className="ml-2 h-7 rounded-lg">{rolesLoading ? "Retrying…" : "Retry roles"}</Button></MessageBanner>}
      {loadError && users.length > 0 && <MessageBanner className="mb-5 mt-0" title="Account list may be out of date">{loadError}<Button type="button" variant="outline" size="sm" onClick={load} className="ml-2 h-7 rounded-lg">Retry</Button></MessageBanner>}

      <div className="mb-8 flex flex-wrap gap-x-8 gap-y-3 border-y border-[#e0e4db] py-3.5">
        <div className="flex items-center gap-2.5"><UsersRound size={15} className="text-[#607666]" aria-hidden="true" /><span className="font-mono text-[10px] uppercase tracking-[.12em] text-[#58675d]">Accounts</span><strong className="font-serif text-lg font-medium text-[#2b4435]">{users.length}</strong></div>
        <div className="flex items-center gap-2.5"><ShieldCheck size={15} className="text-[#8d9d62]" aria-hidden="true" /><span className="font-mono text-[10px] uppercase tracking-[.12em] text-[#58675d]">Awaiting approval</span><strong className="font-serif text-lg font-medium text-[#2b4435]">{pendingCount}</strong></div>
      </div>

      <section className="mb-9 rounded-[1.4rem] border border-[#dfe5d9] bg-[#edf0e6] p-4 sm:p-5" aria-labelledby="invite-heading">
        <div className="mb-4 flex items-start gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-[#dce8cf] text-[#496b50]"><CirclePlus size={17} aria-hidden="true" /></span>
          <div><h2 id="invite-heading" className="m-0 text-sm font-semibold text-[#304839]">Add someone</h2><p className="mb-0 mt-1 text-[11px] text-[#58675d]">Create a sign-in for a person you trust.</p></div>
        </div>
        <form onSubmit={create} className="grid gap-3 md:grid-cols-[minmax(180px,1.2fr)_minmax(150px,1fr)_minmax(145px,.7fr)_auto] md:items-end">
          <label className="grid gap-1.5 text-[10px] font-semibold text-[#4c6053]">Email address
            <Input type="email" autoComplete="email" placeholder="person@example.com" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} required className="h-10 rounded-xl border-[#d7e0d3] bg-[#fffefa] text-sm shadow-none" />
          </label>
          <label className="grid gap-1.5 text-[10px] font-semibold text-[#4c6053]">Temporary password
            <Input type="password" autoComplete="new-password" placeholder="At least 6 characters" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} required minLength={6} className="h-10 rounded-xl border-[#d7e0d3] bg-[#fffefa] text-sm shadow-none" />
          </label>
          <label className="grid gap-1.5 text-[10px] font-semibold text-[#4c6053]">Initial role
            <RoleSelect roles={roles} value={draft.role} label="Initial role" disabled={rolesLoading || Boolean(rolesError)} onChange={(role) => setDraft({ ...draft, role })} />
          </label>
          <Button type="submit" disabled={saving || rolesLoading || Boolean(rolesError)} className="h-10 rounded-xl bg-[#244b3d] px-4 text-white hover:bg-[#1c3c30] md:mb-0">{saving ? "Adding…" : "Add account"}</Button>
        </form>
      </section>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="m-0 font-mono text-[10px] uppercase tracking-[.17em] text-[#58675d]">Workspace accounts</h2>
        {loading && <span role="status" className="text-[10px] text-[#58675d]">Refreshing…</span>}
      </div>

      {loading && users.length === 0 ? (
        <div className="space-y-2" role="status" aria-label="Loading accounts">{[0, 1].map((row) => <div key={row} className="flex items-center gap-3 rounded-xl border border-[#e6e9e2] bg-[#fffefa] p-4"><span className="size-9 animate-pulse rounded-full bg-[#e5e9e1]" /><span className="h-3 w-1/3 animate-pulse rounded bg-[#e5e9e1]" /></div>)}</div>
      ) : loadError ? (
        <div className="min-w-0 rounded-2xl border border-[#e1e5dd] bg-[#fffefa] p-4 sm:p-6"><p className="mb-2 text-sm font-semibold text-[#304839]">Accounts could not be loaded.</p><p className="mb-4 min-w-0 max-w-full text-sm text-[#526257] [overflow-wrap:anywhere]">{loadError}</p><Button variant="outline" size="sm" onClick={load} className="rounded-lg">Try again</Button></div>
      ) : !loading && users.length === 0 ? (
        <div className="rounded-2xl border border-[#e1e5dd] bg-[#fffefa]"><div className="py-4"><UsersRound size={22} className="mx-auto mb-2 text-[#526a58]" /><p className="text-center text-sm text-[#58675d]">No other accounts yet.</p></div></div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-[#e1e5dd] bg-[#fffefa] md:block">
            <Table>
              <TableHeader><TableRow className="bg-[#f5f6f0] hover:bg-[#f5f6f0]"><TableHead className="pl-5 font-mono text-[9px] uppercase tracking-[.14em]">Account</TableHead><TableHead className="font-mono text-[9px] uppercase tracking-[.14em]">Role</TableHead><TableHead className="font-mono text-[9px] uppercase tracking-[.14em]">Change password</TableHead><TableHead className="pr-5 text-right font-mono text-[9px] uppercase tracking-[.14em]">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {users.map((user) => {
                  const change = edits[user.id] || {};
                  return <TableRow key={user.id} className="border-[#edf0e9]">
                    <TableCell className="min-w-[220px] pl-5">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e8eee4] font-serif text-sm text-[#41604b]">{(change.email ?? user.email).slice(0, 1).toUpperCase()}</span>
                        <Input type="email" aria-label={`Email for ${user.email}`} value={change.email !== undefined ? change.email : user.email} onChange={(event) => edit(user, { email: event.target.value })} className="h-9 min-w-[180px] border-transparent bg-transparent px-2 text-xs shadow-none hover:border-[#e0e4db] focus-visible:border-[#b7c7b5]" />
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[150px]"><RoleSelect roles={roles} value={change.role !== undefined ? change.role : user.role || ""} label={`Role for ${user.email}`} disabled={rolesLoading || Boolean(rolesError)} onChange={(role) => edit(user, { role })} /></TableCell>
                    <TableCell className="min-w-[180px]"><div className="relative"><KeyRound size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64736a]" /><Input type="password" autoComplete="new-password" aria-label={`New password for ${user.email}`} placeholder="Leave unchanged" value={change.password || ""} onChange={(event) => edit(user, { password: event.target.value })} className="h-9 rounded-lg border-[#e0e4db] bg-white pl-8 text-xs shadow-none" /></div></TableCell>
                    <TableCell className="pr-5"><div className="flex justify-end gap-1"><Button size="sm" onClick={() => saveRow(user)} className="h-8 gap-1.5 rounded-lg px-3 text-[10px]"><Check size={13} />Save</Button><Button variant="ghost" size="icon-sm" aria-label={`Delete account ${user.email}`} onClick={() => { setRemoveError(""); setRemoveTarget(user); }} className="rounded-lg text-[#7d4138] hover:bg-[#f8ece8] hover:text-[#8c362d]"><Trash2 size={14} /></Button></div></TableCell>
                  </TableRow>;
                })}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 md:hidden">
            {users.map((user) => {
              const change = edits[user.id] || {};
              return <article key={user.id} className="grid gap-3 rounded-2xl border border-[#e1e5dd] bg-[#fffefa] p-4">
                <div className="flex items-center gap-2.5"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e8eee4] font-serif text-sm text-[#41604b]">{(change.email ?? user.email).slice(0, 1).toUpperCase()}</span><Input type="email" aria-label={`Email for ${user.email}`} value={change.email !== undefined ? change.email : user.email} onChange={(event) => edit(user, { email: event.target.value })} className="h-9 border-transparent bg-transparent px-1 text-xs shadow-none" /></div>
                <RoleSelect roles={roles} value={change.role !== undefined ? change.role : user.role || ""} label={`Role for ${user.email}`} disabled={rolesLoading || Boolean(rolesError)} onChange={(role) => edit(user, { role })} />
                <Input type="password" autoComplete="new-password" aria-label={`New password for ${user.email}`} placeholder="Leave password unchanged" value={change.password || ""} onChange={(event) => edit(user, { password: event.target.value })} className="h-9 rounded-lg border-[#e0e4db] bg-white text-xs shadow-none" />
                <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => { setRemoveError(""); setRemoveTarget(user); }} className="rounded-lg text-[#7d4138]">Remove</Button><Button size="sm" onClick={() => saveRow(user)} className="gap-1.5 rounded-lg"><Check size={13} />Save</Button></div>
              </article>;
            })}
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remove this account?"
        description={removeTarget ? `Removing ${removeTarget.email} also deletes their categories, notes and attachments.` : ""}
        confirmLabel="Remove account"
        onConfirm={remove}
        busy={removeBusy}
        error={removeError}
      />
    </section>
  );
}
