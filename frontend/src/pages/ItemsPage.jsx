import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import ItemCard from "../components/ItemCard.jsx";
import ItemForm from "../components/ItemForm.jsx";

export default function ItemsPage() {
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState([]);
  const [tags, setTags] = useState([]);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");

  const notifyError = (text) => setMessage(text);

  // initial load: categories and the recently used category
  useEffect(() => {
    Promise.all([api.get("/categories"), api.get("/categories/recent")])
      .then(([cats, recent]) => {
        setCategories(cats);
        setCategoryId(recent.categoryId || "");
        setReady(true);
      })
      .catch((err) => notifyError(err.message));
  }, []);

  const reload = useCallback(async () => {
    try {
      const [list, tagList] = await Promise.all([
        api.get("/items", {
          q: search,
          category_id: categoryId,
          date_from: dateFrom ? `${dateFrom}T00:00:00Z` : undefined,
          date_to: dateTo ? `${dateTo}T23:59:59.999999Z` : undefined,
        }),
        api.get("/tags", { category_id: categoryId }),
      ]);
      setItems(list);
      setTags(tagList);
    } catch (err) {
      notifyError(err.message);
    }
  }, [search, categoryId, dateFrom, dateTo]);

  // debounced reload on filter changes
  useEffect(() => {
    if (!ready) return undefined;
    const timer = setTimeout(reload, 200);
    return () => clearTimeout(timer);
  }, [ready, reload]);

  const selectCategory = async (id) => {
    setCategoryId(id);
    api.put("/categories/recent", { categoryId: id || null }).catch(() => {});
  };

  const createItem = async (payload) => {
    await api.post("/items", payload);
    setAdding(false);
    reload();
  };

  const sortByTags = async () => {
    try {
      await api.post(`/items/sort-by-tags/${categoryId}`);
      reload();
    } catch (err) {
      notifyError(err.message);
    }
  };

  const importCsv = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await api.upload("/items/import", file);
      setMessage(`Imported ${result.imported} item(s).${result.errors.length ? " Errors: " + result.errors.join("; ") : ""}`);
      reload();
    } catch (err) {
      notifyError(err.message);
    }
    e.target.value = "";
  };

  const exportCsv = () => api.download("/items/export", "listjj-export.csv").catch((err) => notifyError(err.message));

  return (
    <div className="page">
      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search: words, !exclude, tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={categoryId} onChange={(e) => selectCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="filter-date">
          Modified from
          <input
            type="date"
            aria-label="Modified from"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </label>
        <label className="filter-date">
          Modified to
          <input
            type="date"
            aria-label="Modified to"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </label>
        {(dateFrom || dateTo) && (
          <button className="ghost" onClick={() => { setDateFrom(""); setDateTo(""); }}>
            Clear dates
          </button>
        )}
        {categoryId && (
          <button className="ghost" onClick={sortByTags} title="Renumber items alphabetically by tags">
            Sort by tags
          </button>
        )}
        <button onClick={() => setAdding((v) => !v)}>{adding ? "Close" : "+ New item"}</button>
        <div className="spacer" />
        <button className="ghost" onClick={exportCsv}>
          Export CSV
        </button>
        <label className="button ghost">
          Import CSV
          <input type="file" accept=".csv,text/csv" hidden onChange={importCsv} />
        </label>
      </div>

      {message && (
        <p className="flash" onClick={() => setMessage("")}>
          {message}
        </p>
      )}

      {adding && (
        <div className="card">
          <ItemForm
            categories={categories}
            tags={tags}
            defaultCategoryId={categoryId}
            submitLabel="Add item"
            onSubmit={createItem}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {categories.length === 0 && ready && (
        <p className="muted">No categories yet. Create one on the Categories page first.</p>
      )}

      <div className="items">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            categories={categories}
            tags={tags}
            canMove={Boolean(categoryId)}
            onChanged={reload}
            onError={notifyError}
          />
        ))}
        {ready && items.length === 0 && <p className="muted">Nothing here yet.</p>}
      </div>
    </div>
  );
}
