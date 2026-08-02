import { useState } from "react";
import {
  Bell,
  UserCircle,
  Search,
  RefreshCw,
  LogOut,
  Menu,
  LogIn,
} from "lucide-react";
import { useAuth } from "../routes/AuthContext.jsx";
import { useNavigate } from "react-router-dom";

const Header = ({
  offlineCount = 0,
  pinging = false,
  searchQuery,
  onSearchChange,
  onPingAll,
  onMenuToggle,
}) => {
  const { logout, isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="h-14 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 shadow-sm px-4 lg:px-6 flex items-center gap-3 shrink-0">
      {/* Mobile Menu Toggle */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition"
      >
        <Menu size={20} className="text-gray-600 dark:text-gray-300" />
      </button>

      {/* Search */}
      <div className="relative w-48 lg:w-64 shrink-0">
        <Search
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search..."
          className="w-full pl-8 pr-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-gray-50 dark:bg-slate-700/50 text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 transition"
        />
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 ml-auto shrink-0">
        {/* Ping All */}
        <button
          onClick={onPingAll}
          disabled={pinging}
          title="Ping All Devices"
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-sm rounded-xl transition font-medium disabled:opacity-50"
        >
          <RefreshCw size={15} className={pinging ? "animate-spin" : ""} />
          <span className="hidden sm:inline">{pinging ? "Pinging..." : "Ping All"}</span>
        </button>

        {/* Notifications */}
        <button
          className="relative p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition"
          title="Notifications"
        >
          <Bell size={18} className="text-gray-600 dark:text-gray-300" />
          {offlineCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 bg-red-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
              {offlineCount > 9 ? "9+" : offlineCount}
            </span>
          )}
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-gray-200 dark:bg-slate-600 hidden sm:block" />

        {/* User Menu (Desktop) */}
        <div className="hidden lg:block relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-xs">
              {user?.username?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="leading-tight text-left">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-white">
                {user?.username || "User"}
              </h4>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                {isAdmin ? "Administrator" : "User"}
              </p>
            </div>
          </button>

          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 py-1 w-48 z-50">
                <button
                  onClick={() => {
                    navigate("/settings");
                    setShowUserMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-3 text-gray-700 dark:text-gray-300"
                >
                  <UserCircle size={16} className="text-gray-500" />
                  Settings
                </button>
                <hr className="my-1 border-gray-100 dark:border-slate-700" />
                <button
                  onClick={() => {
                    logout();
                    setShowUserMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 flex items-center gap-3"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>

        {/* Logout Button (Desktop) */}
        <button
          onClick={logout}
          className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm rounded-xl transition font-medium"
          title="Logout"
        >
          <LogOut size={16} />
          <span className="hidden xl:inline">Logout</span>
        </button>

        {/* Mobile Logout */}
        <button
          onClick={logout}
          className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition"
          title="Logout"
        >
          <LogOut size={18} className="text-gray-600 dark:text-gray-300" />
        </button>
      </div>
    </header>
  );
};

export default Header;
