import { Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import PortScanner from "../pages/PortScanner";
import UserManagement from "../pages/UserManagement";
import Reports from "../pages/Reports";
import { useAuth } from "./AuthContext.jsx";

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/" replace />;
  return children;
}

function GuestRoute({ children }) {
  const { token } = useAuth();
  if (token) return <Navigate to="/dashboard" replace />;
  return children;
}

function PermissionRoute({ permission, children }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <GuestRoute>
            <Login />
          </GuestRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/scanner"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="port_scanning">
              <PortScanner />
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="create_users">
              <UserManagement />
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
