import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [adminBootstrapToken, setAdminBootstrapToken] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [doneMessage, setDoneMessage] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("Passwords do not match.");
    try {
      const result = await api.post("/auth/register", {
        email,
        password,
        adminBootstrapToken: adminBootstrapToken || undefined,
      });
      setDoneMessage(result.message);
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
  };

  if (done) {
    return (
      <div className="page narrow">
        <div className="card">
          <h2>Account created</h2>
          <p>{doneMessage}</p>
          <Link to="/login">Back to login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page narrow">
      <form className="card" onSubmit={submit}>
        <h2>Register</h2>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password (min. 6 characters)
          <input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <label>
          Repeat password
          <input type="password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </label>
        <label>
          Initial admin setup token (only for the configured admin email)
          <input
            type="password"
            autoComplete="off"
            value={adminBootstrapToken}
            onChange={(e) => setAdminBootstrapToken(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="submit">Create account</button>
          <Link to="/login" className="button ghost">
            Back
          </Link>
        </div>
      </form>
    </div>
  );
}
