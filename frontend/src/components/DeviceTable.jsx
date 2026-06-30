import { useState } from "react";
import { Copy, Check, Trash2, Search } from "lucide-react";
import { useTheme } from "../routes/ThemeContext.jsx";

const DeviceTable = ({
  devices,
  rowHeight,
  onDelete,
  onBulkDelete,
  onEdit,
  onCopyIP,
  isAdmin,
}) => {
  const { theme } = useTheme();
  const [copiedId, setCopiedId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const handleContextMenu = (e, device) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      device,
    });
  };

  const handleCopy = (ip, id) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(ip);
    } else {
      const ta = document.createElement("textarea");
      ta.value = ip;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedId(id);
    onCopyIP && onCopyIP(ip);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const closeContextMenu = () => setContextMenu(null);

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === devices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(devices.map((d) => d.id));
    }
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} device(s)?`)) {
      onBulkDelete(selectedIds);
      setSelectedIds([]);
    }
  };

  const allSelected = devices.length > 0 && selectedIds.length === devices.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < devices.length;

  return (
    <div className="relative flex-1 min-h-0 flex flex-col" onClick={closeContextMenu}>
      {/* Bulk Actions */}
      {isAdmin && selectedIds.length > 0 && (
        <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 mb-2">
          <span className="text-xs md:text-sm text-red-700 dark:text-red-400 font-medium">
            {selectedIds.length} selected
          </span>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs md:text-sm rounded-lg transition"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}

      {/* Desktop Table */}
      <div className={`hidden md:block overflow-auto rounded-lg border flex-1 min-h-0 ${
        theme === "dark"
          ? "bg-slate-800 border-slate-700"
          : "bg-white border-gray-200"
      }`}>
        <table className="w-full text-left">
          <thead className={`border-b sticky top-0 ${
            theme === "dark"
              ? "bg-slate-700 border-slate-600"
              : "bg-gray-50 border-gray-200"
          }`}>
            <tr>
              {isAdmin && (
                <th className="px-4 py-3 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
              )}
              <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider w-12 text-center ${
                theme === "dark" ? "text-gray-400" : "text-gray-500"
              }`}>
                #
              </th>
              <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${
                theme === "dark" ? "text-gray-400" : "text-gray-500"
              }`}>
                Name
              </th>
              <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${
                theme === "dark" ? "text-gray-400" : "text-gray-500"
              }`}>
                IP Address
              </th>
              <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-center ${
                theme === "dark" ? "text-gray-400" : "text-gray-500"
              }`}>
                Status
              </th>
              <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${
                theme === "dark" ? "text-gray-400" : "text-gray-500"
              }`}>
                Last Updated
              </th>
              <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-center ${
                theme === "dark" ? "text-gray-400" : "text-gray-500"
              }`}>
                Copy
              </th>
            </tr>
          </thead>
          <tbody>
            {devices.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? "7" : "6"} className="px-4 py-12 text-center">
                  <Search size={32} className={`mx-auto mb-2 ${
                    theme === "dark" ? "text-gray-600" : "text-gray-300"
                  }`} />
                  <p className={`text-sm ${
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  }`}>No devices found</p>
                </td>
              </tr>
            ) : (
              devices.map((device, idx) => (
                <tr
                  key={device.id}
                  onContextMenu={(e) => handleContextMenu(e, device)}
                  onDoubleClick={() => handleCopy(device.ip_address, device.id)}
                  className={`border-b transition ${
                    theme === "dark" ? "border-slate-700" : "border-gray-100"
                  } ${
                    selectedIds.includes(device.id)
                      ? "bg-blue-50 dark:bg-blue-900/20"
                      : theme === "dark"
                        ? "hover:bg-slate-700"
                        : "hover:bg-gray-50"
                  }`}
                  style={{ height: `${rowHeight}px` }}
                >
                  {isAdmin && (
                    <td className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(device.id)}
                        onChange={() => toggleSelect(device.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                  )}
                  <td className={`px-4 py-2 text-sm text-center ${
                    theme === "dark" ? "text-gray-500" : "text-gray-400"
                  }`}>
                    {idx + 1}
                  </td>
                  <td className={`px-4 py-2 text-sm font-medium ${
                    theme === "dark" ? "text-white" : "text-gray-800"
                  }`}>
                    {device.name}
                  </td>
                  <td className={`px-4 py-2 text-sm font-mono ${
                    theme === "dark" ? "text-gray-300" : "text-gray-600"
                  }`}>
                    {device.ip_address}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        device.status === "Online"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {device.status}
                    </span>
                  </td>
                  <td className={`px-4 py-2 text-xs whitespace-nowrap ${
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  }`}>
                    {device.updated_at
                      ? new Date(device.updated_at).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-"}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => handleCopy(device.ip_address, device.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition"
                      title="Copy IP"
                    >
                      {copiedId === device.id ? (
                        <Check size={15} className="text-green-600" />
                      ) : (
                        <Copy size={15} className={
                          theme === "dark" ? "text-gray-400" : "text-gray-400"
                        } />
                      )}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden overflow-auto flex-1 min-h-0 space-y-2">
        {devices.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Search size={32} className={`mx-auto mb-2 ${
                theme === "dark" ? "text-gray-600" : "text-gray-300"
              }`} />
              <p className={`text-sm ${
                theme === "dark" ? "text-gray-400" : "text-gray-500"
              }`}>No devices found</p>
            </div>
          </div>
        ) : (
          devices.map((device, idx) => (
            <div
              key={device.id}
              className={`rounded-lg border p-3 ${
                selectedIds.includes(device.id)
                  ? "border-blue-300 bg-blue-50 dark:bg-blue-900/20"
                  : theme === "dark"
                    ? "bg-slate-800 border-slate-700"
                    : "bg-white border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {isAdmin && (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(device.id)}
                      onChange={() => toggleSelect(device.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      theme === "dark" ? "text-white" : "text-gray-800"
                    }`}>
                      {device.name}
                    </p>
                    <p className={`text-xs font-mono ${
                      theme === "dark" ? "text-gray-400" : "text-gray-500"
                    }`}>
                      {device.ip_address}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    device.status === "Online"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  }`}
                >
                  {device.status}
                </span>
              </div>
              <div className={`flex items-center justify-between mt-2 pt-2 border-t ${
                theme === "dark" ? "border-slate-700" : "border-gray-100"
              }`}>
                <span className={`text-[10px] ${
                  theme === "dark" ? "text-gray-500" : "text-gray-400"
                }`}>
                  {device.updated_at
                    ? new Date(device.updated_at).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-"}
                </span>
                <div className="flex items-center gap-1">
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => onEdit(device, "name")}
                        className={`p-1.5 rounded-lg transition text-xs ${
                          theme === "dark"
                            ? "text-gray-400 hover:text-blue-400 hover:bg-blue-900/20"
                            : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                        }`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(device.id)}
                        className={`p-1.5 rounded-lg transition text-xs ${
                          theme === "dark"
                            ? "text-gray-400 hover:text-red-400 hover:bg-red-900/20"
                            : "text-gray-400 hover:text-red-600 hover:bg-red-50"
                        }`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleCopy(device.ip_address, device.id)}
                    className={`p-1.5 rounded-lg transition ${
                      theme === "dark"
                        ? "text-gray-400 hover:text-green-400 hover:bg-green-900/20"
                        : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                    }`}
                  >
                    {copiedId === device.id ? (
                      <Check size={13} className="text-green-600" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 py-1 min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
              theme === "dark"
                ? "hover:bg-slate-700 text-gray-300"
                : "hover:bg-gray-100 text-gray-700"
            }`}
            onClick={() => {
              onEdit(contextMenu.device, "name");
              closeContextMenu();
            }}
          >
            Edit Name
          </button>
          <button
            className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
              theme === "dark"
                ? "hover:bg-slate-700 text-gray-300"
                : "hover:bg-gray-100 text-gray-700"
            }`}
            onClick={() => {
              onEdit(contextMenu.device, "ip");
              closeContextMenu();
            }}
          >
            Edit IP
          </button>
          <hr className={`my-1 ${
            theme === "dark" ? "border-slate-700" : "border-gray-200"
          }`} />
          <button
            className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
              theme === "dark"
                ? "hover:bg-red-900/20 text-red-400"
                : "hover:bg-red-50 text-red-600"
            }`}
            onClick={() => {
              onDelete(contextMenu.device.id);
              closeContextMenu();
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default DeviceTable;
