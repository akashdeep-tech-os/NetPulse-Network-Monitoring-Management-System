import { Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import PortScanner from "../pages/PortScanner";
import Reports from "../pages/Reports";
import DeviceGroups from "../pages/DeviceGroups";
import AlertSettings from "../pages/AlertSettings";
import AlertHistory from "../pages/AlertHistory";
import Settings from "../pages/Settings";
import AiAssistant from "../pages/AiAssistant";
import ApiKeys from "../pages/ApiKeys";
import Billing from "../pages/Billing";
import AuditLogs from "../pages/AuditLogs";
import PlatformAdmin from "../pages/PlatformAdmin";
import UserManagement from "../pages/UserManagement";
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

function PlatformRoute({ children }) {
  const { user } = useAuth();
  if (!user?.is_platform_admin) return <Navigate to="/dashboard" replace />;
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
        path="/ai"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="ai.view">
              <AiAssistant />
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/scanner"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="checks.manage">
              <PortScanner />
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="users.view">
              <UserManagement />
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="reports.view">
              <Reports />
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/groups"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="devices.view">
              <DeviceGroups />
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/alerts"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="alerts.view">
              <AlertSettings />
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/alert-history"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="alerts.view">
              <AlertHistory />
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/api-keys"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="api_keys.manage">
              <ApiKeys />
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/billing"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="billing.view">
              <Billing />
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/audit"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="audit.view">
              <AuditLogs />
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/platform"
        element={
          <ProtectedRoute>
            <PlatformRoute>
              <PlatformAdmin />
            </PlatformRoute>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}