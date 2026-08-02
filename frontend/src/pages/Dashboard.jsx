import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import DeviceTable from "../components/DeviceTable";
import EditModal from "../components/EditModal";
import StatsCards from "../components/StatsCards";
import {
  getDevices,
  updateDevice,
  deleteDevice,
  pingAllDevices,
  pingGroupDevices,
  getGroups,
} from "../api.js";
import { useAuth } from "../routes/AuthContext.jsx";

const Dashboard = () => {
  const { isAdmin } = useAuth();
  const [devices, setDevices] = useState([]);
  const [groups, setGroups] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [rowHeight, setRowHeight] = useState(50);
  const [editModal, setEditModal] = useState({ device: null, field: null });
  const [pinging, setPinging] = useState(false);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await getDevices();
      setDevices(res.data);
    } catch (err) {
      // 401 is handled by axios interceptor in api.js
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await getGroups();
      setGroups(res.data);
    } catch (err) {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    fetchGroups();
  }, []);

  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        setRowHeight((prev) =>
          Math.max(20, Math.min(100, prev + (e.deltaY < 0 ? 5 : -5))),
        );
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await getDevices();
        setDevices(res.data);
      } catch {
        // silently ignore
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this device?")) {
      try {
        await deleteDevice(id);
        fetchDevices();
      } catch {
        alert("Failed to delete device");
      }
    }
  };

  const handleEdit = async (id, field, value) => {
    try {
      const update = field === "name" ? { name: value } : { ip_address: value };
      await updateDevice(id, update);
      fetchDevices();
    } catch {
      alert("Failed to update device");
    }
  };

  const handleCopyIP = (ip) => {
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
  };

  const handlePingAll = async () => {
    setPinging(true);
    try {
      await pingAllDevices();
      fetchDevices();
    } catch {
      alert("Failed to ping devices");
    } finally {
      setPinging(false);
    }
  };

  const handlePingGroup = async (groupId) => {
    if (!groupId) return handlePingAll();
    setPinging(true);
    try {
      await pingGroupDevices(groupId);
      fetchDevices();
    } catch {
      alert("Failed to ping group");
    } finally {
      setPinging(false);
    }
  };

  const filtered = devices.filter(
    (d) =>
      (d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.ip_address.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (selectedGroup === "" ||
        (selectedGroup === "ungrouped" && !d.group_id) ||
        d.group_id === parseInt(selectedGroup)),
  );

  const total = devices.length;
  const online = devices.filter((d) => d.status === "Online").length;
  const offline = total - online;

  return (
    <DashboardLayout
      offlineCount={offline}
      pinging={pinging}
      searchQuery={searchQuery}
      onSearchChange={(e) => setSearchQuery(e.target.value)}
      onPingAll={() => handlePingGroup(selectedGroup)}
    >
      <StatsCards total={total} online={online} offline={offline} />

      {/* Group Filter */}
      <div className="flex items-center gap-3 mb-3">
        <select
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 text-gray-800 dark:text-white"
        >
          <option value="">All Devices</option>
          <option value="ungrouped">Ungrouped</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} ({g.device_count})
            </option>
          ))}
        </select>
        {selectedGroup && (
          <button
            onClick={() => setSelectedGroup("")}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear filter
          </button>
        )}
      </div>

      <DeviceTable
        devices={filtered}
        rowHeight={rowHeight}
        onDelete={handleDelete}
        onEdit={(device, field) => setEditModal({ device, field })}
        onCopyIP={handleCopyIP}
        isAdmin={isAdmin}
      />

      <EditModal
        device={editModal.device}
        field={editModal.field}
        onClose={() => setEditModal({ device: null, field: null })}
        onSave={handleEdit}
      />
    </DashboardLayout>
  );
};

export default Dashboard;
