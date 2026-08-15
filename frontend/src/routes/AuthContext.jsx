import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, login as apiLogin, logout as apiLogout, getMe, getOrganization } from "../api.js";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem("np_token"));
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("np_user") || "null");
    } catch {
      return null;
    }
  });
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(!!token);

  const hasPermission = useCallback(
    (permissionName) => {
      const perms = user?.permissions || [];
      if (user?.is_platform_admin) return true;
      return perms.includes(permissionName);
    },
    [user],
  );

  const login = async (formData) => {
    const res = await apiLogin(formData);
    const data = res.data;
    localStorage.setItem("np_token", data.access_token);
    localStorage.setItem("np_refresh_token", data.refresh_token);
    localStorage.setItem("np_user", JSON.stringify(data.user));
    localStorage.setItem("np_permissions", JSON.stringify(data.user?.permissions || []));
    setToken(data.access_token);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem("np_refresh_token");
    if (refreshToken) {
      try {
        await apiLogout(refreshToken);
      } catch {
        // ignore
      }
    }
    localStorage.removeItem("np_token");
    localStorage.removeItem("np_refresh_token");
    localStorage.removeItem("np_user");
    localStorage.removeItem("np_permissions");
    setToken(null);
    setUser(null);
    setOrg(null);
    window.location.href = "/";
  };

  useEffect(() => {
    if (!token) return;
    const fetchSession = async () => {
      try {
        const [meRes, orgRes] = await Promise.allSettled([getMe(), getOrganization()]);
        if (meRes.status === "fulfilled") {
          const me = meRes.value.data;
          setUser(me);
          localStorage.setItem("np_user", JSON.stringify(me));
          localStorage.setItem("np_permissions", JSON.stringify(me.permissions || []));
        }
        if (orgRes.status === "fulfilled") setOrg(orgRes.value.data);
      } catch {
        // interceptor handles 401 → redirect
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, user, org, setOrg, hasPermission, login, logout, loading }}>
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
