import { useId, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "./ui/button.jsx";
import { Checkbox } from "./ui/checkbox.jsx";
import { Input } from "./ui/input.jsx";
import { Label } from "./ui/label.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select.jsx";
import { Textarea } from "./ui/textarea.jsx";
import MessageBanner from "./MessageBanner.jsx";

const emptyForm = { name: "", description: "", value: "0", active: true, categoryId: "", tagsText: "" };

function fromItem(item, defaultCategoryId) {
  if (!item) return { ...emptyForm, categoryId: defaultCategoryId || "" };
  return {
    name: item.name,
    description: item.description,
    value: String(item.value),
    active: item.active,
    categoryId: item.categoryId,
    tagsText: item.tags.join(", "),
  };
}

export default function ItemForm({ item, categories, tags = [], defaultCategoryId, submitLabel = "Save note", onSubmit, onCancel }) {
  const [form, setForm] = useState(() => fromItem(item, defaultCategoryId));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const listId = useId();
  const collectionError = error === "Choose a collection for this note.";
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.categoryId) return setError("Choose a collection for this note.");
    if (!form.name.trim()) return setError("Give this note a short title.");
    const value = Number(form.value);
    if (!Number.isFinite(value)) return setError("Enter a valid number, or leave the value at zero.");
    setError("");
    setSaving(true);
    try {
      await onSubmit({
        ...(item ? { id: item.id } : {}),
        name: form.name.trim(),
        description: form.description,
        value,
        active: form.active,
        categoryId: form.categoryId,
        tags: form.tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
      });
    } catch (err) {
      setError(err.message || "The note could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="flex w-full min-w-0 flex-col gap-5" aria-busy={saving} onSubmit={submit}>
      <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3 border-b border-[#e8e9e2] pb-4">
        <div className="min-w-0 flex-1">
          <p className="mb-1 font-mono text-[9px] uppercase tracking-[.18em] text-[#7c8b80]">{item ? "Refine a thought" : "A new page"}</p>
          <h3 className="font-display m-0 text-2xl font-medium text-[#244032]">{item ? "Edit note" : "Capture a thought"}</h3>
        </div>
        {!item && <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {onCancel && <Button type="button" variant="ghost" onClick={onCancel} className="h-10 rounded-xl px-2.5 text-xs text-[#657368] sm:px-3">Cancel</Button>}
          <Button type="submit" disabled={saving} className="h-10 rounded-xl bg-[#244b3d] px-3 text-xs text-white hover:bg-[#1c3c30] sm:px-4">{saving ? "Adding…" : submitLabel}</Button>
        </div>}
      </div>

      {error && <MessageBanner id={`item-error-${listId}`} title="Could not save" className="my-0">{error}</MessageBanner>}

      <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`item-name-${listId}`} className="text-[11px] font-semibold text-[#42594a]">Title <span className="text-[#9e4035">*</span></Label>
          <Input id={`item-name-${listId}`} value={form.name} onChange={set("name")} placeholder="Something worth keeping" maxLength={500} autoFocus className="h-11 rounded-xl border-[#dce2d8] bg-white text-sm shadow-none placeholder:text-[#68766c]" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`item-value-${listId}`} className="text-[11px] font-semibold text-[#42594a]">Value <span className="font-normal text-[#58675d]">optional</span></Label>
          <Input id={`item-value-${listId}`} type="number" step="any" value={form.value} onChange={set("value")} className="h-11 rounded-xl border-[#dce2d8] bg-white font-mono text-sm shadow-none" />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`item-category-${listId}`} className="text-[11px] font-semibold text-[#42594a]">Collection <span className="text-[#9e4035">*</span></Label>
          <Select value={form.categoryId} onValueChange={(categoryId) => setForm((current) => ({ ...current, categoryId }))}>
            <SelectTrigger id={`item-category-${listId}`} aria-label="Collection" aria-invalid={collectionError ? "true" : undefined} aria-describedby={collectionError ? `item-error-${listId}` : undefined} className="h-11 w-full rounded-xl border-[#dce2d8] bg-white shadow-none"><SelectValue placeholder="Choose a collection" /></SelectTrigger>
            <SelectContent>
              {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`item-description-${listId}`} className="text-[11px] font-semibold text-[#42594a]">A little context <span className="font-normal text-[#58675d]">optional</span></Label>
          <Textarea id={`item-description-${listId}`} rows={4} value={form.description} onChange={set("description")} placeholder="Add details, a reminder, or the thought behind it…" className="min-h-[104px] resize-y rounded-xl border-[#dce2d8] bg-white text-sm leading-6 shadow-none placeholder:text-[#68766c]" />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`item-tags-${listId}`} className="text-[11px] font-semibold text-[#42594a]">Tags <span className="font-normal text-[#58675d]">separate with commas</span></Label>
          <Input id={`item-tags-${listId}`} value={form.tagsText} onChange={set("tagsText")} list={listId} placeholder="work, weekend, someday" className="h-11 rounded-xl border-[#dce2d8] bg-white text-sm shadow-none placeholder:text-[#68766c]" />
          <datalist id={listId}>{tags.map((tag) => <option key={tag} value={tag} />)}</datalist>
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#f1f3eb] px-3.5 py-3 sm:col-span-2">
          <Checkbox checked={form.active} onCheckedChange={(active) => setForm((current) => ({ ...current, active: Boolean(active) }))} />
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#3b5444]">Keep it active {form.active && <Check size={12} aria-hidden="true" />}</span>
            <span className="text-[10px] leading-4 text-[#526257]">Turn this off when the item is finished or no longer relevant.</span>
          </span>
        </label>
      </div>

      {item && <div className="flex flex-col-reverse justify-end gap-2 border-t border-[#e8e9e2] pt-4 sm:flex-row">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel} className="rounded-xl text-[#657368]">Cancel</Button>}
        <Button type="submit" disabled={saving} className="rounded-xl bg-[#244b3d] px-5 text-white hover:bg-[#1c3c30]">{saving ? "Saving…" : submitLabel}</Button>
      </div>}
    </form>
  );
}
