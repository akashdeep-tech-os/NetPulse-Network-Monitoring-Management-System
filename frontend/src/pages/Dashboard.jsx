import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import DashboardLayout from "../layout/DashboardLayout";
import DeviceTable from "../components/DeviceTable";
import EditModal from "../components/EditModal";
import StatsCards from "../components/StatsCards";
import {
  getDevices,
  createDevice,
  updateDevice,
  deleteDevice,
  bulkDeleteDevices,
  pingAllDevices,
  pingGroupDevices,
  importDevices,
  exportDevices,
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
  const [headerName, setHeaderName] = useState("");
  const [headerIp, setHeaderIp] = useState("");
  const [headerGroupId, setHeaderGroupId] = useState("");

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

  const handleHeaderAdd = async () => {
    if (!headerName.trim() || !headerIp.trim()) {
      alert("Please enter Device Name and IP Address");
      return;
    }
    try {
      const payload = {
        name: headerName.trim(),
        ip_address: headerIp.trim(),
      };
      if (headerGroupId) {
        payload.group_id = parseInt(headerGroupId);
      }
      await createDevice(payload);
      setHeaderName("");
      setHeaderIp("");
      setHeaderGroupId("");
      fetchDevices();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to add device");
    }
  };

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

  const handleBulkDelete = async (ids) => {
    try {
      await bulkDeleteDevices(ids);
      fetchDevices();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete devices");
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
    navigator.clipboard.writeText(ip);
  };

  const handlePingAll = async () => {
    try {
      await pingAllDevices();
      fetchDevices();
    } catch {
      alert("Failed to ping devices");
    }
  };

  const handlePingGroup = async (groupId) => {
    if (!groupId) return handlePingAll();
    try {
      await pingGroupDevices(groupId);
      fetchDevices();
    } catch {
      alert("Failed to ping group");
    }
  };

  const parseIP = (raw) => {
    if (!raw) return null;
    let ip = String(raw).trim();
    ip = ip.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!ip || ip.toUpperCase() === "WFL") return null;
    if (!ip.includes(".") || ip.length > 25) return null;
    return ip;
  };

  const mapRow = (row) => {
    const keys = Object.keys(row);

    const rawIP =
      row["ip address"] || row["Static IP"] || row["IP"] || row["ip"] || row["Ip"];

    if (rawIP) {
      const ip = parseIP(rawIP);
      if (!ip) return null;
      const name = row["Location"] || row["Camera Location"] || row["Name"] || row["name"] || ip;
      return { name, ip_address: ip };
    }

    if (keys.length >= 2) {
      const nameVal = String(row[keys[0]] || "").trim();
      const ipVal = parseIP(row[keys[1]]);
      if (ipVal && nameVal) return { name: nameVal, ip_address: ipVal };
      if (ipVal) return { name: ipVal, ip_address: ipVal };
    }

    return null;
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.split(".").pop().toLowerCase();
    let imported = [];

    try {
      if (ext === "csv") {
        Papa.parse(file, {
          header: true,
          complete: async (results) => {
            try {
              imported = results.data.map(mapRow).filter(Boolean);
              if (imported.length) {
                const res = await importDevices(imported);
                const added = res.data.length;
                const skipped = imported.length - added;
                let msg = `${added} device(s) imported successfully`;
                if (skipped > 0) msg += `\n${skipped} duplicate(s) skipped`;
                alert(msg);
                fetchDevices();
              } else {
                alert("No valid devices found in file");
              }
            } catch (err) {
              alert(err.response?.data?.detail || "Failed to import CSV data");
            }
          },
          error: () => {
            alert("Failed to parse CSV file");
          },
        });
      } else if (ext === "xlsx" || ext === "xls") {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const data = new Uint8Array(evt.target.result);
            const wb = XLSX.read(data, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws);
            imported = rows.map(mapRow).filter(Boolean);

            if (imported.length) {
              const res = await importDevices(imported);
              const added = res.data.length;
              const skipped = imported.length - added;
              let msg = `${added} device(s) imported successfully`;
              if (skipped > 0) msg += `\n${skipped} duplicate(s) skipped`;
              alert(msg);
              fetchDevices();
            } else {
              alert("No valid devices found in file");
            }
          } catch (err) {
            console.error("Excel parse error:", err);
            alert("Failed to parse Excel file: " + err.message);
          }
        };
        reader.readAsArrayBuffer(file);
      }
    } catch {
      alert("Failed to import devices");
    }
    e.target.value = "";
  };

  const handleExport = async () => {
    try {
      const res = await exportDevices();
      const ws = XLSX.utils.json_to_sheet(res.data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Devices");
      XLSX.writeFile(wb, "devices.xlsx");
    } catch {
      alert("Failed to export devices");
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
      name={headerName}
      ip={headerIp}
      onNameChange={(e) => setHeaderName(e.target.value)}
      onIpChange={(e) => setHeaderIp(e.target.value)}
      onAdd={handleHeaderAdd}
      searchQuery={searchQuery}
      onSearchChange={(e) => setSearchQuery(e.target.value)}
      onImport={handleImport}
      onExport={handleExport}
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
        onBulkDelete={handleBulkDelete}
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
