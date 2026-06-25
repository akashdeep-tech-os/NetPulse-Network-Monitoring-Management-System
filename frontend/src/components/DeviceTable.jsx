import { useState } from "react";
import { Copy, Check, Trash2 } from "lucide-react";

const DeviceTable = ({ devices, rowHeight, onDelete, onBulkDelete, onEdit, onCopyIP, isAdmin }) => {
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
    navigator.clipboard.writeText(ip);
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
      {isAdmin && selectedIds.length > 0 && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-2">
          <span className="text-sm text-red-700 font-medium">
            {selectedIds.length} device(s) selected
          </span>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition"
          >
            <Trash2 size={14} />
            Delete Selected
          </button>
        </div>
      )}

      <div className="overflow-auto rounded-lg border border-gray-200 bg-white flex-1 min-h-0">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
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
              <th className="px-4 py-3 text-sm font-semibold text-gray-600 w-12 text-center">
                S.No.
              </th>
              <th className="px-4 py-3 text-sm font-semibold text-gray-600">
                Name
              </th>
              <th className="px-4 py-3 text-sm font-semibold text-gray-600">
                IP Address
              </th>
              <th className="px-4 py-3 text-sm font-semibold text-gray-600 text-center">
                Status
              </th>
              <th className="px-4 py-3 text-sm font-semibold text-gray-600">
                Last Updated
              </th>
              <th className="px-4 py-3 text-sm font-semibold text-gray-600 text-center">
                Copy
              </th>
            </tr>
          </thead>
          <tbody>
            {devices.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? "7" : "6"} className="px-4 py-8 text-center text-gray-400">
                  No devices found. Add a device or import from file.
                </td>
              </tr>
            ) : (
              devices.map((device, idx) => (
                <tr
                  key={device.id}
                  onContextMenu={(e) => handleContextMenu(e, device)}
                  onDoubleClick={() => handleCopy(device.ip_address, device.id)}
                  className={`border-b border-gray-100 cursor-pointer transition ${
                    selectedIds.includes(device.id)
                      ? "bg-blue-50 hover:bg-blue-100"
                      : device.status === "Online"
                        ? "bg-green-50 hover:bg-green-100"
                        : "bg-red-50 hover:bg-red-100"
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
                  <td className="px-4 py-2 text-sm text-center text-gray-500">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-2 text-sm font-medium text-gray-800">
                    {device.name}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600 font-mono">
                    {device.ip_address}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        device.status === "Online"
                          ? "bg-green-200 text-green-800"
                          : "bg-red-200 text-red-800"
                      }`}
                    >
                      {device.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
                    {device.updated_at
                      ? new Date(device.updated_at).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: true,
                        })
                      : "-"}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => handleCopy(device.ip_address, device.id)}
                      className="p-1 rounded hover:bg-gray-200 transition"
                      title="Copy IP"
                    >
                      {copiedId === device.id ? (
                        <Check size={16} className="text-green-600" />
                      ) : (
                        <Copy size={16} className="text-gray-400" />
                      )}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            onClick={() => {
              onEdit(contextMenu.device, "name");
              closeContextMenu();
            }}
          >
            Edit Name
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            onClick={() => {
              onEdit(contextMenu.device, "ip");
              closeContextMenu();
            }}
          >
            Edit IP
          </button>
          <hr className="my-1 border-gray-200" />
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
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
