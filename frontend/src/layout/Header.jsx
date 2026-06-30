import { useState } from "react";
import {
  Bell,
  UserCircle,
  Search,
  Plus,
  RefreshCw,
  LogOut,
  Menu,
} from "lucide-react";
import { useAuth } from "../routes/AuthContext.jsx";

const Header = ({
  offlineCount = 0,
  name,
  ip,
  onNameChange,
  onIpChange,
  onAdd,
  searchQuery,
  onSearchChange,
  onPingAll,
  onMenuToggle,
}) => {
  const { logout, hasPermission, isAdmin, user } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") onAdd();
  };

  return (
    <header className="h-14 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 shadow-sm px-4 lg:px-6 flex items-center gap-2 lg:gap-3 shrink-0">
      {/* Mobile Menu Toggle */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition"
      >
        <Menu size={20} className="text-gray-600 dark:text-gray-300" />
      </button>

      {/* Add Device (Desktop) */}
      {isAdmin && (
        <div className="hidden md:flex items-center gap-2">
          <input
            type="text"
            placeholder="Device Name"
            value={name}
            onChange={onNameChange}
            onKeyDown={handleKeyDown}
            className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-32 lg:w-40 bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder:text-gray-400"
          />
          <input
            type="text"
            placeholder="IP Address"
            value={ip}
            onChange={onIpChange}
            onKeyDown={handleKeyDown}
            className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-32 lg:w-40 bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder:text-gray-400"
          />
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition"
          >
            <Plus size={15} /> Add
          </button>
          <div className="h-6 w-px bg-gray-200 dark:bg-slate-600" />
        </div>
      )}

      {/* Action Buttons (Desktop) */}
      <div className="hidden md:flex items-center gap-2">
        <button
          onClick={onPingAll}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg transition"
        >
          <RefreshCw size={15} /> Ping All
        </button>

        <div className="h-6 w-px bg-gray-200 dark:bg-slate-600" />
      </div>

      {/* Search (Desktop) */}
      <div className="hidden sm:block relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search..."
          className="pl-9 pr-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-36 lg:w-44 bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder:text-gray-400"
        />
      </div>

      {/* Right Side */}
      <div className="ml-auto flex items-center gap-2 lg:gap-4">
        {/* Notifications */}
        <button className="relative p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition" title="Notifications">
          <Bell size={18} className="text-gray-600 dark:text-gray-300" />
          {offlineCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 bg-red-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
              {offlineCount > 9 ? "9+" : offlineCount}
            </span>
          )}
        </button>

        {/* User (Desktop) */}
        <div className="hidden lg:flex items-center gap-2">
          <div className="h-6 w-px bg-gray-200 dark:bg-slate-600" />
          <div className="flex items-center gap-2">
            <UserCircle size={30} className="text-gray-500 dark:text-gray-400" />
            <div className="leading-tight">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-white">{user?.username || "User"}</h4>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{isAdmin ? "Administrator" : "User"}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition"
            title="Logout"
          >
            <LogOut size={18} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* Mobile User Menu */}
        <div className="lg:hidden relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition"
          >
            <UserCircle size={22} className="text-gray-600 dark:text-gray-300" />
          </button>
          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 py-1 w-56 z-50">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">{user?.username || "User"}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{isAdmin ? "Administrator" : "User"}</p>
                </div>
                <button
                  onClick={() => { onPingAll(); setShowUserMenu(false); }}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-3 text-gray-700 dark:text-gray-300"
                >
                  <RefreshCw size={16} className="text-gray-500" />
                  Ping All
                </button>
                <hr className="my-1 border-gray-100 dark:border-slate-700" />
                <button
                  onClick={() => { logout(); setShowUserMenu(false); }}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 flex items-center gap-3"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
