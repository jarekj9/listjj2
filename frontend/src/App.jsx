import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import ItemsPage from "./pages/ItemsPage.jsx";
import CategoriesPage from "./pages/CategoriesPage.jsx";
import UsersPage from "./pages/UsersPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";

export default function App() {
  return (
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
      <Route path="*" element={<p className="page">Page not found.</p>} />
    </Routes>
  );
}

function RequireUser() {
  const { user, ready, logout } = useAuth();
  const location = useLocation();
  if (!ready) return <p className="page muted">Loading...</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!user.role) {
    return (
      <div className="page narrow">
        <div className="card">
          <h2>Waiting for approval</h2>
          <p className="muted">Signed in as {user.email}. An administrator must approve your account first.</p>
          <button onClick={logout}>Log out</button>
        </div>
      </div>
    );
  }
  return <Layout />;
}

function RequireAdmin() {
  const { user } = useAuth();
  return user?.role === "Admin" ? <Outlet /> : <Navigate to="/items" replace />;
}

function Layout() {
  const { user, logout } = useAuth();
  const isAdmin = user.role === "Admin";
  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Listjj</span>
        <nav>
          <NavLink to="/items">Items</NavLink>
          <NavLink to="/categories">Categories</NavLink>
          {isAdmin && <NavLink to="/users">Users</NavLink>}
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <div className="spacer" />
        <span className="muted small">
          {user.email} {isAdmin && <span className="badge">admin</span>}
        </span>
        <button className="ghost" onClick={logout}>
          Log out
        </button>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
