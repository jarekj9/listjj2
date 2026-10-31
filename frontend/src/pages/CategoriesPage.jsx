import { useEffect, useState } from "react";
import { api } from "../api.js";

const blank = { name: "", description: "" };

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [draft, setDraft] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(blank);
  const [error, setError] = useState("");

  const load = () => api.get("/categories").then(setCategories).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post("/categories", draft);
      setDraft(blank);
      setError("");
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const saveEdit = async (id) => {
    try {
      await api.post("/categories", { id, ...editForm });
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete category "${c.name}" and ALL its items?`)) return;
    try {
      await api.del(`/categories/${c.id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <h2>Categories</h2>
      <form className="card row wrap" onSubmit={create}>
        <input placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
        <input
          className="grow"
          placeholder="Description"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
        <button type="submit">Add category</button>
      </form>
      {error && <p className="error">{error}</p>}

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {categories.map((c) =>
            editingId === c.id ? (
              <tr key={c.id}>
                <td>
                  <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </td>
                <td>
                  <input
                    className="grow"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  />
                </td>
                <td className="actions">
                  <button onClick={() => saveEdit(c.id)}>Save</button>
                  <button className="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </td>
              </tr>
            ) : (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td className="muted">{c.description}</td>
                <td className="actions">
                  <button
                    className="icon"
                    title="Edit"
                    onClick={() => {
                      setEditingId(c.id);
                      setEditForm({ name: c.name, description: c.description });
                    }}
                  >
                    ✎
                  </button>
                  <button className="icon danger" title="Delete" onClick={() => remove(c)}>
                    ✕
                  </button>
                </td>
              </tr>
            )
          )}
          {categories.length === 0 && (
            <tr>
              <td colSpan={3} className="muted">
                No categories yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
