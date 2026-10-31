import { useEffect, useState } from "react";
import { api } from "../api.js";

const blankNew = { email: "", password: "", role: "User" };

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [draft, setDraft] = useState(blankNew);
  const [edits, setEdits] = useState({});
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const load = () => api.get("/users").then(setUsers).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    api.get("/roles").then(setRoles).catch(() => {});
  }, []);

  const attempt = async (fn, okText) => {
    try {
      await fn();
      setError("");
      setInfo(okText);
      load();
    } catch (err) {
      setInfo("");
      setError(err.message);
    }
  };

  const edit = (u, patch) => setEdits((prev) => ({ ...prev, [u.id]: { ...(prev[u.id] || {}), ...patch } }));

  const saveRow = (u) => {
    const e = edits[u.id] || {};
    return attempt(
      () =>
        api.post("/users", {
          id: u.id,
          email: e.email !== undefined ? e.email : u.email,
          role: e.role !== undefined ? e.role || null : u.role,
          password: e.password || null,
        }),
        `Saved ${e.email !== undefined ? e.email : u.email}`
    ).then(() => setEdits((prev) => ({ ...prev, [u.id]: {} })));
  };

  const remove = (u) => {
    if (window.confirm(`Delete user ${u.email} and all their data?`)) {
      attempt(() => api.del(`/users/${u.id}`), `Deleted ${u.email}`);
    }
  };

  const create = (e) => {
    e.preventDefault();
    attempt(
      () => api.post("/users", { email: draft.email, password: draft.password, role: draft.role || null }),
      `Created ${draft.email}`
    ).then(() => setDraft(blankNew));
  };

  return (
    <div className="page">
      <h2>Users</h2>
      <form className="card row wrap" onSubmit={create}>
        <input type="email" placeholder="Email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} required />
        <input type="password" placeholder="Password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} required />
        <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
          <option value="">Pending</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button type="submit">Add user</button>
      </form>
      {error && <p className="error">{error}</p>}
      {info && <p className="flash">{info}</p>}

      <table className="table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>New password</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const e = edits[u.id] || {};
            return (
              <tr key={u.id} className={u.role ? "" : "pending"}>
                <td>
                  <input
                    type="email"
                    aria-label={`Email for ${u.email}`}
                    value={e.email !== undefined ? e.email : u.email}
                    onChange={(ev) => edit(u, { email: ev.target.value })}
                  />
                </td>
                <td>
                  <select value={e.role !== undefined ? e.role : u.role || ""} onChange={(ev) => edit(u, { role: ev.target.value })}>
                    <option value="">Pending</option>
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input type="password" placeholder="unchanged" value={e.password || ""} onChange={(ev) => edit(u, { password: ev.target.value })} />
                </td>
                <td className="actions">
                  <button onClick={() => saveRow(u)}>Save</button>
                  <button className="icon danger" title="Delete" onClick={() => remove(u)}>
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
