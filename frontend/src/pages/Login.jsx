import { useState } from "react";
import { Lock, User } from "lucide-react";
import { login } from "../api.js";
import { useAuth } from "../routes/AuthContext.jsx";

const Login = () => {
  const { login: authLogin } = useAuth();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const loginData = new FormData();
      loginData.append("username", formData.username);
      loginData.append("password", formData.password);

      const res = await login(loginData);
      authLogin(res.data.access_token, res.data.permissions, res.data.is_admin);
    } catch (err) {
      alert(err.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-2">
          Rakshit Enterprises
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Ping Monitor
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <div className="flex items-center border border-gray-300 rounded-lg px-3">
              <User size={18} className="text-gray-400" />
              <input
                type="text"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                placeholder="Enter username"
                required
                className="w-full px-3 py-2 outline-none text-sm"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="flex items-center border border-gray-300 rounded-lg px-3">
              <Lock size={18} className="text-gray-400" />
              <input
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="Enter password"
                required
                className="w-full px-3 py-2 outline-none text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
