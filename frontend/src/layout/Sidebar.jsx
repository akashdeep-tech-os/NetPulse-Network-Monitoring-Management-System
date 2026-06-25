import {
  LayoutDashboard,
  ShieldCheck,
  ScanSearch,
  UserPlus,
  Users,
  BarChart3,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../routes/AuthContext.jsx";

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, hasPermission } = useAuth();

  const activePage = location.pathname === "/scanner" ? "scanner"
    : location.pathname === "/users" ? "users"
    : location.pathname === "/reports" ? "reports"
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
    ...(hasPermission("create_users") || hasPermission("manage_users")
      ? [
          {
            name: "users",
            label: isAdmin ? "Manage Users" : "Create User",
            icon: isAdmin ? <Users size={20} /> : <UserPlus size={20} />,
            path: "/users",
          },
        ]
      : []),
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col">
      <div className="p-5 border-b border-slate-700">
        <h1 className="text-xl font-bold">SURAKSHIT CITY</h1>
        <p className="text-xs text-slate-400">Ping Monitor</p>
      </div>

      <nav className="p-4 flex-1">
        {menus.map((item) => (
          <button
            key={item.name}
            onClick={() => navigate(item.path)}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition mb-2 ${
              activePage === item.name
                ? "bg-blue-600 text-white"
                : "hover:bg-slate-800 text-slate-300"
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} className="text-green-400" />
          <div>
            <h4 className="text-sm font-semibold">System Healthy</h4>
            <p className="text-xs text-slate-400">All services operational</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
