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
  CheckCircle,
  FileSpreadsheet,
  FileUp,
  ArrowRightLeft,
  Shield,
  Crown,
  UserCheck,
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
  { id: "users", label: "User Management", icon: Users, color: "blue" },
  { id: "import-export", label: "Import / Export", icon: ArrowRightLeft, color: "emerald" },
  { id: "add-ip", label: "Add IP & Location", icon: MapPin, color: "violet" },
];

const tabColors = {
  blue: {
    active: "bg-blue-600 text-white shadow-lg shadow-blue-500/25",
    inactive: "text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10",
    icon: "text-blue-500",
  },
  emerald: {
    active: "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25",
    inactive: "text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10",
    icon: "text-emerald-500",
  },
  violet: {
    active: "bg-violet-600 text-white shadow-lg shadow-violet-500/25",
    inactive: "text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/10",
    icon: "text-violet-500",
  },
};

const Settings = () => {
  const [activeTab, setActiveTab] = useState("users");

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full gap-6 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <SettingsIcon size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Settings
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manage users, devices, and imports
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1.5 bg-gray-100/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const colors = tabColors[tab.color];
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex-1 justify-center ${
                  isActive
                    ? colors.active
                    : colors.inactive
                }`}
              >
                <Icon size={18} className={isActive ? "text-white" : colors.icon} />
                <span className="hidden md:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {activeTab === "users" && <UserManagementTab />}
          {activeTab === "import-export" && <ImportExportTab />}
          {activeTab === "add-ip" && <AddIPLocationTab />}
        </div>
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
        return { bg: "bg-rose-50 dark:bg-rose-900/20", text: "text-rose-600 dark:text-rose-400", icon: Crown };
      case "user":
        return { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-600 dark:text-blue-400", icon: UserCheck };
      default:
        return { bg: "bg-gray-50 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", icon: Shield };
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.role_name && u.role_name.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const adminCount = users.filter((u) => u.role_name === "admin").length;
  const userCount = users.filter((u) => u.role_name === "user").length;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Users", value: users.length, icon: Users, color: "from-blue-500 to-blue-600", shadow: "shadow-blue-500/20" },
          { label: "Admins", value: adminCount, icon: Crown, color: "from-rose-500 to-rose-600", shadow: "shadow-rose-500/20" },
          { label: "Regular Users", value: userCount, icon: UserCheck, color: "from-emerald-500 to-emerald-600", shadow: "shadow-emerald-500/20" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg ${stat.shadow}`}>
              <stat.icon size={20} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Create User Form */}
        {canCreateUsers && (
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <UserPlus size={16} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-800 dark:text-white">Create User</h2>
                  <p className="text-[11px] text-gray-400">Add a new team member</p>
                </div>
              </div>
            </div>
            <div className="p-5">
              {success && (
                <div className="flex items-center gap-2 mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-400 text-xs">
                  <CheckCircle size={14} />
                  User created successfully!
                </div>
              )}
              {error && (
                <div className="flex items-center gap-2 mb-4 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-400 text-xs">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {[
                  { label: "Username", type: "text", icon: User, field: "username", placeholder: "john_doe" },
                  { label: "Email", type: "email", icon: Mail, field: "email", placeholder: "john@company.com" },
                ].map(({ label, type, icon: Icon, field, placeholder }) => (
                  <div key={field}>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">{label}</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Icon size={14} className="text-gray-400" />
                      </div>
                      <input
                        type={type}
                        value={formData[field]}
                        onChange={(e) => {
                          if (field === "username") {
                            const val = e.target.value;
                            if (!/\s/.test(val)) setFormData({ ...formData, [field]: val });
                          } else {
                            setFormData({ ...formData, [field]: e.target.value });
                          }
                        }}
                        onKeyDown={(e) => { if (field === "username" && e.key === " ") e.preventDefault(); }}
                        placeholder={placeholder}
                        required
                        className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-800 dark:text-white placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock size={14} className="text-gray-400" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Min 6 characters"
                      required
                      className="w-full pl-9 pr-9 py-2.5 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-800 dark:text-white placeholder:text-gray-400"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition">
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Role</label>
                  <div className="relative">
                    <select
                      value={formData.role_id}
                      onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none transition text-gray-800 dark:text-white"
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
                <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2.5 rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">
                  {loading ? <><RefreshCw size={14} className="animate-spin" /> Creating...</> : <><UserPlus size={14} /> Create User</>}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Users List */}
        {canManageUsers && (
          <div className={`${canCreateUsers ? "lg:col-span-3" : "lg:col-span-5"} bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden`}>
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold text-gray-800 dark:text-white">All Users</h2>
                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full">{users.length}</span>
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
                  className="pl-9 pr-3 py-2 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-full sm:w-56 placeholder:text-gray-400 text-gray-800 dark:text-white"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-slate-700/30">
                    <th className="text-left py-3 px-5 font-semibold text-gray-400 dark:text-gray-500 text-[10px] uppercase tracking-wider">User</th>
                    <th className="text-left py-3 px-5 font-semibold text-gray-400 dark:text-gray-500 text-[10px] uppercase tracking-wider">Email</th>
                    <th className="text-left py-3 px-5 font-semibold text-gray-400 dark:text-gray-500 text-[10px] uppercase tracking-wider">Role</th>
                    <th className="text-right py-3 px-5 font-semibold text-gray-400 dark:text-gray-500 text-[10px] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr><td colSpan="4" className="py-16 text-center"><Users size={32} className="mx-auto mb-3 text-gray-200 dark:text-gray-700" /><p className="text-sm text-gray-400">No users found</p></td></tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const roleBadge = getRoleBadge(user.role_name);
                      const RoleIcon = roleBadge.icon;
                      return (
                        <tr key={user.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 ${user.role_name === "admin" ? "bg-gradient-to-br from-rose-500 to-rose-600" : "bg-gradient-to-br from-blue-500 to-blue-600"}`}>
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-800 dark:text-white text-[13px]">{user.username}</p>
                                <p className="text-[10px] text-gray-400 font-mono">ID: {user.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-gray-500 dark:text-gray-400 text-[13px]">{user.email}</td>
                          <td className="py-3.5 px-5">
                            {editingUser === user.id ? (
                              <div className="flex items-center gap-1.5">
                                <select value={editRoleId} onChange={(e) => setEditRoleId(e.target.value)} className="px-2.5 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white">
                                  {roles.map((role) => (<option key={role.id} value={role.id}>{role.name.charAt(0).toUpperCase() + role.name.slice(1)}</option>))}
                                </select>
                                <button onClick={() => handleRoleChange(user.id, editRoleId)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Save"><Check size={14} /></button>
                                <button onClick={() => setEditingUser(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg transition" title="Cancel"><X size={14} /></button>
                              </div>
                            ) : (
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg ${roleBadge.bg} ${roleBadge.text}`}>
                                <RoleIcon size={12} />
                                {user.role_name || "No Role"}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-5">
                            <div className="flex items-center justify-end gap-0.5">
                              {user.id !== currentUser?.id && (
                                <>
                                  <button onClick={() => { setEditingUser(user.id); setEditRoleId(user.role_id || ""); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition" title="Edit Role"><Edit2 size={14} /></button>
                                  <button onClick={() => setDeleteConfirm(user.id)} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition" title="Delete User"><Trash2 size={14} /></button>
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
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-gray-100 dark:border-slate-700">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-4">
                <AlertCircle size={28} className="text-rose-600 dark:text-rose-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">Delete User</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">This action cannot be undone.</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-xl font-semibold text-sm transition">Cancel</button>
                <button onClick={() => handleDeleteUser(deleteConfirm)} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 text-white hover:from-rose-700 hover:to-rose-800 rounded-xl font-semibold text-sm transition shadow-lg shadow-rose-500/20">Delete</button>
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* Import */}
      {hasPermission("import_devices") && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-5 bg-gradient-to-r from-emerald-50 to-transparent dark:from-emerald-900/10 border-b border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <FileUp size={20} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800 dark:text-white">Import Devices</h3>
                <p className="text-xs text-gray-400">Upload from CSV or Excel file</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-2xl cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/5 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FileSpreadsheet size={22} className="text-emerald-500" />
              </div>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Click to upload</span>
              <span className="text-[11px] text-gray-400 mt-1">.csv, .xlsx, .xls supported</span>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleImport} className="hidden" />
            </label>
            {importResult && (
              <div className={`mt-4 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2 ${importResult.success ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800" : "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800"}`}>
                {importResult.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                {importResult.message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export */}
      {hasPermission("export_devices") && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-5 bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/10 border-b border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Download size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800 dark:text-white">Export Devices</h3>
                <p className="text-xs text-gray-400">Download as Excel spreadsheet</p>
              </div>
            </div>
          </div>
          <div className="p-6 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
              <FileSpreadsheet size={28} className="text-blue-500" />
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{devices.length} devices available</p>
            <p className="text-xs text-gray-400 mb-5">All device data will be exported</p>
            <button onClick={handleExport} className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20">
              <Download size={16} /> Export to Excel
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

  const onlineCount = devices.filter((d) => d.status === "Online").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <RefreshCw size={28} className="animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total IPs", value: devices.length, color: "from-violet-500 to-violet-600" },
          { label: "Online", value: onlineCount, color: "from-emerald-500 to-emerald-600" },
          { label: "Offline", value: devices.length - onlineCount, color: "from-rose-500 to-rose-600" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 text-center">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-800 dark:text-white">IP & Location List</h2>
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
                className="pl-9 pr-3 py-2 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none w-full sm:w-48 placeholder:text-gray-400 text-gray-800 dark:text-white"
              />
            </div>
            {canManage && (
              <button
                onClick={() => { setEditingDevice(null); setFormData({ name: "", ip_address: "" }); setShowModal(true); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-violet-500/20"
              >
                <Plus size={16} /> Add IP
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-slate-700/30">
                <th className="text-left py-3 px-5 font-semibold text-gray-400 dark:text-gray-500 text-[10px] uppercase tracking-wider">#</th>
                <th className="text-left py-3 px-5 font-semibold text-gray-400 dark:text-gray-500 text-[10px] uppercase tracking-wider">Location</th>
                <th className="text-left py-3 px-5 font-semibold text-gray-400 dark:text-gray-500 text-[10px] uppercase tracking-wider">IP Address</th>
                <th className="text-left py-3 px-5 font-semibold text-gray-400 dark:text-gray-500 text-[10px] uppercase tracking-wider">Status</th>
                {canManage && (
                  <th className="text-right py-3 px-5 font-semibold text-gray-400 dark:text-gray-500 text-[10px] uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={canManage ? 5 : 4} className="py-16 text-center"><MapPin size={32} className="mx-auto mb-3 text-gray-200 dark:text-gray-700" /><p className="text-sm text-gray-400">No devices found</p></td></tr>
              ) : (
                filtered.map((device, idx) => (
                  <tr key={device.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="py-3.5 px-5 text-gray-400 text-xs font-medium">{idx + 1}</td>
                    <td className="py-3.5 px-5 font-semibold text-gray-800 dark:text-white text-[13px]">{device.name}</td>
                    <td className="py-3.5 px-5 text-gray-600 dark:text-gray-300 font-mono text-xs">{device.ip_address}</td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${device.status === "Online" ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" : "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${device.status === "Online" ? "bg-emerald-500" : "bg-rose-500"}`} />
                        {device.status}
                      </span>
                    </td>
                    {canManage && (
                      <td className="py-3.5 px-5">
                        <div className="flex items-center justify-end gap-0.5">
                          <button onClick={() => { setEditingDevice(device); setFormData({ name: device.name, ip_address: device.ip_address }); setShowModal(true); }} className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition" title="Edit"><Edit2 size={14} /></button>
                          <button onClick={() => setDeleteConfirm(device.id)} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition" title="Delete"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 dark:border-slate-700">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-800 dark:text-white">{editingDevice ? "Edit IP & Location" : "Add IP & Location"}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Location Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Main Gate Camera"
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none text-gray-800 dark:text-white placeholder:text-gray-400"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">IP Address</label>
                <input
                  type="text"
                  value={formData.ip_address}
                  onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                  placeholder="e.g., 192.168.1.100"
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none text-gray-800 dark:text-white placeholder:text-gray-400 font-mono"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700 flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-xl font-semibold transition">Cancel</button>
              <button onClick={handleAdd} disabled={!formData.ip_address.trim()} className="flex-1 px-4 py-2.5 text-sm bg-gradient-to-r from-violet-600 to-violet-700 text-white hover:from-violet-700 hover:to-violet-800 rounded-xl font-semibold transition disabled:opacity-50 shadow-lg shadow-violet-500/20">{editingDevice ? "Save" : "Add"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-gray-100 dark:border-slate-700">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-rose-600 dark:text-rose-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">Delete Device</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-xl font-semibold text-sm transition">Cancel</button>
                <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 text-white hover:from-rose-700 hover:to-rose-800 rounded-xl font-semibold text-sm transition shadow-lg shadow-rose-500/20">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
