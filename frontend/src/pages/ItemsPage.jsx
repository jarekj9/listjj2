import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownWideNarrow, ChevronDown, Download, FileUp, LoaderCircle, Plus, Search, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import EmptyState from "../components/EmptyState.jsx";
import ItemCard from "../components/ItemCard.jsx";
import ItemForm from "../components/ItemForm.jsx";
import MessageBanner from "../components/MessageBanner.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select.jsx";
import { useNotebookFilters } from "../components/AppShell.jsx";

function FilterDate({ label, value, onChange, min, max }) {
  const id = `date-${label.replaceAll(" ", "-").toLowerCase()}`;
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1.5">
      <span className="font-mono text-[9px] uppercase tracking-[.13em] text-[#58675d]">{label}</span>
      <Input id={id} type="date" value={value} min={min} max={max} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-lg border-[#e0e4db] bg-white px-2 text-[11px] text-[#57665b] shadow-none" />
    </label>
  );
}

export default function ItemsPage() {
  const navigate = useNavigate();
  const { filtersOpen, setFiltersOpen, openFilters } = useNotebookFilters();
  const importInput = useRef(null);
  const [categories, setCategories] = useState([]);
  const [categoryError, setCategoryError] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [itemsError, setItemsError] = useState("");
  const [tags, setTags] = useState([]);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState(null);

  const notifyError = (text) => setNotice({ type: "error", text });

  const loadCategories = useCallback(async () => {
    setReady(false);
    setCategoryError("");
    const [categoriesResult, recentResult] = await Promise.allSettled([
      api.get("/categories"),
      api.get("/categories/recent"),
    ]);
    if (categoriesResult.status === "fulfilled") {
      setCategories(categoriesResult.value);
    } else {
      setCategoryError(categoriesResult.reason.message || "Collections could not be loaded.");
    }
    if (recentResult.status === "fulfilled") setCategoryId(recentResult.value.categoryId || "");
    setReady(true);
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const reload = useCallback(async () => {
    setLoading(true);
    setItemsError("");
    try {
      const list = await api.get("/items", {
        q: search,
        category_id: categoryId,
        date_from: dateFrom ? `${dateFrom}T00:00:00Z` : undefined,
        date_to: dateTo ? `${dateTo}T23:59:59.999999Z` : undefined,
      });
      setItems(list);
      api.get("/tags", { category_id: categoryId }).then(setTags).catch(() => setTags([]));
    } catch (error) {
      setItemsError(error.message || "Notes could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [search, categoryId, dateFrom, dateTo]);

  useEffect(() => {
    if (!ready) return undefined;
    const timer = setTimeout(reload, 220);
    return () => clearTimeout(timer);
  }, [ready, reload]);

  const selectCategory = (id) => {
    const value = id === "all" ? "" : id;
    setCategoryId(value);
    api.put("/categories/recent", { categoryId: value || null }).catch(() => {});
  };

  const createItem = async (payload) => {
    await api.post("/items", payload);
    setAdding(false);
    setNotice({ type: "success", text: "Note added to your notebook." });
    await reload();
  };

  const sortByTags = async () => {
    try {
      await api.post(`/items/sort-by-tags/${categoryId}`);
      setNotice({ type: "success", text: "Collection sorted by tags." });
      await reload();
    } catch (error) {
      notifyError(error.message);
    }
  };

  const importCsv = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = await api.upload("/items/import", file);
      const summary = `Imported ${result.imported} ${result.imported === 1 ? "note" : "notes"}.`;
      setNotice({
        type: result.errors.length ? "info" : "success",
        text: result.errors.length ? `${summary} ${result.errors.slice(0, 2).join(" · ")}${result.errors.length > 2 ? ` · and ${result.errors.length - 2} more row errors` : ""}` : summary,
      });
      await reload();
    } catch (error) {
      notifyError(error.message);
    }
    event.target.value = "";
  };

  const exportCsv = () => api.download("/items/export", "listjj-export.csv").catch((error) => notifyError(error.message));
  const resetFilters = () => { setSearch(""); selectCategory(""); setDateFrom(""); setDateTo(""); };
  const activeCount = items.filter((item) => item.active).length;
  const selectedCategoryName = categoryId ? categories.find((category) => category.id === categoryId)?.name || "Selected collection" : "All your notes";
  const filtersActive = Boolean(search || categoryId || dateFrom || dateTo);
  const newNoteAction = categoryError ? null : categories.length ? <Button onClick={() => setAdding((value) => !value)} className="h-11 gap-2 rounded-xl bg-[#244b3d] px-4 text-white shadow-[0_6px_16px_-10px_rgba(23,58,44,.7)] hover:bg-[#1c3c30]"><Plus size={17} aria-hidden="true" />{adding ? "Close note" : "New note"}</Button> : <Button asChild className="h-11 rounded-xl bg-[#244b3d] px-4 text-white hover:bg-[#1c3c30]"><Link to="/categories">Create a collection</Link></Button>;

  return (
    <section aria-labelledby="notebook-title">
      <PageHeader
        id="notebook-title"
        number="01"
        eyebrow="Your personal index"
        title="The notebook."
        description="Notes, small plans and loose ends—kept together, without the noise."
        action={newNoteAction}
        compactOnMobile
      />

      {categoryError && <MessageBanner className="mb-5 mt-0" title="Collections unavailable">{categoryError}<Button type="button" variant="outline" size="sm" onClick={loadCategories} className="ml-2 h-7 rounded-lg">Retry</Button></MessageBanner>}

      <div data-testid="mobile-stats-row" className="mb-4 flex min-w-0 flex-wrap items-center gap-2 py-1 sm:hidden">
        {categoryError ? null : categories.length ? <Button onClick={() => setAdding((value) => !value)} className="order-1 h-10 shrink-0 gap-1.5 rounded-xl bg-[#244b3d] px-2.5 text-xs text-white hover:bg-[#1c3c30] min-[360px]:order-2"><Plus size={15} aria-hidden="true" />{adding ? "Close note" : "New note"}</Button> : <Button asChild className="order-1 h-10 shrink-0 rounded-xl bg-[#244b3d] px-2.5 text-xs text-white hover:bg-[#1c3c30] min-[360px]:order-2"><Link to="/categories">Create a collection</Link></Button>}
        <div data-testid="mobile-stats-grid" className="order-2 grid min-w-[228px] flex-1 grid-cols-3 min-[360px]:order-1">
          <div className="min-w-0 pl-1"><p className="m-0 whitespace-nowrap font-mono text-[9px] uppercase tracking-[.13em] text-[#58675d]">In view</p><p className="mb-0 mt-0.5 font-serif text-xl leading-none text-[#294638]">{items.length}<span className="sr-only"> notes</span></p></div>
          <div className="min-w-0 border-l border-[#e4e7df] px-2"><p className="m-0 whitespace-nowrap font-mono text-[9px] uppercase tracking-[.13em] text-[#58675d]">In progress</p><p className="mb-0 mt-0.5 font-serif text-xl leading-none text-[#294638]">{activeCount}<span className="sr-only"> active</span></p></div>
          <div className="min-w-0 border-l border-[#e4e7df] pl-2"><p className="m-0 whitespace-nowrap font-mono text-[9px] uppercase tracking-[.13em] text-[#58675d]">Collected in</p><p className="mb-0 mt-0.5 font-serif text-xl leading-none text-[#294638]">{categories.length}<span className="sr-only"> lists</span></p></div>
        </div>
      </div>

      <div className="mb-6 hidden grid-cols-3 border-y border-[#e0e4db] py-3.5 sm:mb-7 sm:grid sm:py-4">
        <div className="pl-1 sm:pl-3"><p className="m-0 font-mono text-[9px] uppercase tracking-[.16em] text-[#58675d]">In view</p><p className="mb-0 mt-1 font-serif text-2xl text-[#294638]">{items.length}<span className="ml-1 text-sm text-[#58675d]">notes</span></p></div>
        <div className="border-l border-[#e4e7df] pl-4 sm:pl-7"><p className="m-0 font-mono text-[9px] uppercase tracking-[.16em] text-[#58675d]">In progress</p><p className="mb-0 mt-1 font-serif text-2xl text-[#294638]">{activeCount}<span className="ml-1 text-sm text-[#58675d]">active</span></p></div>
        <div className="border-l border-[#e4e7df] pl-4 sm:pl-7"><p className="m-0 font-mono text-[9px] uppercase tracking-[.16em] text-[#58675d]">Collected in</p><p className="mb-0 mt-1 font-serif text-2xl text-[#294638]">{categories.length}<span className="ml-1 text-sm text-[#58675d]">lists</span></p></div>
      </div>

      <section className="rounded-2xl border border-[#e0e4db] bg-[#fffefa] p-3 shadow-[0_10px_34px_-32px_rgba(31,54,40,.5)] sm:p-4" aria-label="Filter notebook">
        <button type="button" aria-expanded={filtersOpen} aria-controls="notebook-filters" onClick={() => filtersOpen ? setFiltersOpen(false) : openFilters()} className="flex min-h-10 w-full items-center justify-between gap-3 rounded-xl px-1 text-left sm:hidden">
          <span className="flex min-w-0 items-center gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[.12em] text-[#344f3e]">Find &amp; filter</span>
            {filtersActive && <span className="size-1.5 shrink-0 rounded-full bg-[#729256]" aria-label="Filters active" />}
            <span className="min-w-0 truncate text-[10px] text-[#58675d]">{selectedCategoryName}</span>
          </span>
          <ChevronDown size={16} className={`shrink-0 text-[#58675d] transition-transform ${filtersOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        <div id="notebook-filters" hidden={!filtersOpen}>
        <div className="grid gap-3 xl:grid-cols-[minmax(180px,1.5fr)_minmax(150px,.9fr)_minmax(125px,.7fr)_minmax(125px,.7fr)_auto] xl:items-end">
          <label htmlFor="item-search" className="flex min-w-0 flex-col gap-1.5">
            <span className="font-mono text-[9px] uppercase tracking-[.13em] text-[#58675d]">Find something</span>
            <span className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#58675d]" aria-hidden="true" />
              <Input id="item-search" type="search" placeholder="Words, tags, or !to exclude" value={search} onChange={(event) => setSearch(event.target.value)} className="scroll-mt-16 h-10 rounded-xl border-[#e0e4db] bg-[#fbfbf7] pl-9 pr-9 text-[12px] shadow-none placeholder:text-[#68766c]" />
              {search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-[#58675d] hover:bg-[#edf0e8]"><X size={14} /></button>}
            </span>
          </label>

          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="font-mono text-[9px] uppercase tracking-[.13em] text-[#58675d]">Collection</span>
            <Select value={categoryId || "all"} onValueChange={selectCategory}>
              <SelectTrigger className="h-10 w-full rounded-xl border-[#e0e4db] bg-[#fbfbf7] text-[12px] shadow-none"><SelectValue placeholder="All collections" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All collections</SelectItem>
                {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>

          <FilterDate label="Changed after" value={dateFrom} max={dateTo || undefined} onChange={setDateFrom} />
          <FilterDate label="Changed before" value={dateTo} min={dateFrom || undefined} onChange={setDateTo} />

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {categoryId && <Button type="button" variant="outline" size="sm" onClick={sortByTags} className="h-10 rounded-xl border-[#dfe4da] bg-white px-3 text-[11px] text-[#53685a]"><ArrowDownWideNarrow size={14} />Sort tags</Button>}
            {(dateFrom || dateTo || search || categoryId) && <Button type="button" variant="ghost" size="sm" onClick={resetFilters} className="h-10 rounded-xl px-2.5 text-[11px] text-[#58675d]">Clear</Button>}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#eceee8] pt-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="size-1.5 shrink-0 rounded-full bg-[#9cba69]" />
            <span className="min-w-0 truncate text-[10px] text-[#58675d]" title={selectedCategoryName}>{selectedCategoryName}</span>
            {loading && <span className="inline-flex items-center gap-1.5 text-[10px] text-[#58675d]" role="status"><LoaderCircle size={12} className="animate-spin" /> Updating</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={exportCsv} className="h-8 gap-1.5 rounded-lg px-2.5 text-[10px] text-[#56695c]"><Download size={13} />Export</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => importInput.current?.click()} className="h-8 gap-1.5 rounded-lg px-2.5 text-[10px] text-[#56695c]"><FileUp size={13} aria-hidden="true" />Import</Button>
            <input ref={importInput} type="file" accept=".csv,text/csv" tabIndex={-1} aria-hidden="true" className="sr-only" onChange={importCsv} />
          </div>
        </div>
        </div>
      </section>

      {notice && <MessageBanner type={notice.type} className="mt-4" title={notice.type === "error" ? "Something needs attention" : notice.type === "success" ? "All set" : "Import finished"}>{notice.text}<button type="button" onClick={() => setNotice(null)} className="ml-2 underline underline-offset-2">Dismiss</button></MessageBanner>}

      {adding && <section className="my-5 rounded-2xl border border-[#dfe5da] bg-[#fffefa] p-4 shadow-[0_14px_36px_-32px_rgba(29,55,43,.55)] sm:p-6"><ItemForm categories={categories} tags={tags} defaultCategoryId={categoryId} submitLabel="Add to notebook" onSubmit={createItem} onCancel={() => setAdding(false)} /></section>}

      {itemsError ? (
        <EmptyState icon={FileUp} eyebrow="A temporary pause" title="Notes could not be loaded." description={itemsError} action="Try again" onAction={reload} />
      ) : categoryError ? null : categories.length === 0 && ready ? (
        <EmptyState icon={FileUp} eyebrow="Start with a collection" title="Give your thoughts a home." description="Create a collection first, then add notes, lists and plans to it." action="Create a collection" onAction={() => navigate("/categories")} />
      ) : loading && items.length === 0 ? (
        <div className="mt-7 space-y-3" aria-label="Loading notes" role="status">{[0, 1, 2].map((row) => <div key={row} className="flex gap-4 border-b border-[#e6e8e0] py-5"><div className="size-[18px] animate-pulse rounded-md bg-[#e5e9e1]" /><div className="flex-1 space-y-3"><div className="h-4 w-2/5 animate-pulse rounded bg-[#e5e9e1]" /><div className="h-3 w-4/5 animate-pulse rounded bg-[#eceee8]" /></div></div>)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileUp}
          eyebrow={search || dateFrom || dateTo ? "No match this time" : "A fresh page"}
          title={search || dateFrom || dateTo ? "Nothing in this slice." : "Leave yourself a note."}
          description={search || dateFrom || dateTo ? "Try another phrase, collection or date range." : "Start with one small thought. You can shape it into a task or let it simply be."}
          action={search || dateFrom || dateTo ? "Clear filters" : "Write a first note"}
          onAction={search || dateFrom || dateTo ? resetFilters : () => setAdding(true)}
        />
      ) : (
        <section className="mt-5" aria-label="Notes">
          <div className="mb-1 flex items-center justify-between border-b border-[#dfe4da] pb-2.5">
            <h2 className="m-0 font-mono text-[9px] uppercase tracking-[.16em] text-[#58675d]">Recent notes</h2>
            <span className="text-[10px] text-[#58675d]">{items.length} {items.length === 1 ? "entry" : "entries"}</span>
          </div>
          {items.map((item) => <ItemCard key={item.id} item={item} categories={categories} tags={tags} canMove={Boolean(categoryId)} onChanged={reload} onError={notifyError} />)}
        </section>
      )}
    </section>
  );
}
