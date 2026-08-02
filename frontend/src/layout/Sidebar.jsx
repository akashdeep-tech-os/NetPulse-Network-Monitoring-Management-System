import {
  LayoutDashboard,
  ShieldCheck,
  ScanSearch,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  X,
  FolderOpen,
  Sun,
  Moon,
  Bell,
  History,
  Settings,
  Shield,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../routes/AuthContext.jsx";
import { useTheme } from "../routes/ThemeContext.jsx";

const Sidebar = ({
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, hasPermission } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const activePage =
    location.pathname === "/scanner"
      ? "scanner"
      : location.pathname === "/reports"
        ? "reports"
        : location.pathname === "/groups"
          ? "groups"
          : location.pathname === "/alerts"
            ? "alerts"
            : location.pathname === "/alert-history"
              ? "alert-history"
              : location.pathname === "/settings"
                ? "settings"
                : "dashboard";

  const menus = [
    {
      name: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard size={20} />,
      path: "/dashboard",
    },
    {
      name: "reports",
      label: "Reports",
      icon: <BarChart3 size={20} />,
      path: "/reports",
    },
    ...(hasPermission("port_scanning")
      ? [
          {
            name: "scanner",
            label: "Port Scanner",
            icon: <ScanSearch size={20} />,
            path: "/scanner",
          },
        ]
      : []),
    ...(hasPermission("create_devices") || hasPermission("manage_users")
      ? [
          {
            name: "groups",
            label: "Add IP Groups",
            icon: <FolderOpen size={20} />,
            path: "/groups",
          },
        ]
      : []),
    ...(hasPermission("manage_users")
      ? [
          {
            name: "alerts",
            label: "Add Alert",
            icon: <Bell size={20} />,
            path: "/alerts",
          },
          {
            name: "alert-history",
            label: "Alert History",
            icon: <History size={20} />,
            path: "/alert-history",
          },
        ]
      : []),
    ...(hasPermission("manage_users") || hasPermission("create_users")
      ? [
          {
            name: "settings",
            label: "Settings",
            icon: <Settings size={20} />,
            path: "/settings",
          },
        ]
      : []),
  ];

  const handleNav = (path) => {
    navigate(path);
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 bg-slate-900 dark:bg-slate-950 text-white flex flex-col transition-all duration-300 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${isCollapsed ? "w-[68px]" : "w-64"}`}
      >
        {/* Logo */}
        <div
          className={`px-4 h-14 flex items-center border-b border-slate-700 shrink-0 ${isCollapsed ? "justify-center" : "justify-between"}`}
        >
          {!isCollapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                <Shield size={18} className="text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold truncate">Surakshit</h1>
                <p className="text-[10px] text-slate-400 truncate">
                  Ping Monitor
                </p>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield size={18} className="text-white" />
            </div>
          )}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-1 hover:bg-slate-700 rounded"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="p-2 flex-1 overflow-y-auto">
          {menus.map((item) => (
            <button
              key={item.name}
              onClick={() => handleNav(item.path)}
              title={isCollapsed ? item.label : undefined}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition mb-1 ${
                isCollapsed ? "justify-center" : ""
              } ${
                activePage === item.name
                  ? "bg-blue-600 text-white"
                  : "hover:bg-slate-800 text-slate-300"
              }`}
            >
              <span className="shrink-0">{item.icon}</span>
              {!isCollapsed && (
                <span className="text-sm truncate">{item.label}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Theme Toggle + Status + Toggle */}
        <div
          className={`p-3 border-t border-slate-700 ${isCollapsed ? "px-2" : ""}`}
        >
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            title={
              isCollapsed
                ? theme === "dark"
                  ? "Light Mode"
                  : "Dark Mode"
                : undefined
            }
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-300 transition mb-2 ${
              isCollapsed ? "justify-center" : ""
            }`}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            {!isCollapsed && (
              <span className="text-sm">
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </span>
            )}
          </button>

          {!isCollapsed && (
            <div className="flex items-center gap-2 mb-3 px-2">
              <ShieldCheck size={18} className="text-green-400 shrink-0" />
              <div className="min-w-0">
                <h4 className="text-xs font-semibold truncate">
                  System Healthy
                </h4>
                <p className="text-[10px] text-slate-400 truncate">
                  All services operational
                </p>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex items-center justify-center w-full py-2 rounded-lg hover:bg-slate-800 text-slate-400 transition"
          >
            {isCollapsed ? (
              <ChevronRight size={18} />
            ) : (
              <ChevronLeft size={18} />
            )}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
