import { useState, useEffect } from "react";
import {
  BarChart3,
  Download,
  RefreshCw,
  Activity,
  AlertTriangle,
  Wifi,
  Filter,
} from "lucide-react";
import DashboardLayout from "../layout/DashboardLayout";
import OverviewStats from "../components/reports/OverviewStats";
import StatusDonut from "../components/reports/StatusDonut";
import DevicePerformanceGrid from "../components/reports/DevicePerformanceGrid";
import DevicesReportTab from "../components/reports/DevicesReportTab";
import DowntimeLogTab from "../components/reports/DowntimeLogTab";
import {
  getReportsOverview,
  getAllDevicesReport,
  getDowntimeLog,
  getDevices,
} from "../api.js";

const Reports = () => {
  const [overview, setOverview] = useState(null);
  const [devicesReport, setDevicesReport] = useState([]);
  const [downtimeLog, setDowntimeLog] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [timeRange, setTimeRange] = useState(24);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [overviewRes, reportRes, downtimeRes, devicesRes] =
        await Promise.allSettled([
          getReportsOverview(),
          getAllDevicesReport(timeRange),
          getDowntimeLog(timeRange),
          getDevices(),
        ]);
      if (overviewRes.status === "fulfilled")
        setOverview(overviewRes.value.data);
      if (reportRes.status === "fulfilled")
        setDevicesReport(reportRes.value.data);
      if (downtimeRes.status === "fulfilled")
        setDowntimeLog(downtimeRes.value.data);
      if (devicesRes.status === "fulfilled") setDevices(devicesRes.value.data);
    } catch {
      console.error("Failed to fetch reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const filteredReport = selectedDevice
    ? devicesReport.filter((r) => r.device_id === parseInt(selectedDevice))
    : devicesReport;

  const exportCSV = () => {
    const headers = [
      "Device Name",
      "IP Address",
      "Status",
      "Latency (ms)",
      "Uptime %",
      "Total Checks",
      "Online",
      "Offline",
    ];
    const rows = filteredReport.map((r) => [
      r.device_name,
      r.ip_address,
      r.current_status,
      r.current_latency || "N/A",
      r.uptime_percentage,
      r.total_checks,
      r.online_checks,
      r.offline_checks,
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !overview) {
    return (
      <DashboardLayout>
        <div className="flex flex-col h-full gap-4 p-4 md:p-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-32 bg-gray-200 rounded-xl animate-pulse"
              />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full gap-4 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                <BarChart3 size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Reports
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Monitor device performance
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(parseInt(e.target.value))}
                className="px-2.5 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white"
              >
                <option value={1}>1 Hour</option>
                <option value={6}>6 Hours</option>
                <option value={24}>24 Hours</option>
                <option value={168}>7 Days</option>
                <option value={720}>30 Days</option>
              </select>
              <button
                onClick={fetchData}
                className="p-1.5 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition"
                title="Refresh"
              >
                <RefreshCw
                  size={16}
                  className={
                    loading ? "animate-spin text-blue-600" : "text-gray-600 dark:text-gray-300"
                  }
                />
              </button>
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition"
              >
                <Download size={14} />
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </div>
          <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
            {[
              {
                id: "overview",
                label: "Overview",
                icon: <Activity size={14} />,
              },
              {
                id: "devices",
                label: "Devices",
                icon: <Wifi size={14} />,
              },
              {
                id: "downtime",
                label: "Downtime",
                icon: <AlertTriangle size={14} />,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition ${
                  activeTab === tab.id
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && overview && (
          <div className="flex flex-col flex-1 min-h-0 gap-3 overflow-auto">
            {/* Compact Stats Row */}
            <OverviewStats overview={overview} devicesReport={devicesReport} />

            {/* Main Content: Donut + Performance Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3 flex-1 min-h-0">
              <StatusDonut devicesReport={devicesReport} />
              <DevicePerformanceGrid devicesReport={devicesReport} />
            </div>
          </div>
        )}

        {/* Devices Report Tab */}
        {activeTab === "devices" && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center gap-3 mb-3">
              <Filter size={14} className="text-gray-400" />
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">All Devices</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.ip_address})
                  </option>
                ))}
              </select>
            </div>
            <DevicesReportTab
              devices={devices}
              selectedDevice={selectedDevice}
              setSelectedDevice={setSelectedDevice}
              filteredReport={filteredReport}
            />
          </div>
        )}

        {/* Downtime Log Tab */}
        {activeTab === "downtime" && (
          <DowntimeLogTab downtimeLog={downtimeLog} timeRange={timeRange} />
        )}
      </div>
    </DashboardLayout>
  );
};

export default Reports;
