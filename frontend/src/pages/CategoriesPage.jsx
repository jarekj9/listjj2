import { useEffect, useState } from "react";
import { FolderOpen, FolderPlus, Pencil, Sparkles, Trash2 } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import EmptyState from "../components/EmptyState.jsx";
import MessageBanner from "../components/MessageBanner.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Textarea } from "../components/ui/textarea.jsx";
import { api } from "../api.js";

const blank = { name: "", description: "" };

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [draft, setDraft] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(blank);
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
      setCategories(await api.get("/categories"));
    } catch (error) {
      setLoadError(error.message || "Collections could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post("/categories", draft);
      setDraft(blank);
      setNotice({ type: "success", text: `“${draft.name.trim()}” is ready for your notes.` });
      await load();
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (id) => {
    try {
      await api.post("/categories", { id, ...editForm });
      setEditingId(null);
      setNotice({ type: "success", text: "Collection details saved." });
      await load();
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    }
  };

  const remove = async () => {
    if (!removeTarget) return;
    setRemoveBusy(true);
    setRemoveError("");
    try {
      await api.del(`/categories/${removeTarget.id}`);
      setNotice({ type: "success", text: `“${removeTarget.name}” and its items were removed.` });
      setRemoveTarget(null);
      await load();
    } catch (error) {
      setRemoveError(error.message || "The collection could not be removed.");
    } finally {
      setRemoveBusy(false);
    }
  };

  return (
    <section aria-labelledby="collections-title">
      <PageHeader id="collections-title" number="02" eyebrow="Give things a place" title="Collections." description="A few considered spaces keep the notebook useful. Keep them broad, or make them wonderfully specific." />

      {notice && <MessageBanner type={notice.type} className="mb-5 mt-0" title={notice.type === "error" ? "Could not complete that" : "Saved"}>{notice.text}<button type="button" onClick={() => setNotice(null)} className="ml-2 underline underline-offset-2">Dismiss</button></MessageBanner>}

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,.65fr)] lg:gap-10">
        <section className="min-w-0" aria-label="Your collections">
          <div className="mb-2 flex items-center justify-between border-b border-[#dfe4da] pb-3">
            <p className="m-0 font-mono text-[9px] uppercase tracking-[.18em] text-[#58675d]">Your shelves</p>
            <span className="font-mono text-[10px] text-[#58675d]">{categories.length.toString().padStart(2, "0")}</span>
          </div>

          {loading ? (
            <div className="space-y-3 py-5" role="status" aria-label="Loading collections">{[0, 1, 2].map((line) => <div key={line} className="flex gap-4 border-b border-[#e6e8e0] py-4"><div className="size-10 animate-pulse rounded-xl bg-[#e4e9df]" /><div className="flex-1 space-y-3"><div className="h-4 w-1/3 animate-pulse rounded bg-[#e4e9df]" /><div className="h-3 w-2/3 animate-pulse rounded bg-[#eceee8]" /></div></div>)}</div>
          ) : loadError ? (
            <EmptyState icon={FolderOpen} eyebrow="Connection interrupted" title="Collections could not load." description={loadError} action="Try again" onAction={load} />
          ) : categories.length === 0 ? (
            <EmptyState icon={FolderOpen} eyebrow="An open shelf" title="Nothing filed yet." description="Create a collection on the right to gather notes around a topic, project or season." />
          ) : (
            <div className="divide-y divide-[#e6e8e0]">
              {categories.map((category, index) => editingId === category.id ? (
                <div key={category.id} className="grid gap-3 py-5 sm:grid-cols-[1fr_1.2fr_auto] sm:items-end">
                  <label className="grid gap-1.5 text-[10px] font-semibold text-[#4c6053]">Name
                    <Input autoFocus maxLength={200} value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} className="h-10 rounded-lg border-[#dce2d8] bg-white text-sm" />
                  </label>
                  <label className="grid gap-1.5 text-[10px] font-semibold text-[#4c6053]">Description
                    <Input value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} className="h-10 rounded-lg border-[#dce2d8] bg-white text-sm" />
                  </label>
                  <div className="flex justify-end gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="rounded-lg">Cancel</Button>
                    <Button size="sm" onClick={() => saveEdit(category.id)} className="rounded-lg">Save</Button>
                  </div>
                </div>
              ) : (
                <article key={category.id} className="group flex min-w-0 items-start gap-3 py-5 sm:gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e9eee4] text-[#41634e] transition-colors group-hover:bg-[#dce9cf]"><FolderOpen size={18} strokeWidth={1.7} aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-[9px] text-[#58675d]">{String(index + 1).padStart(2, "0")}</span>
                      <h3 title={category.name} className="m-0 min-w-0 truncate text-[14px] font-semibold text-[#2c4435]">{category.name}</h3>
                    </div>
                    <p className="mb-0 mt-1.5 break-words text-[12px] leading-5 text-[#526257]">{category.description || "A collection for the things you want to keep close."}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${category.name}`} title="Edit collection" onClick={() => { setEditingId(category.id); setEditForm({ name: category.name, description: category.description }); }} className="rounded-lg text-[#68786c] opacity-100 hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"><Pencil size={15} /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${category.name}`} title="Delete collection" onClick={() => { setRemoveError(""); setRemoveTarget(category); }} className="rounded-lg text-[#7d4138] opacity-100 hover:bg-[#f8ece8] hover:text-[#8c362d] sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"><Trash2 size={15} /></Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="h-fit rounded-[1.5rem] border border-[#dfe5d9] bg-[#edf0e6] p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-[#dce8cf] text-[#45634b]"><FolderPlus size={18} aria-hidden="true" /></span>
            <span className="font-mono text-[9px] uppercase tracking-[.16em] text-[#58675d]">Make a space</span>
          </div>
          <h2 className="font-display m-0 text-2xl font-medium tracking-tight text-[#294333]">New collection</h2>
          <p className="mb-5 mt-1 text-[12px] leading-5 text-[#58675d]">A name is enough. You can add the shape later.</p>
          <form onSubmit={create} className="grid gap-3">
            <label className="grid gap-1.5 text-[10px] font-semibold text-[#5e7062]" htmlFor="new-category-name">Name
              <Input id="new-category-name" maxLength={200} required placeholder="e.g. Field notes" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="h-11 rounded-xl border-[#d7e0d3] bg-[#fffefa] text-sm shadow-none placeholder:text-[#68766c]" />
            </label>
            <label className="grid gap-1.5 text-[10px] font-semibold text-[#4c6053]" htmlFor="new-category-description">Description <span className="font-normal text-[#58675d]">optional</span>
              <Textarea id="new-category-description" rows={3} placeholder="What belongs here?" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="resize-y rounded-xl border-[#d7e0d3] bg-[#fffefa] text-sm shadow-none placeholder:text-[#68766c]" />
            </label>
            <Button type="submit" className="mt-1 h-10 justify-between rounded-xl bg-[#244b3d] px-4 text-white hover:bg-[#1c3c30]" disabled={saving}>
              <span>{saving ? "Creating…" : "Create collection"}</span><FolderPlus size={16} aria-hidden="true" />
            </Button>
          </form>
          <div className="mt-5 flex items-start gap-2 border-t border-[#dce2d7] pt-4 text-[10px] leading-5 text-[#526257]"><Sparkles size={13} className="mt-0.5 shrink-0 text-[#567243]" aria-hidden="true" /> Collections keep every note findable, without turning your workspace into a filing cabinet.</div>
        </aside>
      </div>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remove this collection?"
        description={removeTarget ? `“${removeTarget.name}” and every note inside it will be permanently deleted.` : ""}
        confirmLabel="Delete collection"
        onConfirm={remove}
        busy={removeBusy}
        error={removeError}
      />
    </section>
  );
}
