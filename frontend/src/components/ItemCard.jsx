import { useRef, useState } from "react";
import { api } from "../api.js";
import ItemForm from "./ItemForm.jsx";

export default function ItemCard({ item, categories, tags, canMove, onChanged, onError }) {
  const [editing, setEditing] = useState(false);
  const fileInput = useRef(null);

  const run = async (action) => {
    try {
      await action();
      onChanged();
    } catch (err) {
      onError(err.message);
    }
  };

  const save = (payload) =>
    run(async () => {
      await api.post("/items", payload);
      setEditing(false);
    });

  const toggleActive = () =>
    save({
      id: item.id,
      name: item.name,
      description: item.description,
      value: item.value,
      active: !item.active,
      categoryId: item.categoryId,
      tags: item.tags,
    });

  const remove = () => {
    if (window.confirm(`Delete "${item.name}"?`)) run(() => api.del(`/items/${item.id}`));
  };

  const move = (direction) => run(() => api.post(`/items/${item.id}/move`, undefined, { direction }));

  const uploadFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    run(() => api.upload(`/items/${item.id}/files`, file));
    e.target.value = "";
  };

  if (editing) {
    return (
      <article className="item editing">
        <ItemForm
          item={item}
          categories={categories}
          tags={tags}
          submitLabel="Save"
          onSubmit={save}
          onCancel={() => setEditing(false)}
        />
        <FileList item={item} onError={onError} onChanged={onChanged} />
      </article>
    );
  }

  return (
    <article className={`item ${item.active ? "" : "inactive"}`} onDoubleClick={() => setEditing(true)}>
      <div className="item-head">
        <input type="checkbox" checked={item.active} onChange={toggleActive} title="Active" />
        <span className="badge value">{item.value}</span>
        <h3 className="item-name">{item.name}</h3>
        <div className="spacer" />
        {canMove && (
          <>
            <button className="icon" title="Move up" onClick={() => move("up")}>
              ↑
            </button>
            <button className="icon" title="Move down" onClick={() => move("down")}>
              ↓
            </button>
          </>
        )}
        <button className="icon" title="Edit" onClick={() => setEditing(true)}>
          ✎
        </button>
        <button className="icon danger" title="Delete" onClick={remove}>
          ✕
        </button>
      </div>
      {item.description && <p className="item-desc">{item.description}</p>}
      <div className="item-foot">
        {item.tags.map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
        <span className="muted small">{item.categoryName}</span>
        <FileList item={item} onError={onError} onChanged={onChanged} />
        <label className="link small">
          + file
          <input ref={fileInput} type="file" hidden onChange={uploadFile} />
        </label>
      </div>
    </article>
  );
}

function FileList({ item, onError, onChanged }) {
  if (!item.files?.length) return null;
  return (
    <div className="files">
      {item.files.map((f) => (
        <span key={f.id} className="file">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              api.download(`/files/${f.id}`, f.name).catch((err) => onError(err.message));
            }}
          >
            📎 {f.name}
          </a>
          <button
            className="icon small danger"
            title="Remove file"
            onClick={async () => {
              if (!window.confirm(`Remove ${f.name}?`)) return;
              try {
                await api.del(`/files/${f.id}`);
                onChanged();
              } catch (err) {
                onError(err.message);
              }
            }}
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  );
}
