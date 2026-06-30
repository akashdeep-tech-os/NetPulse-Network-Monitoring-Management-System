import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  Settings as SettingsIcon,
  Users,
  Upload,
  Download,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  UserPlus,
  Lock,
  User,
  Mail,
  ChevronDown,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  MapPin,
  Wifi,
  CheckCircle,
} from "lucide-react";
import DashboardLayout from "../layout/DashboardLayout";
import {
  createUser,
  getUsers,
  updateUserRole,
  deleteUser,
  getRoles,
  getDevices,
  createDevice,
  importDevices,
  exportDevices,
  updateDevice,
  deleteDevice,
} from "../api.js";
import { useAuth } from "../routes/AuthContext.jsx";

const TABS = [
  { id: "users", label: "User Management", icon: Users },
  { id: "import-export", label: "Import / Export", icon: Upload },
  { id: "add-ip", label: "Add IP & Location", icon: MapPin },
];

const Settings = () => {
  const { hasPermission, user: currentUser } = useAuth();
  const canManageUsers = hasPermission("manage_users");
  const canCreateUsers = hasPermission("create_users");

  const [activeTab, setActiveTab] = useState("users");

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full gap-4 md:gap-5 overflow-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg">
            <SettingsIcon size={20} className="text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              Settings
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Manage users, import/export devices, and add IPs
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-lg">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition flex-1 justify-center ${
                  activeTab === tab.id
                    ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === "users" && <UserManagementTab />}
        {activeTab === "import-export" && <ImportExportTab />}
        {activeTab === "add-ip" && <AddIPLocationTab />}
      </div>
    </DashboardLayout>
  );
};

const UserManagementTab = () => {
  const { hasPermission, user: currentUser } = useAuth();
  const canManageUsers = hasPermission("manage_users");
  const canCreateUsers = hasPermission("create_users");

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role_id: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [editRoleId, setEditRoleId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const refetchUsers = async () => {
    if (!canManageUsers) return;
    try {
      const res = await getUsers();
      setUsers(res.data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const rolesRes = await getRoles();
        setRoles(rolesRes.data);
      } catch (err) {
        console.error("Failed to fetch roles:", err);
      }
      if (canManageUsers) {
        try {
          const usersRes = await getUsers();
          setUsers(usersRes.data);
        } catch (err) {
          console.error("Failed to fetch users:", err);
        }
      }
    };
    loadData();
  }, [canManageUsers]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setError("");

    if (/\s/.test(formData.username)) {
      setError("Username cannot contain spaces");
      setLoading(false);
      return;
    }

    try {
      const payload = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
      };
      if (formData.role_id) {
        payload.role_id = parseInt(formData.role_id);
      }
      await createUser(payload);
      setSuccess(true);
      setFormData({ username: "", email: "", password: "", role_id: "" });
      setShowPassword(false);
      if (canManageUsers) refetchUsers();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRoleId) => {
    try {
      await updateUserRole(userId, parseInt(newRoleId));
      setEditingUser(null);
      refetchUsers();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update role");
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await deleteUser(userId);
      setDeleteConfirm(null);
      refetchUsers();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete user");
    }
  };

  const getRoleBadge = (roleName) => {
    switch (roleName) {
      case "admin":
        return { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" };
      case "user":
        return { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" };
      default:
        return { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200", dot: "bg-gray-500" };
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.role_name && u.role_name.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
      {/* Create User Form */}
      {canCreateUsers && (
        <div className="lg:col-span-1 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="px-4 md:px-5 py-3 md:py-4 border-b border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded-lg">
                <UserPlus size={14} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-800 dark:text-white">Create User</h2>
                <p className="text-[10px] md:text-[11px] text-gray-400">Add a new user to the system</p>
              </div>
            </div>
          </div>
          <div className="p-4 md:p-5">
            {success && (
              <div className="flex items-center gap-2 mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-xs md:text-sm">
                <CheckCircle size={16} />
                User created successfully!
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-xs md:text-sm">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Username</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User size={14} className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => { const val = e.target.value; if (!/\s/.test(val)) setFormData({ ...formData, username: val }); }}
                    onKeyDown={(e) => { if (e.key === " ") e.preventDefault(); }}
                    placeholder="Enter username"
                    required
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder:text-gray-300"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail size={14} className="text-gray-400" />
                  </div>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Enter email"
                    required
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder:text-gray-300"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock size={14} className="text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter password"
                    required
                    className="w-full pl-8 pr-9 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder:text-gray-300"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Role</label>
                <div className="relative">
                  <select
                    value={formData.role_id}
                    onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none transition bg-white dark:bg-slate-700 text-gray-800 dark:text-white"
                  >
                    <option value="">Select role (default: user)</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>{role.name.charAt(0).toUpperCase() + role.name.slice(1)} - {role.description}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <ChevronDown size={14} className="text-gray-400" />
                  </div>
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <><RefreshCw size={14} className="animate-spin" /> Creating...</> : <><UserPlus size={14} /> Create User</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Users List */}
      {canManageUsers && (
        <div className={`${canCreateUsers ? "lg:col-span-2" : "lg:col-span-3"} bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden`}>
          <div className="px-4 md:px-5 py-3 md:py-4 border-b border-gray-100 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded-lg">
                  <Users size={14} className="text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-sm font-semibold text-gray-800 dark:text-white">All Users</h2>
                <span className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{users.length}</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={14} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-full sm:w-64 placeholder:text-gray-300 bg-white dark:bg-slate-700 text-gray-800 dark:text-white"
                />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-slate-700/50">
                  <th className="text-left py-3 px-5 font-semibold text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wider">User</th>
                  <th className="text-left py-3 px-5 font-semibold text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wider">Email</th>
                  <th className="text-left py-3 px-5 font-semibold text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wider">Role</th>
                  <th className="text-right py-3 px-5 font-semibold text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr><td colSpan="4" className="py-16 text-center"><Users size={28} className="mx-auto mb-2 text-gray-300" /><p className="text-sm text-gray-500">No users found</p></td></tr>
                ) : (
                  filteredUsers.map((user) => {
                    const roleBadge = getRoleBadge(user.role_name);
                    return (
                      <tr key={user.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50/50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0 ${user.role_name === "admin" ? "bg-gradient-to-br from-red-500 to-red-600" : "bg-gradient-to-br from-blue-500 to-blue-600"}`}>
                              {user.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800 dark:text-white text-[13px]">{user.username}</p>
                              <p className="text-[10px] text-gray-400 font-mono">ID: {user.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-5 text-gray-500 dark:text-gray-400 text-[13px]">{user.email}</td>
                        <td className="py-3 px-5">
                          {editingUser === user.id ? (
                            <div className="flex items-center gap-1.5">
                              <select value={editRoleId} onChange={(e) => setEditRoleId(e.target.value)} className="px-2.5 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white">
                                {roles.map((role) => (<option key={role.id} value={role.id}>{role.name.charAt(0).toUpperCase() + role.name.slice(1)}</option>))}
                              </select>
                              <button onClick={() => handleRoleChange(user.id, editRoleId)} className="p-1 text-green-600 hover:bg-green-50 rounded-md transition" title="Save"><Check size={14} /></button>
                              <button onClick={() => setEditingUser(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded-md transition" title="Cancel"><X size={14} /></button>
                            </div>
                          ) : (
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-full border ${roleBadge.bg} ${roleBadge.text} ${roleBadge.border}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${roleBadge.dot}`} />
                              {user.role_name || "No Role"}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-5">
                          <div className="flex items-center justify-end gap-0.5">
                            {user.id !== currentUser?.id && (
                              <>
                                <button onClick={() => { setEditingUser(user.id); setEditRoleId(user.role_id || ""); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition" title="Edit Role"><Edit2 size={14} /></button>
                                <button onClick={() => setDeleteConfirm(user.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition" title="Delete User"><Trash2 size={14} /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex flex-col items-center text-center">
              <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full mb-4">
                <AlertCircle size={28} className="text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">Delete User</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">This action cannot be undone.</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg font-medium text-sm transition">Cancel</button>
                <button onClick={() => handleDeleteUser(deleteConfirm)} className="flex-1 px-4 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium text-sm transition">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ImportExportTab = () => {
  const { hasPermission } = useAuth();
  const [devices, setDevices] = useState([]);
  const [importResult, setImportResult] = useState(null);

  const fetchDevices = async () => {
    try {
      const res = await getDevices();
      setDevices(res.data);
    } catch (err) {
      console.error("Failed to fetch devices:", err);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const parseIP = (raw) => {
    if (!raw) return null;
    let ip = String(raw).trim();
    ip = ip.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!ip || ip.toUpperCase() === "WFL") return null;
    if (!ip.includes(".") || ip.length > 25) return null;
    return ip;
  };

  const mapRow = (row) => {
    const keys = Object.keys(row);
    const rawIP = row["ip address"] || row["Static IP"] || row["IP"] || row["ip"] || row["Ip"];
    if (rawIP) {
      const ip = parseIP(rawIP);
      if (!ip) return null;
      const name = row["Location"] || row["Camera Location"] || row["Name"] || row["name"] || ip;
      return { name, ip_address: ip };
    }
    if (keys.length >= 2) {
      const nameVal = String(row[keys[0]] || "").trim();
      const ipVal = parseIP(row[keys[1]]);
      if (ipVal && nameVal) return { name: nameVal, ip_address: ipVal };
      if (ipVal) return { name: ipVal, ip_address: ipVal };
    }
    return null;
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    let imported = [];
    try {
      if (ext === "csv") {
        Papa.parse(file, {
          header: true,
          complete: async (results) => {
            try {
              imported = results.data.map(mapRow).filter(Boolean);
              if (imported.length) {
                const res = await importDevices(imported);
                const added = res.data.length;
                const skipped = imported.length - added;
                setImportResult({ success: true, message: `${added} device(s) imported successfully${skipped > 0 ? `, ${skipped} duplicate(s) skipped` : ""}` });
                fetchDevices();
              } else {
                setImportResult({ success: false, message: "No valid devices found in file" });
              }
            } catch (err) {
              setImportResult({ success: false, message: err.response?.data?.detail || "Failed to import CSV data" });
            }
          },
          error: () => setImportResult({ success: false, message: "Failed to parse CSV file" }),
        });
      } else if (ext === "xlsx" || ext === "xls") {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const data = new Uint8Array(evt.target.result);
            const wb = XLSX.read(data, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws);
            imported = rows.map(mapRow).filter(Boolean);
            if (imported.length) {
              const res = await importDevices(imported);
              const added = res.data.length;
              const skipped = imported.length - added;
              setImportResult({ success: true, message: `${added} device(s) imported successfully${skipped > 0 ? `, ${skipped} duplicate(s) skipped` : ""}` });
              fetchDevices();
            } else {
              setImportResult({ success: false, message: "No valid devices found in file" });
            }
          } catch (err) {
            setImportResult({ success: false, message: "Failed to parse Excel file: " + err.message });
          }
        };
        reader.readAsArrayBuffer(file);
      }
    } catch {
      setImportResult({ success: false, message: "Failed to import devices" });
    }
    e.target.value = "";
    setTimeout(() => setImportResult(null), 5000);
  };

  const handleExport = async () => {
    try {
      const res = await exportDevices();
      const ws = XLSX.utils.json_to_sheet(res.data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Devices");
      XLSX.writeFile(wb, "devices.xlsx");
    } catch {
      alert("Failed to export devices");
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Import */}
      {hasPermission("import_devices") && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
              <Upload size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Import Devices</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Upload CSV or Excel file</p>
            </div>
          </div>
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
            <Upload size={24} className="text-gray-400 mb-2" />
            <span className="text-sm text-gray-500 dark:text-gray-400">Click to upload CSV or Excel</span>
            <span className="text-[10px] text-gray-400 mt-1">.csv, .xlsx, .xls</span>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleImport} className="hidden" />
          </label>
          {importResult && (
            <div className={`mt-3 px-3 py-2 rounded-lg text-xs ${importResult.success ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"}`}>
              {importResult.message}
            </div>
          )}
        </div>
      )}

      {/* Export */}
      {hasPermission("export_devices") && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
              <Download size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Export Devices</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Download device list as Excel</p>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg">
            <Download size={24} className="text-gray-400 mb-2" />
            <span className="text-sm text-gray-500 dark:text-gray-400 mb-3">{devices.length} devices available</span>
            <button onClick={handleExport} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition">
              <Download size={14} /> Export to Excel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const AddIPLocationTab = () => {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("create_devices") || hasPermission("manage_users");

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formData, setFormData] = useState({ name: "", ip_address: "" });
  const [searchQuery, setSearchQuery] = useState("");

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const res = await getDevices();
      setDevices(res.data);
    } catch (err) {
      console.error("Failed to fetch devices:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleAdd = async () => {
    if (!formData.ip_address.trim()) return;
    try {
      if (editingDevice) {
        await updateDevice(editingDevice.id, formData);
      } else {
        await createDevice(formData);
      }
      setShowModal(false);
      setEditingDevice(null);
      setFormData({ name: "", ip_address: "" });
      fetchDevices();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to save device");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDevice(id);
      setDeleteConfirm(null);
      fetchDevices();
    } catch (err) {
      alert("Failed to delete device");
    }
  };

  const filtered = devices.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.ip_address.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <RefreshCw size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
      <div className="px-4 md:px-5 py-3 md:py-4 border-b border-gray-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-100 dark:bg-indigo-900/30 p-1.5 rounded-lg">
            <MapPin size={14} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white">Add IP & Location</h2>
          <span className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{devices.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={14} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search IPs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-full sm:w-48 bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder:text-gray-400"
            />
          </div>
          {canManage && (
            <button
              onClick={() => { setEditingDevice(null); setFormData({ name: "", ip_address: "" }); setShowModal(true); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition"
            >
              <Plus size={15} /> Add IP
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80 dark:bg-slate-700/50">
              <th className="text-left py-3 px-5 font-semibold text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wider">#</th>
              <th className="text-left py-3 px-5 font-semibold text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wider">Location Name</th>
              <th className="text-left py-3 px-5 font-semibold text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wider">IP Address</th>
              <th className="text-left py-3 px-5 font-semibold text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wider">Status</th>
              {canManage && (
                <th className="text-right py-3 px-5 font-semibold text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wider">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={canManage ? 5 : 4} className="py-16 text-center"><MapPin size={28} className="mx-auto mb-2 text-gray-300" /><p className="text-sm text-gray-500">No devices found</p></td></tr>
            ) : (
              filtered.map((device, idx) => (
                <tr key={device.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50/50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="py-3 px-5 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="py-3 px-5 font-medium text-gray-800 dark:text-white text-[13px]">{device.name}</td>
                  <td className="py-3 px-5 text-gray-600 dark:text-gray-300 font-mono text-xs">{device.ip_address}</td>
                  <td className="py-3 px-5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${device.status === "Online" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                      {device.status}
                    </span>
                  </td>
                  {canManage && (
                    <td className="py-3 px-5">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => { setEditingDevice(device); setFormData({ name: device.name, ip_address: device.ip_address }); setShowModal(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition" title="Edit"><Edit2 size={14} /></button>
                        <button onClick={() => setDeleteConfirm(device.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition" title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white">{editingDevice ? "Edit IP & Location" : "Add IP & Location"}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Location Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Main Gate Camera"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder:text-gray-400"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">IP Address</label>
                <input
                  type="text"
                  value={formData.ip_address}
                  onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                  placeholder="e.g., 192.168.1.100"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder:text-gray-400 font-mono"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700 flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg font-medium transition">Cancel</button>
              <button onClick={handleAdd} disabled={!formData.ip_address.trim()} className="flex-1 px-4 py-2.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition disabled:opacity-50">{editingDevice ? "Save" : "Add"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center">
              <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full inline-block mb-4">
                <Trash2 size={24} className="text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">Delete Device</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg font-medium text-sm transition">Cancel</button>
                <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 px-4 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium text-sm transition">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
