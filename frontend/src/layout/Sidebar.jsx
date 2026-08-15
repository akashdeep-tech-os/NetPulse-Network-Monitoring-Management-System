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
  Sparkles,
  KeyRound,
  CreditCard,
  ListChecks,
  Globe,
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
  const { hasPermission, user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const activePage = location.pathname.split("/")[1] || "dashboard";

  const menus = [
    {
      name: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard size={20} />,
      path: "/dashboard",
      show: true,
    },
    {
      name: "ai",
      label: "AI Assistant",
      icon: <Sparkles size={20} />,
      path: "/ai",
      show: hasPermission("ai.view"),
    },
    {
      name: "reports",
      label: "Reports",
      icon: <BarChart3 size={20} />,
      path: "/reports",
      show: hasPermission("reports.view"),
    },
    {
      name: "scanner",
      label: "Port Scanner",
      icon: <ScanSearch size={20} />,
      path: "/scanner",
      show: hasPermission("checks.manage"),
    },
    {
      name: "groups",
      label: "IP Groups",
      icon: <FolderOpen size={20} />,
      path: "/groups",
      show: hasPermission("devices.view"),
    },
    {
      name: "alerts",
      label: "Alert Rules",
      icon: <Bell size={20} />,
      path: "/alerts",
      show: hasPermission("alerts.view"),
    },
    {
      name: "alert-history",
      label: "Alert History",
      icon: <History size={20} />,
      path: "/alert-history",
      show: hasPermission("alerts.view"),
    },
    {
      name: "api-keys",
      label: "API Keys",
      icon: <KeyRound size={20} />,
      path: "/api-keys",
      show: hasPermission("api_keys.manage"),
    },
    {
      name: "billing",
      label: "Billing & Plan",
      icon: <CreditCard size={20} />,
      path: "/billing",
      show: hasPermission("billing.view"),
    },
    {
      name: "audit",
      label: "Audit Logs",
      icon: <ListChecks size={20} />,
      path: "/audit",
      show: hasPermission("audit.view"),
    },
    {
      name: "settings",
      label: "Settings",
      icon: <Settings size={20} />,
      path: "/settings",
      show: hasPermission("users.view") || hasPermission("devices.view"),
    },
    {
      name: "platform",
      label: "Platform Admin",
      icon: <Globe size={20} />,
      path: "/platform",
      show: user?.is_platform_admin,
    },
  ].filter((m) => m.show);

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
                <h1 className="text-sm font-bold truncate">NetPulse</h1>
                <p className="text-[10px] text-slate-400 truncate">
                  Network Monitoring
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