import axios from "axios";

export const api = axios.create({
  baseURL: "http://localhost:8000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("permissions");
      localStorage.removeItem("is_admin");
      window.location.href = "/";
    }
    return Promise.reject(error);
  },
);

export const login = (data) => api.post("/auth/login", data);

export const getDevices = () => api.get("/devices");
export const createDevice = (data) => api.post("/devices", data);
export const updateDevice = (id, data) => api.put(`/devices/${id}`, data);
export const deleteDevice = (id) => api.delete(`/devices/${id}`);
export const bulkDeleteDevices = (ids) => api.post("/devices/bulk-delete", ids);
export const pingAllDevices = () => api.post("/devices/ping-all");
export const importDevices = (devices) => api.post("/devices/import", { devices });
export const exportDevices = () => api.get("/devices/export");
export const scanPorts = (data) => api.post("/scan", data);

export const createUser = (data) => api.post("/auth/create-user", data);
export const getUsers = () => api.get("/auth/users");
export const updateUserRole = (userId, roleId) => api.put(`/auth/users/${userId}/role`, { role_id: roleId });
export const deleteUser = (userId) => api.delete(`/auth/users/${userId}`);
export const getRoles = () => api.get("/auth/roles");
export const getPermissions = () => api.get("/auth/permissions");

export const getReportsOverview = () => api.get("/reports/overview");
export const getDeviceHistory = (id, hours = 24) => api.get(`/reports/device/${id}/history?hours=${hours}`);
export const getDowntimeLog = (hours = 24) => api.get(`/reports/downtime?hours=${hours}`);
export const getAllDevicesReport = (hours = 24) => api.get(`/reports/all-devices?hours=${hours}`);

export default api;
