import { createContext, useContext, useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  ArrowUpRight,
  BookOpenText,
  CircleHelp,
  FolderKanban,
  LogOut,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useAuth } from "../auth.jsx";
import { cn } from "../lib/utils.js";
import { Button } from "./ui/button.jsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet.jsx";

const NotebookFilterContext = createContext(null);

export function useNotebookFilters() {
  const context = useContext(NotebookFilterContext);
  if (!context) throw new Error("useNotebookFilters must be used within AppShell.");
  return context;
}

const links = [
  { to: "/items", label: "Notebook", detail: "Notes & tasks", icon: BookOpenText },
  { to: "/categories", label: "Collections", detail: "Your own order", icon: FolderKanban },
];

function Brand({ onNavigate }) {
  return (
    <Link to="/items" onClick={onNavigate} className="flex w-fit items-center gap-3 rounded-lg outline-none focus-visible:ring-2">
      <span className="grid size-10 place-items-center rounded-[13px] bg-[#d9ed9c] text-[#1c3b2f]">
        <BookOpenText size={20} strokeWidth={1.9} aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-serif text-[1.45rem] tracking-tight text-[#fbfcf7]">listjj</span>
        <span className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.19em] text-[#a6b6aa]">Personal index</span>
      </span>
    </Link>
  );
}

function WorkspaceNav({ user, onNavigate }) {
  const entries = user?.role === "Admin" ? [...links, { to: "/users", label: "People", detail: "Access & roles", icon: UsersRound }] : links;
  return (
    <>
      <div className="px-5 pb-4 pt-7">
        <Brand onNavigate={onNavigate} />
      </div>
      <div className="px-5 pb-2 pt-8 font-mono text-[9px] uppercase tracking-[0.2em] text-[#b8c7bc]">Workspace</div>
      <nav className="flex flex-col gap-1 px-3" aria-label="Main navigation">
        {entries.map(({ to, label, detail, icon: Icon }, index) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group flex min-h-[56px] items-center gap-3 rounded-xl px-3.5 py-2.5 transition-colors duration-150",
                isActive ? "bg-[#191919] text-[#f2f2f2]" : "text-[#a6a9ad] hover:bg-white/[0.07] hover:text-white"
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", isActive ? "bg-[#222222]" : "bg-white/[0.07] group-hover:bg-white/[0.12]")}>
                  <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold leading-5">{label}</span>
                <span className="block truncate text-[10px] leading-4 text-[#8a8d91]">{detail}</span>
                </span>
                <span className="font-mono text-[9px] text-[#8a8d91]">0{index + 1}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 pb-2 pt-9 font-mono text-[9px] uppercase tracking-[0.2em] text-[#b8c7bc]">Account</div>
      <nav className="flex flex-col gap-1 px-3" aria-label="Account navigation">
        <NavLink
          to="/settings"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "group flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2 text-[13px] font-medium transition-colors",
              isActive ? "bg-white/[0.12] text-white" : "text-[#c6d2c9] hover:bg-white/[0.07] hover:text-white"
            )
          }
        >
          <Settings2 size={17} strokeWidth={1.8} aria-hidden="true" />
          Settings & access
        </NavLink>
      </nav>

      <div className="mt-auto px-3 pb-4 pt-8">
        <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.05] p-3.5">
          <div className="mb-2 flex items-center gap-2 text-[#d9ed9c]">
            <CircleHelp size={15} aria-hidden="true" />
            <span className="font-mono text-[9px] uppercase tracking-[0.16em]">A small reminder</span>
          </div>
          <p className="m-0 font-serif text-[15px] leading-[1.35] text-[#e9eee8]">Make room for what matters.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl px-2 py-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#37594a] text-[11px] font-semibold uppercase text-white">
            {user?.email?.slice(0, 1) || "U"}
          </span>
          <span className="min-w-0 flex-1 truncate text-[11px] text-[#e5ece6]">{user?.email}</span>
          {user?.role === "Admin" && <ShieldCheck size={14} className="shrink-0 text-[#c6df8b]" aria-label="Administrator" />}
        </div>
      </div>
    </>
  );
}

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersActive, setFiltersActive] = useState(false);
  const location = useLocation();
  const pathname = location.pathname;
  const currentLink = [
    ...links,
    ...(user?.role === "Admin" ? [{ to: "/users", label: "People", mobileLabel: "People" }] : []),
    { to: "/settings", label: "Settings", mobileLabel: "Settings" },
  ].find((link) => pathname.startsWith(link.to));
  const notebookRoute = pathname === "/items" || pathname.startsWith("/items/");

  useEffect(() => {
    setFiltersOpen(false);
  }, [pathname]);

  return (
    <div className="app-shell min-h-screen bg-background">
      <aside className="navigation-dark fixed inset-y-0 left-0 z-30 hidden h-dvh min-h-0 w-[258px] flex-col overflow-y-auto overscroll-contain bg-[#19382e] text-white lg:flex">
        <WorkspaceNav user={user} />
      </aside>

      <div className="min-h-screen lg:pl-[258px]">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#e2e5dc] bg-[#f5f5ef]/95 px-2 backdrop-blur-md sm:h-[74px] sm:px-7 lg:px-10">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial sm:gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="size-11 shrink-0 rounded-xl border-[#dfe4da] bg-white sm:size-10 lg:hidden" aria-label="Open navigation">
                  <Menu size={18} aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="navigation-dark h-dvh min-h-0 w-[290px] max-w-[85vw] overflow-y-auto overscroll-contain border-0 bg-[#19382e] p-0 text-white">
                <SheetTitle className="sr-only">Listjj navigation</SheetTitle>
                <SheetDescription className="sr-only">Navigate between your notebook, collections, and settings.</SheetDescription>
                <WorkspaceNav user={user} onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <div className="hidden min-w-0 sm:block">
              <p className="m-0 truncate font-mono text-[9px] uppercase tracking-[0.2em] text-[#58675d]">A personal index <span className="px-1.5 text-[#58675d]">/</span> {currentLink?.label || "Workspace"}</p>
              <p className="m-0 mt-1 truncate text-[12px] text-[#56655b]">Keep the useful things close.</p>
            </div>
            <span className="min-w-0 flex-1 truncate font-serif text-[17px] font-medium tracking-tight text-[#20382d] sm:hidden">{currentLink?.mobileLabel || currentLink?.label || "Workspace"}</span>
          </div>
          <div className="ml-1 flex shrink-0 items-center gap-0.5 sm:ml-3 sm:gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-[#dce3d7] bg-white/70 px-3 py-1.5 text-[10px] text-[#637267] sm:inline-flex">
              <span data-hardware-detail aria-hidden="true" className="size-1.5 rounded-full" />
              Private workspace
            </span>
            {notebookRoute && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Find notes"
                aria-expanded={filtersOpen}
                aria-controls="notebook-filters"
                aria-describedby={filtersActive ? "notebook-filter-status" : undefined}
                onClick={() => setFiltersOpen((value) => !value)}
                className="relative size-11 rounded-xl text-[#526258] hover:bg-white"
              >
                <Search size={18} aria-hidden="true" />
                {filtersActive && <span data-hardware-indicator data-testid="notebook-filter-dot" aria-hidden="true" className="absolute right-1.5 top-1.5 size-1.5 rounded-full" />}
              </Button>
            )}
            {notebookRoute && filtersActive && <span id="notebook-filter-status" className="sr-only">Filters active</span>}
            <Button variant="ghost" size="sm" aria-label="Sign out" onClick={logout} className="size-11 rounded-xl px-0 text-[#526258] hover:bg-white sm:size-auto sm:gap-2 sm:px-3">
              <LogOut size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </header>

        <main className="workspace-main px-4 pb-12 pt-4 sm:px-7 sm:pt-9 lg:px-10 lg:pt-11">
          <NotebookFilterContext.Provider value={{ filtersOpen, setFiltersOpen, filtersActive, setFiltersActive }}>
            <div className="page-enter">{children}</div>
          </NotebookFilterContext.Provider>
          <footer className="mt-16 flex flex-wrap items-center justify-between gap-2 border-t border-[#e1e4dc] pt-4 text-[10px] text-[#58675d]">
            <span>Listjj <span className="px-1.5">·</span> your thoughts, in good order</span>
            <a href="/api/docs" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 transition-colors hover:text-[#244b3d]">
              API reference <ArrowUpRight size={12} aria-hidden="true" />
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
