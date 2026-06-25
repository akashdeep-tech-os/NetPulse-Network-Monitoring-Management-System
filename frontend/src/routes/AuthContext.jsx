import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "../api.js";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [isAdmin, setIsAdmin] = useState(() => {
    const saved = localStorage.getItem("is_admin");
    return saved === "true";
  });
  const [permissions, setPermissions] = useState(() => {
    const saved = localStorage.getItem("permissions");
    return saved ? JSON.parse(saved) : [];
  });
  const [user, setUser] = useState(null);

  const hasPermission = useCallback(
    (permissionName) => {
      if (isAdmin) return true;
      return permissions.includes(permissionName);
    },
    [isAdmin, permissions]
  );

  const login = (newToken, newPermissions, newIsAdmin) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("permissions", JSON.stringify(newPermissions));
    localStorage.setItem("is_admin", String(newIsAdmin));
    setToken(newToken);
    setPermissions(newPermissions);
    setIsAdmin(newIsAdmin);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("permissions");
    localStorage.removeItem("is_admin");
    setToken(null);
    setPermissions([]);
    setIsAdmin(false);
    window.location.href = "/";
  };

  useEffect(() => {
    if (!token) return;

    const fetchUser = async () => {
      try {
        const res = await api.get("/auth/me");
        setIsAdmin(res.data.is_admin);
        setPermissions(res.data.permissions || []);
        setUser(res.data);
        localStorage.setItem("is_admin", String(res.data.is_admin));
        localStorage.setItem("permissions", JSON.stringify(res.data.permissions || []));
      } catch {
        setIsAdmin(false);
        setPermissions([]);
        setUser(null);
      }
    };

    fetchUser();
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, isAdmin, permissions, user, hasPermission, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
