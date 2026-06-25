import {
  Bell,
  UserCircle,
  Search,
  Plus,
  Upload,
  Download,
  RefreshCw,
  LogOut,
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
  onImport,
  onExport,
  onPingAll,
}) => {
  const { logout, hasPermission, isAdmin, user } = useAuth();

  const handleKeyDown = (e) => {
    if (e.key === "Enter") onAdd();
  };

  return (
    <header className="h-14 bg-white border-b shadow-sm px-6 flex items-center gap-3">
      {isAdmin && (
        <>
          <input
            type="text"
            placeholder="Device Name"
            value={name}
            onChange={onNameChange}
            onKeyDown={handleKeyDown}
            className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-40 flex-shrink-0"
          />

          <input
            type="text"
            placeholder="IP Address"
            value={ip}
            onChange={onIpChange}
            onKeyDown={handleKeyDown}
            className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-40 flex-shrink-0"
          />

          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition flex-shrink-0"
          >
            <Plus size={15} /> Add
          </button>

          <div className="h-6 w-px bg-gray-200 flex-shrink-0" />
        </>
      )}

      <button
        onClick={onPingAll}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition flex-shrink-0"
      >
        <RefreshCw size={15} /> Ping All
      </button>

      {hasPermission("import_devices") && (
        <label className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition flex-shrink-0 cursor-pointer">
          <Upload size={15} /> Import
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={onImport}
            className="hidden"
          />
        </label>
      )}

      {hasPermission("export_devices") && (
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition flex-shrink-0"
        >
          <Download size={15} /> Export
        </button>
      )}

      <div className="h-6 w-px bg-gray-200 flex-shrink-0" />

      <div className="relative flex-shrink-0">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search..."
          className="pl-9 pr-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-44"
        />
      </div>

      <div className="ml-auto flex items-center gap-4 flex-shrink-0">
        <button className="relative" title="Notifications">
          <Bell size={20} className="text-gray-600" />
          {offlineCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 bg-red-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
              {offlineCount > 9 ? "9+" : offlineCount}
            </span>
          )}
        </button>

        <div className="h-6 w-px bg-gray-200" />

        <div className="flex items-center gap-2 cursor-pointer">
          <UserCircle size={30} className="text-gray-500" />
          <div className="leading-tight">
            <h4 className="text-sm font-semibold">{user?.username || "User"}</h4>
            <p className="text-[11px] text-gray-500">{isAdmin ? "Administrator" : "User"}</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="p-2 rounded-full hover:bg-gray-100 transition"
          title="Logout"
        >
          <LogOut size={20} className="text-gray-600" />
        </button>
      </div>
    </header>
  );
};

export default Header;
