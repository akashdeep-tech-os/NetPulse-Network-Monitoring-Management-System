import axios from "axios";

export const api = axios.create({
  baseURL: "/api/v1",
});

const getToken = () => localStorage.getItem("np_token");
const getRefresh = () => localStorage.getItem("np_refresh_token");

const clearAuth = () => {
  localStorage.removeItem("np_token");
  localStorage.removeItem("np_refresh_token");
  localStorage.removeItem("np_user");
  localStorage.removeItem("np_permissions");
  if (!window.location.pathname.startsWith("/login")) {
    window.location.href = "/";
  }
};

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retried) {
      const refreshToken = getRefresh();
      if (refreshToken) {
        original._retried = true;
        if (!refreshing) {
          refreshing = axios
            .post("/api/v1/auth/refresh", { refresh_token: refreshToken })
            .then((res) => {
              localStorage.setItem("np_token", res.data.access_token);
              localStorage.setItem("np_refresh_token", res.data.refresh_token);
              return res.data.access_token;
            })
            .catch(() => {
              clearAuth();
              return null;
            })
            .finally(() => {
              refreshing = null;
            });
        }
        const newToken = await refreshing;
        if (newToken) {
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        }
      } else {
        clearAuth();
      }
    }
    return Promise.reject(error);
  },
);

// ─── Auth ─────────────────────────────────────────────────────
export const login = (formData) => api.post("/auth/login", formData);
export const refresh = (refreshToken) => api.post("/auth/refresh", { refresh_token: refreshToken });
export const logout = (refreshToken) => api.post("/auth/logout", { refresh_token: refreshToken });
export const getMe = () => api.get("/auth/me");
export const getSessions = () => api.get("/auth/sessions");
export const revokeSession = (id) => api.post(`/auth/sessions/${id}/revoke`);
export const revokeAllSessions = () => api.post("/auth/sessions/revoke-all");
export const changePassword = (data) => api.post("/auth/change-password", data);
export const requestPasswordReset = (email) => api.post("/auth/password-reset/request", { email });
export const confirmPasswordReset = (token, newPassword) =>
  api.post("/auth/password-reset/confirm", { token, new_password: newPassword });

// ─── Organizations ────────────────────────────────────────────
export const getOrganization = () => api.get("/organizations/me");
export const updateOrganization = (data) => api.patch("/organizations/me", data);
export const getOrgSubscription = () => api.get("/organizations/me/subscription");
export const getOrgUsage = () => api.get("/organizations/me/usage");
export const getOrgUsers = () => api.get("/organizations/me/users");
export const createOrgUser = (data) => api.post("/organizations/me/users", data);
export const updateOrgUser = (userId, data) => api.patch(`/organizations/me/users/${userId}`, data);
export const deleteOrgUser = (userId) => api.delete(`/organizations/me/users/${userId}`);
export const getRoles = () => api.get("/organizations/roles");

// legacy-compat aliases used by UserManagement
export const getUsers = getOrgUsers;
export const createUser = createOrgUser;
export const deleteUser = deleteOrgUser;
export const updateUserRole = (userId, roleId) => updateOrgUser(userId, { role_id: roleId });

// ─── Devices ──────────────────────────────────────────────────
export const getDevices = (params = {}) => api.get("/devices", { params });
export const getDevice = (id) => api.get(`/devices/${id}`);
export const createDevice = (data) => api.post("/devices", data);
export const updateDevice = (id, data) => api.patch(`/devices/${id}`, data);
export const deleteDevice = (id) => api.delete(`/devices/${id}`);
export const importDevices = (devices) => api.post("/devices/import", { devices });
export const exportDevices = async () => {
  const res = await getDevices();
  return { data: res.data };
};

// ─── Groups ───────────────────────────────────────────────────
export const getGroups = async () => {
  const res = await api.get("/devices/groups/list");
  return { data: res.data };
};
export const createGroup = (data) => api.post("/devices/groups", null, { params: data });
export const updateGroup = (id, data) => api.patch(`/devices/groups/${id}`, null, { params: data });
export const deleteGroup = (id) => api.delete(`/devices/groups/${id}`);
export const assignDevicesToGroup = async () => ({ data: [] });

// ─── Monitoring / Checks ──────────────────────────────────────
export const getChecks = () => api.get("/monitoring/checks");
export const getCheck = (id) => api.get(`/monitoring/checks/${id}`);
export const createCheck = (deviceId, data) => api.post(`/monitoring/checks?device_id=${deviceId}`, data);
export const deleteCheck = (id) => api.delete(`/monitoring/checks/${id}`);
export const runCheckNow = (id) => api.post(`/monitoring/checks/${id}/run-now`);
export const getCheckResults = (deviceId, hours = 24, limit = 500) =>
  api.get(`/monitoring/results?device_id=${deviceId}&hours=${hours}&limit=${limit}`);
export const getLatestStatus = (deviceId) => api.get(`/monitoring/devices/${deviceId}/latest`);
export const scanPorts = (data) => api.post("/monitoring/port-scan", data);

export const pingAllDevices = async () => {
  const res = await getChecks();
  const checks = res.data.filter((c) => c.enabled);
  await Promise.allSettled(checks.map((c) => runCheckNow(c.id)));
  return { data: checks.length };
};
export const pingGroupDevices = async (groupId) => {
  const devices = (await getDevices({ group_id: groupId })).data;
  const checks = (await getChecks()).data.filter((c) => c.enabled && devices.some((d) => d.id === c.device_id));
  await Promise.allSettled(checks.map((c) => runCheckNow(c.id)));
  return { data: checks.length };
};

// ─── Alerts ───────────────────────────────────────────────────
export const getAlertRules = () => api.get("/alerts/rules");
export const createAlertRule = (data) => api.post("/alerts/rules", data);
export const updateAlertRule = (id, data) => api.patch(`/alerts/rules/${id}`, data);
export const deleteAlertRule = (id) => api.delete(`/alerts/rules/${id}`);
export const toggleAlertRule = async (id) => {
  const rules = (await getAlertRules()).data;
  const rule = rules.find((r) => r.id === id);
  if (!rule) throw new Error("Rule not found");
  return updateAlertRule(id, { enabled: !rule.enabled });
};
export const getAlertLogs = (limit = 100, status = "") =>
  api.get(`/alerts/logs?limit=${limit}${status ? `&status=${status}` : ""}`);
export const acknowledgeAlertLog = (logId) => api.patch(`/alerts/logs/${logId}/acknowledge`);
export const resolveAlertLog = (logId) => api.patch(`/alerts/logs/${logId}/resolve`);
export const clearAlertLogs = () => api.delete("/alerts/logs");
export const getAlertConfig = () => api.get("/alerts/config");
export const updateAlertConfig = (data) => api.put("/alerts/config", data);
export const testAlertNotification = (data) => api.post("/alerts/rules/test", data);
export const getNotifications = () => api.get("/alerts/notifications");
export const markNotificationsRead = () => api.post("/alerts/notifications/read-all");
export const markNotificationRead = (id) => api.post(`/alerts/notifications/${id}/read`);

// ─── Analytics ────────────────────────────────────────────────
export const getAnalyticsKpis = () => api.get("/analytics/kpis");
export const getHealthScore = () => api.get("/analytics/health-score");
export const getAnalyticsCharts = (hours = 24) => api.get(`/analytics/charts?hours=${hours}`);
export const getDashboard = () => api.get("/analytics/dashboard");
export const getProblemDevices = (limit = 10) => api.get(`/analytics/problem-devices?limit=${limit}`);
export const getDowntime = (hours = 24) => api.get(`/analytics/downtime?hours=${hours}`);
export const getAnalyticsSettings = () => api.get("/analytics/settings");
export const updateAnalyticsSettings = (data) => api.put("/analytics/settings", data);

// ─── AI ───────────────────────────────────────────────────────
export const getAiDashboard = () => api.post("/ai/dashboard");
export const getAiInsights = (limit = 20) => api.post("/ai/insights", { limit });
export const aiChat = (message) => api.post("/ai/chat", { message });
export const getAiHistory = () => api.get("/ai/history");
export const getAiUsage = () => api.get("/ai/usage");
export const clearAiHistory = () => api.delete("/ai/history");

// ─── Reports ──────────────────────────────────────────────────
export const generateReport = (reportType, params = {}) =>
  api.get(`/reports/${reportType}`, { params, responseType: "blob" });

// ─── Billing ──────────────────────────────────────────────────
export const getPlans = () => api.get("/billing/plans");
export const getBillingSubscription = () => api.get("/billing/subscription");
export const subscribeToPlan = (planSlug, billingCycle = "monthly") =>
  api.post("/billing/subscribe", { plan_slug: planSlug, billing_cycle: billingCycle });
export const cancelSubscription = () => api.post("/billing/cancel");
export const getBillingUsage = () => api.get("/billing/usage");

// ─── API Keys ─────────────────────────────────────────────────
export const getApiKeys = () => api.get("/api-keys");
export const createApiKey = (data) => api.post("/api-keys", data);
export const revokeApiKey = (id) => api.patch(`/api-keys/${id}/revoke`);
export const deleteApiKey = (id) => api.delete(`/api-keys/${id}`);

// ─── Audit ────────────────────────────────────────────────────
export const getAuditLogs = (limit = 100, action = "") =>
  api.get(`/audit/logs?limit=${limit}${action ? `&action=${action}` : ""}`);

// ─── Platform Admin ───────────────────────────────────────────
export const getPlatformStats = () => api.get("/platform/stats");
export const getPlatformOrgs = () => api.get("/platform/organizations");
export const createPlatformOrg = (data) => api.post("/platform/organizations", null, { params: data });
export const setPlatformOrgStatus = (orgId, status) =>
  api.patch(`/platform/organizations/${orgId}/status`, null, { params: { status } });
export const getPlatformOrgUsers = (orgId) => api.get(`/platform/organizations/${orgId}/users`);
export const createPlatformOrgUser = (orgId, data) => api.post(`/platform/organizations/${orgId}/users`, data);
export const updatePlatformOrgUser = (orgId, userId, data) => api.patch(`/platform/organizations/${orgId}/users/${userId}`, data);
export const deletePlatformOrgUser = (orgId, userId) => api.delete(`/platform/organizations/${orgId}/users/${userId}`);
export const getPlatformPlans = () => api.get("/platform/plans");
export const createPlatformPlan = (data) => api.post("/platform/plans", data);
export const updatePlatformPlan = (planId, data) => api.patch(`/platform/plans/${planId}`, data);
export const getPlatformAuditLogs = (limit = 100) => api.get(`/platform/audit-logs?limit=${limit}`);
export const getPlatformApiKeys = () => api.get("/platform/api-keys");
export const getPlatformSettings = () => api.get("/platform/settings");
export const updatePlatformSettings = (data) => api.put("/platform/settings", data);

export default api;
