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
} from "lucide-react";
import { createUser, getUsers, updateUserRole, deleteUser, getRoles } from "../api.js";
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

  const getRoleBadgeColor = (roleName) => {
    switch (roleName) {
      case "admin":
        return "bg-red-50 text-red-600 border border-red-200";
      case "user":
        return "bg-blue-50 text-blue-600 border border-blue-200";
      default:
        return "bg-gray-50 text-gray-600 border border-gray-200";
    }
  };

  const getRoleIcon = (roleName) => {
    switch (roleName) {
      case "admin":
        return <Shield size={12} className="text-red-500" />;
      case "user":
        return <User size={12} className="text-blue-500" />;
      default:
        return <User size={12} className="text-gray-500" />;
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.role_name && u.role_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const adminCount = users.filter((u) => u.role_name === "admin").length;
  const userCount = users.filter((u) => u.role_name === "user").length;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full gap-4 p-4 md:p-6 overflow-auto">
        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <Users size={24} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Users</p>
              <p className="text-2xl font-bold text-gray-800">{users.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-4">
            <div className="bg-red-50 p-3 rounded-lg">
              <Shield size={24} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Admins</p>
              <p className="text-2xl font-bold text-gray-800">{adminCount}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-4">
            <div className="bg-green-50 p-3 rounded-lg">
              <User size={24} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Regular Users</p>
              <p className="text-2xl font-bold text-gray-800">{userCount}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Create User Form */}
          {canCreateUsers && (
            <div className="lg:col-span-1 bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="bg-white/20 p-2 rounded-lg">
                    <UserPlus size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Create User</h2>
                    <p className="text-blue-100 text-xs">Add a new user to the system</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {success && (
                  <div className="flex items-center gap-2 mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm animate-pulse">
                    <CheckCircle size={16} />
                    User created successfully!
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Username
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User size={16} className="text-gray-400" />
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
                        placeholder="Enter username (no spaces)"
                        required
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Spaces are not allowed</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail size={16} className="text-gray-400" />
                      </div>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        placeholder="Enter email address"
                        required
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock size={16} className="text-gray-400" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        placeholder="Enter password"
                        required
                        className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Role
                    </label>
                    <div className="relative">
                      <select
                        value={formData.role_id}
                        onChange={(e) =>
                          setFormData({ ...formData, role_id: e.target.value })
                        }
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none transition bg-white"
                      >
                        <option value="">Select role (default: user)</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name.charAt(0).toUpperCase() + role.name.slice(1)} - {role.description}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <ChevronDown size={16} className="text-gray-400" />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <UserPlus size={16} />
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
            <div className={`${canCreateUsers ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-xl shadow-sm overflow-hidden`}>
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Users size={20} className="text-blue-600" />
                    <h2 className="text-lg font-bold text-gray-800">All Users</h2>
                    <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
                      {users.length}
                    </span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search size={16} className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-full sm:w-64"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left py-3 px-6 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                        User
                      </th>
                      <th className="text-left py-3 px-6 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                        Email
                      </th>
                      <th className="text-left py-3 px-6 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                        Role
                      </th>
                      <th className="text-left py-3 px-6 font-semibold text-gray-600 text-xs uppercase tracking-wider hidden md:table-cell">
                        Permissions
                      </th>
                      <th className="text-right py-3 px-6 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-12 text-center text-gray-400">
                          <Users size={40} className="mx-auto mb-3 text-gray-300" />
                          <p className="font-medium">No users found</p>
                          <p className="text-sm">Create your first user to get started</p>
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr
                          key={user.id}
                          className="border-b border-gray-50 hover:bg-gray-50 transition"
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
                                user.role_name === "admin" ? "bg-red-500" : "bg-blue-500"
                              }`}>
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-gray-800">{user.username}</p>
                                <p className="text-xs text-gray-400">ID: {user.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-gray-600">{user.email}</td>
                          <td className="py-4 px-6">
                            {editingUser === user.id ? (
                              <div className="flex items-center gap-2">
                                <select
                                  value={editRoleId}
                                  onChange={(e) => setEditRoleId(e.target.value)}
                                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                  {roles.map((role) => (
                                    <option key={role.id} value={role.id}>
                                      {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleRoleChange(user.id, editRoleId)}
                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition"
                                  title="Save"
                                >
                                  <CheckCircle size={16} />
                                </button>
                                <button
                                  onClick={() => setEditingUser(null)}
                                  className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition"
                                  title="Cancel"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(user.role_name)}`}>
                                {getRoleIcon(user.role_name)}
                                {user.role_name || "No Role"}
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 hidden md:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {user.permissions.slice(0, 2).map((perm) => (
                                <span
                                  key={perm}
                                  className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                                >
                                  {perm}
                                </span>
                              ))}
                              {user.permissions.length > 2 && (
                                <span className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
                                  +{user.permissions.length - 2} more
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center justify-end gap-1">
                              {user.id !== currentUser?.id && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingUser(user.id);
                                      setEditRoleId(user.role_id || "");
                                    }}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                    title="Edit Role"
                                  >
                                    <Edit2 size={15} />
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm(user.id)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                    title="Delete User"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-red-50 p-3 rounded-full">
                  <AlertCircle size={24} className="text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Delete User</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this user? All their data will be permanently removed.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteUser(deleteConfirm)}
                  className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium transition"
                >
                  Delete User
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default UserManagement;
