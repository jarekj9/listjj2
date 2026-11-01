import { Suspense, lazy, useEffect } from "react";
import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { ArrowLeft, BadgeCheck, NotebookPen } from "lucide-react";
import { useAuth } from "./auth.jsx";
import AppShell from "./components/AppShell.jsx";
import { Button } from "./components/ui/button.jsx";
const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const RegisterPage = lazy(() => import("./pages/RegisterPage.jsx"));
const ItemsPage = lazy(() => import("./pages/ItemsPage.jsx"));
const CategoriesPage = lazy(() => import("./pages/CategoriesPage.jsx"));
const UsersPage = lazy(() => import("./pages/UsersPage.jsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.jsx"));

export default function App() {
  return (
    <>
      <RouteMetadata />
      <Suspense fallback={<LoadingPage />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<RequireUser />}>
            <Route path="/" element={<Navigate to="/items" replace />} />
            <Route path="/items" element={<ItemsPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/users" element={<RequireAdmin />}>
              <Route index element={<UsersPage />} />
            </Route>
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  );
}

function RouteMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const normalizedPath = pathname.replace(/\/+$/, "") || "/";
    const routeTitle = {
      "/": "Notebook",
      "/items": "Notebook",
      "/categories": "Collections",
      "/users": "People & access",
      "/settings": "Connections",
      "/login": "Sign in",
      "/register": "Create account",
    }[normalizedPath] || "Not found";
    document.title = `${routeTitle} · Listjj`;

    const focusHeading = () => {
      const heading = document.querySelector("[data-page-title]");
      if (!heading) return false;
      heading.focus({ preventScroll: true });
      window.scrollTo(0, 0);
      return true;
    };

    if (focusHeading()) return undefined;
    const observer = new MutationObserver(() => {
      if (focusHeading()) observer.disconnect();
    });
    observer.observe(document.getElementById("root") || document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);
  return null;
}

function RequireUser() {
  const { user, ready, logout } = useAuth();
  const location = useLocation();
  if (!ready) return <LoadingPage />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!user.role) {
    return (
      <main className="grid min-h-screen place-items-center px-5 py-10">
        <section className="w-full max-w-lg rounded-[2rem] border border-[#e0e5dc] bg-[#fffefa] p-7 shadow-[0_24px_80px_-48px_rgba(25,56,46,.4)] sm:p-10" aria-labelledby="approval-title">
          <div className="mb-7 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-[#d9ed9c] text-[#244b3d]"><NotebookPen size={20} aria-hidden="true" /></span>
            <span className="font-serif text-2xl tracking-tight text-[#20382d]">listjj</span>
          </div>
          <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-[#edf0e7] text-[#597161]"><BadgeCheck size={22} aria-hidden="true" /></span>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[.2em] text-[#58675d]">One small step left</p>
          <h1 id="approval-title" data-page-title tabIndex={-1} className="font-display text-4xl font-medium tracking-tight text-[#20382d]">Your space is waiting.</h1>
          <p className="mt-3 text-sm leading-6 text-[#58675d] [overflow-wrap:anywhere]">Signed in as <strong className="font-semibold text-[#344d3f]">{user.email}</strong>. An administrator will approve your account before your notebook is available.</p>
          <div className="mt-8 flex items-center justify-between gap-3 border-t border-[#e7e9e1] pt-5">
            <span className="font-mono text-[9px] uppercase tracking-[.16em] text-[#58675d]">Approval pending</span>
            <Button variant="ghost" onClick={logout} className="rounded-xl text-[#52665a]"><ArrowLeft size={15} aria-hidden="true" /> Sign out</Button>
          </div>
        </section>
      </main>
    );
  }
  return <AppShell><Outlet /></AppShell>;
}

function RequireAdmin() {
  const { user } = useAuth();
  return user?.role === "Admin" ? <Outlet /> : <Navigate to="/items" replace />;
}

function LoadingPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-5">
      <div className="w-full max-w-[440px] space-y-4" role="status" aria-label="Loading your workspace">
        <div className="h-3 w-24 animate-pulse rounded-full bg-[#dce3d7]" />
        <div className="h-12 w-3/4 animate-pulse rounded-xl bg-[#e6e9e1]" />
        <div className="h-4 w-1/2 animate-pulse rounded-full bg-[#e6e9e1]" />
        <div className="mt-9 h-32 animate-pulse rounded-2xl bg-white" />
      </div>
    </main>
  );
}

function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <div className="max-w-md text-center">
        <span className="font-mono text-[11px] uppercase tracking-[.22em] text-[#58675d]">Page not found · 404</span>
        <h1 data-page-title tabIndex={-1} className="font-display mt-4 text-5xl font-medium tracking-tight text-[#20382d]">A page out of place.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#58675d]">That address does not point to a note or collection in this workspace.</p>
        <Button asChild className="mt-7 rounded-xl"><NavLink to="/">Return to your notebook</NavLink></Button>
      </div>
    </main>
  );
}
