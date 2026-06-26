import { useState, useEffect } from "react";
import {
  UserPlus,
  Lock,
  User,
  Mail,
  CheckCircle,
  Users,
  Trash2,
  Edit2,
  X,
  Shield,
  Search,
  ChevronDown,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Settings,
} from "lucide-react";
import {
  createUser,
  getUsers,
  updateUserRole,
  deleteUser,
  getRoles,
} from "../api.js";
import DashboardLayout from "../layout/DashboardLayout";
import { useAuth } from "../routes/AuthContext.jsx";

const UserManagement = () => {
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
        return {
          bg: "bg-red-50",
          text: "text-red-700",
          border: "border-red-200",
          dot: "bg-red-500",
        };
      case "user":
        return {
          bg: "bg-blue-50",
          text: "text-blue-700",
          border: "border-blue-200",
          dot: "bg-blue-500",
        };
      default:
        return {
          bg: "bg-gray-50",
          text: "text-gray-700",
          border: "border-gray-200",
          dot: "bg-gray-500",
        };
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.role_name &&
        u.role_name.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const adminCount = users.filter((u) => u.role_name === "admin").length;
  const userCount = users.filter((u) => u.role_name === "user").length;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full gap-4 md:gap-5 overflow-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="bg-purple-100 p-2 rounded-lg">
            <Settings size={20} className="text-purple-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              User Management
            </h1>
            <p className="text-xs text-gray-500">
              Manage users, roles and permissions
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 md:p-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-xl shrink-0">
                <Users size={18} className="text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] md:text-xs font-medium text-gray-400 uppercase">
                  Total
                </p>
                <p className="text-lg md:text-xl font-bold text-gray-800 tabular-nums">
                  {users.length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 md:p-4">
            <div className="flex items-center gap-3">
              <div className="bg-red-100 p-2 rounded-xl shrink-0">
                <Shield size={18} className="text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] md:text-xs font-medium text-gray-400 uppercase">
                  Admins
                </p>
                <p className="text-lg md:text-xl font-bold text-gray-800 tabular-nums">
                  {adminCount}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 md:p-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-xl shrink-0">
                <User size={18} className="text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] md:text-xs font-medium text-gray-400 uppercase">
                  Users
                </p>
                <p className="text-lg md:text-xl font-bold text-gray-800 tabular-nums">
                  {userCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
          {/* Create User Form */}
          {canCreateUsers && (
            <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 md:px-5 py-3 md:py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-100 p-1.5 rounded-lg">
                    <UserPlus size={14} className="text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-800">
                      Create User
                    </h2>
                    <p className="text-[10px] md:text-[11px] text-gray-400">
                      Add a new user to the system
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 md:p-5">
                {success && (
                  <div className="flex items-center gap-2 mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-xs md:text-sm">
                    <CheckCircle size={16} />
                    User created successfully!
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs md:text-sm">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 uppercase mb-1">
                      Username
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User size={14} className="text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!/\s/.test(val)) {
                            setFormData({ ...formData, username: val });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === " ") e.preventDefault();
                        }}
                        placeholder="Enter username"
                        required
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition placeholder:text-gray-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 uppercase mb-1">
                      Email
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail size={14} className="text-gray-400" />
                      </div>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        placeholder="Enter email"
                        required
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition placeholder:text-gray-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 uppercase mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock size={14} className="text-gray-400" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        placeholder="Enter password"
                        required
                        className="w-full pl-8 pr-9 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition placeholder:text-gray-300"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition"
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 uppercase mb-1">
                      Role
                    </label>
                    <div className="relative">
                      <select
                        value={formData.role_id}
                        onChange={(e) =>
                          setFormData({ ...formData, role_id: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none transition bg-white"
                      >
                        <option value="">Select role (default: user)</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name.charAt(0).toUpperCase() +
                              role.name.slice(1)}{" "}
                            - {role.description}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <ChevronDown size={14} className="text-gray-400" />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <UserPlus size={14} />
                        Create User
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Users List */}
          {canManageUsers && (
            <div
              className={`${canCreateUsers ? "lg:col-span-2" : "lg:col-span-3"} bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden`}
            >
              <div className="px-4 md:px-5 py-3 md:py-4 border-b border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-100 p-1.5 rounded-lg">
                      <Users size={14} className="text-blue-600" />
                    </div>
                    <h2 className="text-sm font-semibold text-gray-800">
                      All Users
                    </h2>
                    <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {users.length}
                    </span>
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
                      className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-full sm:w-64 placeholder:text-gray-300"
                    />
                  </div>
                </div>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/80">
                      <th className="text-left py-3 px-5 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">
                        User
                      </th>
                      <th className="text-left py-3 px-5 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">
                        Email
                      </th>
                      <th className="text-left py-3 px-5 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">
                        Role
                      </th>
                      <th className="text-left py-3 px-5 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">
                        Permissions
                      </th>
                      <th className="text-right py-3 px-5 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-16 text-center">
                          <Users size={28} className="mx-auto mb-2 text-gray-300" />
                          <p className="text-sm text-gray-500">No users found</p>
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => {
                        const roleBadge = getRoleBadge(user.role_name);
                        return (
                          <tr
                            key={user.id}
                            className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                          >
                            <td className="py-3 px-5">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0 ${
                                    user.role_name === "admin"
                                      ? "bg-gradient-to-br from-red-500 to-red-600"
                                      : "bg-gradient-to-br from-blue-500 to-blue-600"
                                  }`}
                                >
                                  {user.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-800 text-[13px]">
                                    {user.username}
                                  </p>
                                  <p className="text-[10px] text-gray-400 font-mono">
                                    ID: {user.id}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-5 text-gray-500 text-[13px]">
                              {user.email}
                            </td>
                            <td className="py-3 px-5">
                              {editingUser === user.id ? (
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={editRoleId}
                                    onChange={(e) =>
                                      setEditRoleId(e.target.value)
                                    }
                                    className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                  >
                                    {roles.map((role) => (
                                      <option key={role.id} value={role.id}>
                                        {role.name.charAt(0).toUpperCase() +
                                          role.name.slice(1)}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() =>
                                      handleRoleChange(user.id, editRoleId)
                                    }
                                    className="p-1 text-green-600 hover:bg-green-50 rounded-md transition"
                                    title="Save"
                                  >
                                    <CheckCircle size={14} />
                                  </button>
                                  <button
                                    onClick={() => setEditingUser(null)}
                                    className="p-1 text-gray-400 hover:bg-gray-100 rounded-md transition"
                                    title="Cancel"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-full border ${roleBadge.bg} ${roleBadge.text} ${roleBadge.border}`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${roleBadge.dot}`}
                                  />
                                  {user.role_name || "No Role"}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-5">
                              <div className="flex flex-wrap gap-1">
                                {user.permissions.slice(0, 2).map((perm) => (
                                  <span
                                    key={perm}
                                    className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 rounded"
                                  >
                                    {perm}
                                  </span>
                                ))}
                                {user.permissions.length > 2 && (
                                  <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-400 rounded">
                                    +{user.permissions.length - 2}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-5">
                              <div className="flex items-center justify-end gap-0.5">
                                {user.id !== currentUser?.id && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setEditingUser(user.id);
                                        setEditRoleId(user.role_id || "");
                                      }}
                                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                      title="Edit Role"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirm(user.id)}
                                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                      title="Delete User"
                                    >
                                      <Trash2 size={14} />
                                    </button>
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

              {/* Mobile Cards */}
              <div className="md:hidden overflow-auto max-h-[50vh]">
                {filteredUsers.length === 0 ? (
                  <div className="py-12 text-center">
                    <Users size={28} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-sm text-gray-500">No users found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {filteredUsers.map((user) => {
                      const roleBadge = getRoleBadge(user.role_name);
                      return (
                        <div key={user.id} className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0 ${
                                  user.role_name === "admin"
                                    ? "bg-gradient-to-br from-red-500 to-red-600"
                                    : "bg-gradient-to-br from-blue-500 to-blue-600"
                                }`}
                              >
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">
                                  {user.username}
                                </p>
                                <p className="text-[10px] text-gray-400 font-mono truncate">
                                  {user.email}
                                </p>
                              </div>
                            </div>
                            {user.id !== currentUser?.id && (
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  onClick={() => {
                                    setEditingUser(user.id);
                                    setEditRoleId(user.role_id || "");
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(user.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            {editingUser === user.id ? (
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={editRoleId}
                                  onChange={(e) =>
                                    setEditRoleId(e.target.value)
                                  }
                                  className="px-2 py-1 border border-gray-200 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                  {roles.map((role) => (
                                    <option key={role.id} value={role.id}>
                                      {role.name.charAt(0).toUpperCase() +
                                        role.name.slice(1)}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() =>
                                    handleRoleChange(user.id, editRoleId)
                                  }
                                  className="p-1 text-green-600"
                                >
                                  <CheckCircle size={13} />
                                </button>
                                <button
                                  onClick={() => setEditingUser(null)}
                                  className="p-1 text-gray-400"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border ${roleBadge.bg} ${roleBadge.text} ${roleBadge.border}`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${roleBadge.dot}`}
                                />
                                {user.role_name || "No Role"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex flex-col items-center text-center">
                <div className="bg-red-100 p-3 rounded-full mb-4">
                  <AlertCircle size={28} className="text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-1">
                  Delete User
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  This action cannot be undone.
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteUser(deleteConfirm)}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium text-sm transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default UserManagement;
