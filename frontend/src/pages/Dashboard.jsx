import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import DeviceTable from "../components/DeviceTable";
import EditModal from "../components/EditModal";
import StatsCards from "../components/StatsCards";
import {
  AvailabilityChart,
  LatencyChart,
  PacketLossChart,
  StatusDonut,
  ProblemDevicesCard,
} from "../components/DashboardCharts";
import {
  getDevices,
  getDashboard,
  getGroups,
  updateDevice,
  deleteDevice,
  pingAllDevices,
  pingGroupDevices,
} from "../api.js";
import { useAuth } from "../routes/AuthContext.jsx";
import { useTheme } from "../routes/ThemeContext.jsx";
import { Sparkles } from "lucide-react";

const Dashboard = () => {
  const { hasPermission } = useAuth();
  const { theme } = useTheme();
  const canEdit = hasPermission("devices.edit");
  const canPing = hasPermission("devices.ping");

  const [devices, setDevices] = useState([]);
  const [groups, setGroups] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [rowHeight, setRowHeight] = useState(50);
  const [editModal, setEditModal] = useState({ device: null, field: null });
  const [pinging, setPinging] = useState(false);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await getDevices(selectedGroup ? { group_id: selectedGroup } : {});
      setDevices(res.data);
    } catch {
      // handled by interceptor
    }
  }, [selectedGroup]);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await getGroups();
      setGroups(res.data);
    } catch {
      // ignore
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await getDashboard();
      setDashboard(res.data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    fetchGroups();
    fetchDashboard();
  }, [fetchDevices, fetchGroups, fetchDashboard]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchDevices();
      fetchDashboard();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchDevices, fetchDashboard]);

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this device?")) {
      try {
        await deleteDevice(id);
        fetchDevices();
        fetchDashboard();
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

  const handlePingGroup = async (groupId) => {
    if (!canPing) return;
    setPinging(true);
    try {
      if (groupId) {
        await pingGroupDevices(groupId);
      } else {
        await pingAllDevices();
      }
      fetchDevices();
      fetchDashboard();
    } catch {
      alert("Failed to ping devices");
    } finally {
      setPinging(false);
    }
  };

  const filtered = devices.filter(
    (d) =>
      !searchQuery ||
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.ip_address.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const kpis = dashboard?.kpis || {};
  const charts = dashboard?.charts || {};

  return (
    <DashboardLayout
      offlineCount={kpis.offline_devices || 0}
      pinging={pinging}
      searchQuery={searchQuery}
      onSearchChange={(e) => setSearchQuery(e.target.value)}
      onPingAll={() => handlePingGroup(selectedGroup)}
      canPing={canPing}
    >
      <div className="flex flex-col h-full gap-4 overflow-auto">
        <StatsCards kpis={kpis} health={dashboard?.health_score} />

        {/* AI summary strip */}
        {dashboard?.ai_summary && Object.keys(dashboard.ai_summary).length > 0 && (
          <div
            className={`rounded-xl border p-4 flex items-start gap-3 ${
              theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h3 className={`text-sm font-semibold ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
                {dashboard.ai_summary.title || "Network Summary"}
              </h3>
              <p className={`text-xs mt-1 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                {dashboard.ai_summary.summary || ""}
              </p>
            </div>
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AvailabilityChart data={charts.latency_series || charts.availability_series || []} />
          <LatencyChart data={charts.latency_series || []} />
          <StatusDonut distribution={charts.device_distribution} />
          <ProblemDevicesCard devices={dashboard?.problem_devices || []} />
        </div>

        {charts.packet_loss_series?.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PacketLossChart data={charts.packet_loss_series} />
          </div>
        )}

        {/* Group Filter */}
        <div className="flex items-center gap-3">
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

        <div className="flex-1 min-h-0">
          <DeviceTable
            devices={filtered}
            rowHeight={rowHeight}
            onDelete={handleDelete}
            onEdit={(device, field) => setEditModal({ device, field })}
            onCopyIP={handleCopyIP}
            isAdmin={canEdit}
          />
        </div>
      </div>

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
