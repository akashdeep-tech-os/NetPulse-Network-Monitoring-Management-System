import { useState, useEffect } from "react";
import {
  FolderOpen,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Wifi,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import DashboardLayout from "../layout/DashboardLayout";
import {
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  getDevices,
  assignDevicesToGroup,
  pingGroupDevices,
} from "../api.js";
import { useAuth } from "../routes/AuthContext.jsx";

const COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
];

const DeviceGroups = () => {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("create_devices") || hasPermission("manage_users");

  const [groups, setGroups] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [formData, setFormData] = useState({ name: "", color: COLORS[0] });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [assignModal, setAssignModal] = useState(null);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState([]);
  const [pingingGroup, setPingingGroup] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [groupsRes, devicesRes] = await Promise.all([
        getGroups(),
        getDevices(),
      ]);
      setGroups(groupsRes.data);
      setDevices(devicesRes.data);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async () => {
    if (!formData.name.trim()) return;
    try {
      if (editingGroup) {
        await updateGroup(editingGroup.id, formData);
      } else {
        await createGroup(formData);
      }
      setShowModal(false);
      setEditingGroup(null);
      setFormData({ name: "", color: COLORS[0] });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to save group");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteGroup(id);
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete group");
    }
  };

  const handleAssign = async () => {
    if (!assignModal) return;
    try {
      await assignDevicesToGroup(assignModal.id, selectedDeviceIds);
      setAssignModal(null);
      setSelectedDeviceIds([]);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to assign devices");
    }
  };

  const handlePingGroup = async (groupId) => {
    setPingingGroup(groupId);
    try {
      await pingGroupDevices(groupId);
      fetchData();
    } catch (err) {
      alert("Failed to ping group");
    } finally {
      setPingingGroup(null);
    }
  };

  const getGroupDevices = (groupId) => {
    return devices.filter((d) => d.group_id === groupId);
  };

  const getUngroupedDevices = () => {
    return devices.filter((d) => !d.group_id);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <RefreshCw size={24} className="animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full gap-4 md:gap-5 overflow-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg">
              <FolderOpen size={20} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add IP Groups
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Organize devices by location, type, or department
              </p>
            </div>
          </div>
          {canManage && (
            <button
              onClick={() => {
                setEditingGroup(null);
                setFormData({ name: "", color: COLORS[0] });
                setShowModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition"
            >
              <Plus size={15} />
              New Group
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-3 md:p-4">
            <p className="text-[10px] md:text-xs font-medium text-gray-400 dark:text-gray-500 uppercase">
              Total Groups
            </p>
            <p className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white tabular-nums">
              {groups.length}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-3 md:p-4">
            <p className="text-[10px] md:text-xs font-medium text-gray-400 dark:text-gray-500 uppercase">
              Grouped
            </p>
            <p className="text-xl md:text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {devices.filter((d) => d.group_id).length}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-3 md:p-4">
            <p className="text-[10px] md:text-xs font-medium text-gray-400 dark:text-gray-500 uppercase">
              Ungrouped
            </p>
            <p className="text-xl md:text-2xl font-bold text-gray-500 dark:text-gray-400 tabular-nums">
              {getUngroupedDevices().length}
            </p>
          </div>
        </div>

        {/* Groups Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map((group) => {
            const groupDevices = getGroupDevices(group.id);
            const onlineCount = groupDevices.filter(
              (d) => d.status === "Online"
            ).length;

            return (
              <div
                key={group.id}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden"
              >
                {/* Group Header */}
                <div
                  className="px-4 py-3 flex items-center justify-between"
                  style={{ borderLeft: `4px solid ${group.color}` }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: group.color }}
                    />
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                        {group.name}
                      </h3>
                      <p className="text-[10px] text-gray-400">
                        {groupDevices.length} devices
                      </p>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => handlePingGroup(group.id)}
                        disabled={pingingGroup === group.id}
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition"
                        title="Ping Group"
                      >
                        <RefreshCw
                          size={14}
                          className={
                            pingingGroup === group.id ? "animate-spin" : ""
                          }
                        />
                      </button>
                      <button
                        onClick={() => {
                          setEditingGroup(group);
                          setFormData({ name: group.name, color: group.color });
                          setShowModal(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(group.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Devices List */}
                <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-700">
                  {groupDevices.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">
                      No devices in this group
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-auto">
                      {groupDevices.slice(0, 5).map((device) => (
                        <div
                          key={device.id}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-gray-600 dark:text-gray-300 truncate">
                            {device.name}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              device.status === "Online"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            }`}
                          >
                            {device.status}
                          </span>
                        </div>
                      ))}
                      {groupDevices.length > 5 && (
                        <p className="text-[10px] text-gray-400 text-center">
                          +{groupDevices.length - 5} more
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Wifi size={12} className="text-green-500" />
                    <span className="text-[10px] text-gray-500">
                      {onlineCount}/{groupDevices.length} online
                    </span>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => {
                        setAssignModal(group);
                        setSelectedDeviceIds(
                          groupDevices.map((d) => d.id)
                        );
                      }}
                      className="text-[10px] text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Manage
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Ungrouped Devices Card */}
          {getUngroupedDevices().length > 0 && canManage && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 border-dashed overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600" />
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                    Ungrouped
                  </h3>
                  <p className="text-[10px] text-gray-400">
                    {getUngroupedDevices().length} devices
                  </p>
                </div>
              </div>
              <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-700">
                <div className="space-y-1.5 max-h-40 overflow-auto">
                  {getUngroupedDevices()
                    .slice(0, 5)
                    .map((device) => (
                      <div
                        key={device.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-gray-600 dark:text-gray-300 truncate">
                          {device.name}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            device.status === "Online"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }`}
                        >
                          {device.status}
                        </span>
                      </div>
                    ))}
                  {getUngroupedDevices().length > 5 && (
                    <p className="text-[10px] text-gray-400 text-center">
                      +{getUngroupedDevices().length - 5} more
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-800 dark:text-white">
                  {editingGroup ? "Edit Group" : "New Group"}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  <X size={18} className="text-gray-400" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    Group Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Floor 1, Servers, Cameras"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder:text-gray-400"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    Color
                  </label>
                  <div className="flex gap-2">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setFormData({ ...formData, color })}
                        className={`w-8 h-8 rounded-full transition ${
                          formData.color === color
                            ? "ring-2 ring-offset-2 ring-blue-500"
                            : "hover:scale-110"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700 flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!formData.name.trim()}
                  className="flex-1 px-4 py-2.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition disabled:opacity-50"
                >
                  {editingGroup ? "Save" : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assign Devices Modal */}
        {assignModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-800 dark:text-white">
                  Assign to "{assignModal.name}"
                </h3>
                <button
                  onClick={() => setAssignModal(null)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  <X size={18} className="text-gray-400" />
                </button>
              </div>
              <div className="p-5 max-h-80 overflow-auto">
                {devices.map((device) => (
                  <label
                    key={device.id}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDeviceIds.includes(device.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDeviceIds([
                            ...selectedDeviceIds,
                            device.id,
                          ]);
                        } else {
                          setSelectedDeviceIds(
                            selectedDeviceIds.filter((id) => id !== device.id)
                          );
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-white truncate">
                        {device.name}
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono">
                        {device.ip_address}
                      </p>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        device.status === "Online"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {device.status}
                    </span>
                  </label>
                ))}
              </div>
              <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700 flex gap-3">
                <button
                  onClick={() => setAssignModal(null)}
                  className="flex-1 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssign}
                  className="flex-1 px-4 py-2.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition"
                >
                  Save ({selectedDeviceIds.length})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="text-center">
                <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full inline-block mb-4">
                  <Trash2 size={24} className="text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">
                  Delete Group
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Devices will be ungrouped but not deleted.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 px-4 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg font-medium text-sm transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(deleteConfirm)}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium text-sm transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DeviceGroups;
