import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, tokenStore } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setReady(true);
      return;
    }
    try {
      setUser(await api.get("/auth/me"));
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loginWith = async (credentials) => {
    const { token } = await api.post("/auth/login", credentials);
    tokenStore.set(token);
    await refresh();
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, ready, loginWith, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
