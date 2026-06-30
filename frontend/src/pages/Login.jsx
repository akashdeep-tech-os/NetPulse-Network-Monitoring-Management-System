import { useState } from "react";
import { Lock, User, Shield } from "lucide-react";
import { login } from "../api.js";
import { useAuth } from "../routes/AuthContext.jsx";
import { useTheme } from "../routes/ThemeContext.jsx";

const Login = () => {
  const { login: authLogin } = useAuth();
  const { theme } = useTheme();
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
    <div className={`min-h-screen flex items-center justify-center p-4 ${
      theme === "dark" ? "bg-slate-900" : "bg-gradient-to-br from-slate-100 to-slate-200"
    }`}>
      <div className={`rounded-2xl shadow-xl p-6 sm:p-8 w-full max-w-sm ${
        theme === "dark" ? "bg-slate-800" : "bg-white"
      }`}>
        <div className="text-center mb-8">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
            theme === "dark" ? "bg-blue-900/30" : "bg-blue-100"
          }`}>
            <Shield size={28} className={`${
              theme === "dark" ? "text-blue-400" : "text-blue-600"
            }`} />
          </div>
          <h1 className={`text-xl font-bold ${
            theme === "dark" ? "text-white" : "text-gray-900"
          }`}>Surakshit</h1>
          <p className={`text-sm mt-1 ${
            theme === "dark" ? "text-gray-400" : "text-gray-500"
          }`}>Ping Monitor</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className={`block text-xs font-medium mb-1.5 ${
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            }`}>
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User size={16} className="text-gray-400" />
              </div>
              <input
                type="text"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                placeholder="Enter username"
                required
                className={`w-full pl-9 pr-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition ${
                  theme === "dark"
                    ? "bg-slate-700 border-slate-600 text-white placeholder:text-gray-500"
                    : "bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
                }`}
              />
            </div>
          </div>

          <div className="mb-6">
            <label className={`block text-xs font-medium mb-1.5 ${
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            }`}>
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={16} className="text-gray-400" />
              </div>
              <input
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="Enter password"
                required
                className={`w-full pl-9 pr-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition ${
                  theme === "dark"
                    ? "bg-slate-700 border-slate-600 text-white placeholder:text-gray-500"
                    : "bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
                }`}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
