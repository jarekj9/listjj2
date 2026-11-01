import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Paperclip, Pencil, Trash2 } from "lucide-react";
import { api } from "../api.js";
import { cn } from "../lib/utils.js";
import ConfirmDialog from "./ConfirmDialog.jsx";
import ItemForm from "./ItemForm.jsx";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";
import { Checkbox } from "./ui/checkbox.jsx";

export default function ItemCard({ item, categories, tags, canMove, onChanged, onError }) {
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const fileInput = useRef(null);

  const run = async (action) => {
    try {
      await action();
      await onChanged();
      return true;
    } catch (err) {
      onError(err.message || "That change could not be saved.");
      return false;
    }
  };

  const save = async (payload) => {
    await api.post("/items", payload);
    setEditing(false);
    await onChanged();
  };

  const toggleActive = () => run(() => api.post("/items", {
    id: item.id,
    name: item.name,
    description: item.description,
    value: item.value,
    active: !item.active,
    categoryId: item.categoryId,
    tags: item.tags,
  }));

  const remove = async () => {
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await api.del(`/items/${item.id}`);
      setDeleteOpen(false);
      await onChanged();
    } catch (err) {
      setDeleteError(err.message || "The note could not be removed.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const uploadFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await run(() => api.upload(`/items/${item.id}/files`, file));
    event.target.value = "";
  };

  if (editing) {
    return (
      <article className="rounded-2xl border border-[#d9e0d5] bg-[#fffefa] p-4 shadow-[0_14px_36px_-32px_rgba(29,55,43,.55)] sm:p-6">
        <ItemForm item={item} categories={categories} tags={tags} submitLabel="Save changes" onSubmit={save} onCancel={() => setEditing(false)} />
        <FileList item={item} onError={onError} onChanged={onChanged} />
      </article>
    );
  }

  return (
    <article className={cn("group grid gap-3 border-b border-[#e6e8e0] py-5 first:pt-1 last:border-b-0 sm:grid-cols-[30px_minmax(0,1fr)_auto] sm:gap-4", !item.active && "bg-[#f1f3ee]")}>
      <div className="pt-1">
        <Checkbox checked={item.active} onCheckedChange={toggleActive} aria-label={`${item.active ? "Complete" : "Reopen"} ${item.name}`} className="size-[18px] rounded-md border-[#b9c7b9] data-[state=checked]:border-[#345b45] data-[state=checked]:bg-[#345b45]" />
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3 className="m-0 min-w-0 max-w-full break-words text-[15px] font-semibold tracking-[-.015em] text-[#263b30]">{item.name}</h3>
          {!item.active && <Badge variant="outline" className="border-[#d9dfd4] bg-[#f1f2ec] text-[9px] font-medium text-[#526257]">Filed</Badge>}
        </div>
        {item.description && <p className="mb-0 mt-1.5 max-w-3xl whitespace-pre-wrap [overflow-wrap:anywhere] text-[13px] leading-[1.65] text-[#59695e]">{item.description}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span title={Number(item.value).toLocaleString(undefined, { maximumFractionDigits: 2 })} className="min-w-0 max-w-full break-all font-mono text-[10px] text-[#58675d]">{Number(item.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          <span className="size-1 rounded-full bg-[#bdc7bb]" />
          <span title={item.categoryName} className="min-w-0 max-w-[12rem] truncate text-[10px] text-[#5d6c61]">{item.categoryName}</span>
          {item.tags?.map((tag) => <Badge key={tag} variant="secondary" title={tag} className="min-w-0 max-w-full rounded-md bg-[#edf0e8] px-2 py-0.5 text-[9px] font-medium text-[#465b4b]"><span className="block max-w-[10.5rem] truncate">{tag}</span></Badge>)}
          {item.files?.length > 0 && <FileList item={item} onError={onError} onChanged={onChanged} />}
          <input ref={fileInput} type="file" tabIndex={-1} aria-hidden="true" className="sr-only" onChange={uploadFile} />
          <Button type="button" variant="ghost" size="sm" onClick={() => fileInput.current?.click()} className="h-7 gap-1.5 rounded-lg px-2 text-[10px] text-[#617166] hover:bg-[#edf0e8]">
            <Paperclip size={13} aria-hidden="true" /> Attach
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1 pl-8 sm:pl-0 sm:pt-0.5">
        {canMove && <>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${item.name} up`} title="Move up" onClick={() => run(() => api.post(`/items/${item.id}/move`, undefined, { direction: "up" }))} className="rounded-lg text-[#5d6c61] opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"><ArrowUp size={15} /></Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${item.name} down`} title="Move down" onClick={() => run(() => api.post(`/items/${item.id}/move`, undefined, { direction: "down" }))} className="rounded-lg text-[#5d6c61] opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"><ArrowDown size={15} /></Button>
        </>}
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Edit ${item.name}`} title="Edit note" onClick={() => setEditing(true)} className="rounded-lg text-[#627468] opacity-100 transition-opacity hover:bg-[#e9eee4] sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"><Pencil size={15} /></Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Delete ${item.name}`} title="Delete note" onClick={() => { setDeleteError(""); setDeleteOpen(true); }} className="rounded-lg text-[#7d4138] opacity-100 transition-opacity hover:bg-[#f7ece8] hover:text-[#8c362d] sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"><Trash2 size={15} /></Button>
      </div>

        <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Remove this note?"
        description={`“${item.name}” will be permanently deleted, including its attachments.`}
        confirmLabel="Delete note"
        onConfirm={remove}
        busy={deleteBusy}
        error={deleteError}
      />
    </article>
  );
}

function FileList({ item, onError, onChanged }) {
  const [removing, setRemoving] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState("");
  if (!item.files?.length) return null;
  const removeFile = async () => {
    setRemoveBusy(true);
    setRemoveError("");
    try {
      await api.del(`/files/${removing.id}`);
      setRemoving(null);
      await onChanged();
    } catch (err) {
      setRemoveError(err.message || "The attachment could not be removed.");
    } finally {
      setRemoveBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {item.files.map((file) => (
          <span key={file.id} className="inline-flex max-w-full items-center gap-1 rounded-md bg-[#f0f2ec] pl-2 text-[10px] text-[#596b5e]">
            <Paperclip size={11} aria-hidden="true" />
            <button type="button" className="max-w-[150px] truncate py-1 text-left hover:underline" onClick={() => api.download(`/files/${file.id}`, file.name).catch((err) => onError(err.message))}>{file.name}</button>
            <button type="button" aria-label={`Remove ${file.name}`} onClick={() => { setRemoveError(""); setRemoving(file); }} className="grid size-6 place-items-center rounded-r-md text-[#774d47] hover:bg-[#f7e9e4] hover:text-[#8c362d]">×</button>
          </span>
        ))}
      </div>
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove attachment?"
        description={removing ? `“${removing.name}” will be permanently removed.` : ""}
        confirmLabel="Remove file"
        onConfirm={removeFile}
        busy={removeBusy}
        error={removeError}
      />
    </>
  );
}
