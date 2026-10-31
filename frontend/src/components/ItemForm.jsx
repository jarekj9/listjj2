import { useId, useState } from "react";

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

// Shared by "new item" and "edit item".
export default function ItemForm({ item, categories, tags, defaultCategoryId, submitLabel = "Save", onSubmit, onCancel }) {
  const [form, setForm] = useState(() => fromItem(item, defaultCategoryId));
  const [error, setError] = useState("");
  const listId = useId();

  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.categoryId) return setError("Choose a category.");
    setError("");
    await onSubmit({
      ...(item ? { id: item.id } : {}),
      name: form.name.trim(),
      description: form.description,
      value: Number(form.value) || 0,
      active: form.active,
      categoryId: form.categoryId,
      tags: form.tagsText.split(",").map((t) => t.trim()).filter(Boolean),
    }).catch((err) => setError(err.message));
  };

  return (
    <form className="item-form" onSubmit={submit}>
      <div className="grid">
        <label className="span-2">
          Name
          <input value={form.name} onChange={set("name")} required autoFocus />
        </label>
        <label>
          Value
          <input type="number" step="any" value={form.value} onChange={set("value")} />
        </label>
        <label>
          Category
          <select value={form.categoryId} onChange={set("categoryId")} required>
            <option value="">Choose...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="span-2">
          Description
          <textarea rows={3} value={form.description} onChange={set("description")} />
        </label>
        <label className="span-2">
          Tags <span className="muted small">(comma separated)</span>
          <input value={form.tagsText} onChange={set("tagsText")} list={listId} />
          <datalist id={listId}>
            {tags.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={form.active} onChange={set("active")} /> Active
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row end">
        {onCancel && (
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit">{submitLabel}</button>
      </div>
    </form>
  );
}
