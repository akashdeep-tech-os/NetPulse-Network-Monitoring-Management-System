import { useState, useEffect } from "react";
import {
  BarChart3,
  Clock,
  Wifi,
  Activity,
  AlertTriangle,
  CheckCircle,
  Download,
  RefreshCw,
  Filter,
  TrendingUp,
  TrendingDown,
  Server,
  Zap,
  Shield,
} from "lucide-react";
import DashboardLayout from "../layout/DashboardLayout";
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

  const getLatencyColor = (latency) => {
    if (latency === null) return "text-gray-400";
    if (latency < 50) return "text-green-600";
    if (latency < 100) return "text-yellow-600";
    return "text-red-600";
  };

  const getUptimeColor = (uptime) => {
    if (uptime >= 99) return "bg-green-500";
    if (uptime >= 95) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getUptimeRingColor = (uptime) => {
    if (uptime >= 99) return "#22c55e";
    if (uptime >= 95) return "#eab308";
    return "#ef4444";
  };

  const getUptimeTextColor = (uptime) => {
    if (uptime >= 99) return "text-green-600";
    if (uptime >= 95) return "text-yellow-600";
    return "text-red-600";
  };

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

  const uptimePercent = overview ? overview.uptime_percentage : 0;

  const topDevices = [...devicesReport]
    .sort((a, b) => b.uptime_percentage - a.uptime_percentage)
    .slice(0, 5);
  const worstDevices = [...devicesReport]
    .sort((a, b) => a.uptime_percentage - b.uptime_percentage)
    .slice(0, 5);

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
      <div className="flex flex-col h-full gap-4 p-4 md:p-6 overflow-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <BarChart3 size={20} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Reports</h1>
              <p className="text-xs text-gray-500">
                Monitor device performance
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(parseInt(e.target.value))}
              className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value={1}>Last 1 Hour</option>
              <option value={6}>Last 6 Hours</option>
              <option value={24}>Last 24 Hours</option>
              <option value={168}>Last 7 Days</option>
              <option value={720}>Last 30 Days</option>
            </select>
            <button
              onClick={fetchData}
              className="p-1.5 border rounded-lg hover:bg-gray-50 transition"
              title="Refresh"
            >
              <RefreshCw
                size={16}
                className={
                  loading ? "animate-spin text-blue-600" : "text-gray-600"
                }
              />
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition"
            >
              <Download size={14} />
              Export
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {[
            { id: "overview", label: "Overview", icon: <Activity size={14} /> },
            { id: "devices", label: "Devices", icon: <Wifi size={14} /> },
            {
              id: "downtime",
              label: "Downtime",
              icon: <AlertTriangle size={14} />,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && overview && (
          <div className="space-y-4">
            {/* Stats Row */}
            <div className="flex flex-row gap-[10px]">
              {/* Uptime Ring */}
              <div className="flex-1 min-w-0 bg-white rounded-lg shadow-sm border border-gray-100 p-3 flex items-center gap-2.5">
                <div className="relative w-12 h-12 shrink-0">
                  <svg
                    className="w-full h-full -rotate-90"
                    viewBox="0 0 120 120"
                  >
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke="#f3f4f6"
                      strokeWidth="10"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke={getUptimeRingColor(uptimePercent)}
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 50}
                      strokeDashoffset={
                        2 * Math.PI * 50 -
                        (uptimePercent / 100) * 2 * Math.PI * 50
                      }
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span
                      className={`text-[11px] font-bold tabular-nums ${getUptimeTextColor(uptimePercent)}`}
                    >
                      {uptimePercent}%
                    </span>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-400 leading-none">
                    Uptime
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock size={9} className="text-gray-300" />
                    <span className="text-[10px] text-gray-400">
                      {timeRange}h
                    </span>
                  </div>
                </div>
              </div>

              {/* Total */}
              <div className="flex-1 min-w-0 bg-white rounded-lg shadow-sm border border-gray-100 p-3 flex items-center gap-2.5">
                <div className="bg-blue-50 p-1.5 rounded-md shrink-0">
                  <Server size={14} className="text-blue-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-gray-900 tabular-nums leading-none">
                    {overview.total_devices}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Total</p>
                </div>
              </div>

              {/* Online */}
              <div className="flex-1 min-w-0 bg-white rounded-lg shadow-sm border border-gray-100 p-3 flex items-center gap-2.5">
                <div className="bg-green-50 p-1.5 rounded-md shrink-0">
                  <TrendingUp size={14} className="text-green-500" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="text-lg font-bold text-green-600 tabular-nums leading-none">
                      {overview.online}
                    </p>
                    <span className="text-[9px] font-semibold text-green-600 bg-green-50 px-1 py-px rounded">
                      {overview.total_devices > 0
                        ? Math.round(
                            (overview.online / overview.total_devices) * 100,
                          )
                        : 0}
                      %
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">Online</p>
                </div>
              </div>

              {/* Offline */}
              <div className="flex-1 min-w-0 bg-white rounded-lg shadow-sm border border-gray-100 p-3 flex items-center gap-2.5">
                <div className="bg-red-50 p-1.5 rounded-md shrink-0">
                  <TrendingDown size={14} className="text-red-500" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="text-lg font-bold text-red-600 tabular-nums leading-none">
                      {overview.offline}
                    </p>
                    <span className="text-[9px] font-semibold text-red-600 bg-red-50 px-1 py-px rounded">
                      {overview.total_devices > 0
                        ? Math.round(
                            (overview.offline / overview.total_devices) * 100,
                          )
                        : 0}
                      %
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">Offline</p>
                </div>
              </div>
            </div>

            {/* Latency + Best/Worst */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Latency */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-amber-50 p-2 rounded-lg">
                    <Zap size={16} className="text-amber-500" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-700">
                    Avg Latency
                  </h3>
                </div>
                <div className="text-center py-5">
                  <p
                    className={`text-5xl font-bold tabular-nums ${getLatencyColor(overview.average_latency)}`}
                  >
                    {overview.average_latency !== null
                      ? overview.average_latency
                      : "—"}
                  </p>
                  {overview.average_latency !== null && (
                    <p className="text-xs text-gray-400 mt-1">milliseconds</p>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1.5 mt-2 pt-3 border-t border-gray-100">
                  <div className="text-center">
                    <div className="w-2 h-2 rounded-full bg-green-500 mx-auto mb-1" />
                    <p className="text-[10px] text-gray-400">&lt;50ms</p>
                    <p className="text-[10px] font-medium text-gray-500">
                      Good
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-2 h-2 rounded-full bg-yellow-500 mx-auto mb-1" />
                    <p className="text-[10px] text-gray-400">&lt;100ms</p>
                    <p className="text-[10px] font-medium text-gray-500">OK</p>
                  </div>
                  <div className="text-center">
                    <div className="w-2 h-2 rounded-full bg-red-500 mx-auto mb-1" />
                    <p className="text-[10px] text-gray-400">&gt;100ms</p>
                    <p className="text-[10px] font-medium text-gray-500">
                      Slow
                    </p>
                  </div>
                </div>
              </div>

              {/* Best Uptime */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-green-50 p-2 rounded-lg">
                    <Shield size={16} className="text-green-500" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-700">
                    Best Uptime
                  </h3>
                </div>
                <div className="space-y-1.5">
                  {topDevices.map((d, i) => (
                    <div
                      key={d.device_id}
                      className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${i === 0 ? "bg-green-50" : "hover:bg-gray-50"}`}
                    >
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                          i === 0
                            ? "bg-green-500 text-white"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 truncate">
                          {d.device_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${d.uptime_percentage}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-green-600 tabular-nums w-10 text-right">
                          {d.uptime_percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                  {topDevices.length === 0 && (
                    <div className="text-center py-6">
                      <Wifi size={24} className="mx-auto mb-1 text-gray-300" />
                      <p className="text-xs text-gray-400">No data</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Worst Uptime */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-red-50 p-2 rounded-lg">
                    <AlertTriangle size={16} className="text-red-500" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-700">
                    Needs Attention
                  </h3>
                </div>
                <div className="space-y-1.5">
                  {worstDevices.map((d, i) => (
                    <div
                      key={d.device_id}
                      className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${i === 0 ? "bg-red-50" : "hover:bg-gray-50"}`}
                    >
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                          i === 0
                            ? "bg-red-500 text-white"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 truncate">
                          {d.device_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${getUptimeColor(d.uptime_percentage)}`}
                            style={{ width: `${d.uptime_percentage}%` }}
                          />
                        </div>
                        <span
                          className={`text-xs font-bold tabular-nums w-10 text-right ${getUptimeTextColor(d.uptime_percentage)}`}
                        >
                          {d.uptime_percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                  {worstDevices.length === 0 && (
                    <div className="text-center py-6">
                      <Wifi size={24} className="mx-auto mb-1 text-gray-300" />
                      <p className="text-xs text-gray-400">No data</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Uptime Bar Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="bg-indigo-50 p-2 rounded-lg">
                    <Activity size={16} className="text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700">
                      Uptime by Device
                    </h3>
                    <p className="text-[11px] text-gray-400">
                      Performance ranking
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-md">
                  {devicesReport.length} devices
                </span>
              </div>
              <div className="space-y-2.5">
                {devicesReport.map((device, index) => (
                  <div key={device.device_id} className="group">
                    <div className="flex items-center gap-3">
                      <div className="w-44 shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-gray-300 w-4 tabular-nums">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div className="min-w-0">
                            <p
                              className="text-[13px] text-gray-700 truncate group-hover:text-gray-900 transition-colors"
                              title={device.device_name}
                            >
                              {device.device_name}
                            </p>
                            <p className="text-[10px] text-gray-400 font-mono">
                              {device.ip_address}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 h-7 bg-gray-50 rounded-lg overflow-hidden relative border border-gray-100">
                        <div
                          className={`h-full rounded-lg ${getUptimeColor(device.uptime_percentage)} transition-all duration-500 flex items-center justify-end pr-2.5`}
                          style={{
                            width: `${Math.max(device.uptime_percentage, 3)}%`,
                          }}
                        >
                          {device.uptime_percentage >= 10 && (
                            <span className="text-[10px] text-white font-bold tabular-nums drop-shadow-sm">
                              {device.uptime_percentage}%
                            </span>
                          )}
                        </div>
                        {device.uptime_percentage < 10 && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-500 tabular-nums">
                            {device.uptime_percentage}%
                          </span>
                        )}
                      </div>
                      <div className="w-14 shrink-0 text-right">
                        <span
                          className={`text-[11px] font-semibold tabular-nums ${getLatencyColor(device.current_latency)}`}
                        >
                          {device.current_latency !== null
                            ? `${device.current_latency}ms`
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {devicesReport.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <Wifi size={20} className="text-gray-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-400">
                      No data available
                    </p>
                    <p className="text-xs text-gray-300 mt-0.5">
                      No device data found
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Devices Report Tab */}
        {activeTab === "devices" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
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

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase">
                        Device
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase">
                        IP Address
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-500 text-xs uppercase">
                        Status
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-500 text-xs uppercase">
                        Latency
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-500 text-xs uppercase">
                        Uptime
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-500 text-xs uppercase">
                        Checks
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-500 text-xs uppercase">
                        Online
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-500 text-xs uppercase">
                        Offline
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReport.map((r) => (
                      <tr
                        key={r.device_id}
                        className="border-b border-gray-100 hover:bg-blue-50/30 transition"
                      >
                        <td className="py-3 px-4 font-medium text-gray-800">
                          {r.device_name}
                        </td>
                        <td className="py-3 px-4 text-gray-500 font-mono text-xs">
                          {r.ip_address}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                              r.current_status === "Online"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                r.current_status === "Online"
                                  ? "bg-green-500"
                                  : "bg-red-500"
                              }`}
                            />
                            {r.current_status}
                          </span>
                        </td>
                        <td
                          className={`py-3 px-4 text-center text-xs font-semibold ${getLatencyColor(r.current_latency)}`}
                        >
                          {r.current_latency !== null
                            ? `${r.current_latency}ms`
                            : "N/A"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`font-bold text-sm ${getUptimeTextColor(r.uptime_percentage)}`}
                          >
                            {r.uptime_percentage}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-gray-500">
                          {r.total_checks}
                        </td>
                        <td className="py-3 px-4 text-center text-green-600 font-medium">
                          {r.online_checks}
                        </td>
                        <td className="py-3 px-4 text-center text-red-600 font-medium">
                          {r.offline_checks}
                        </td>
                      </tr>
                    ))}
                    {filteredReport.length === 0 && (
                      <tr>
                        <td
                          colSpan="8"
                          className="py-12 text-center text-gray-400"
                        >
                          <Wifi
                            size={32}
                            className="mx-auto mb-2 text-gray-300"
                          />
                          <p className="text-sm">No data available</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Downtime Log Tab */}
        {activeTab === "downtime" && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">
                Downtime Events
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Last {timeRange} hours
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase">
                      Device
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase">
                      IP Address
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase">
                      Started At
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase">
                      Ended At
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-500 text-xs uppercase">
                      Duration
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {downtimeLog.map((event, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-gray-100 hover:bg-red-50/20 transition"
                    >
                      <td className="py-3 px-4 font-medium text-gray-800">
                        {event.device_name}
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-mono text-xs">
                        {event.ip_address}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs">
                        {new Date(event.started_at).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {event.ended_at ? (
                          <span className="text-gray-500">
                            {new Date(event.ended_at).toLocaleString("en-IN", {
                              timeZone: "Asia/Kolkata",
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            Ongoing
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                            event.ended_at
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {event.duration_human}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {downtimeLog.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-12 text-center">
                        <CheckCircle
                          size={36}
                          className="mx-auto mb-2 text-green-300"
                        />
                        <p className="font-medium text-gray-600">All Clear!</p>
                        <p className="text-xs text-gray-400 mt-1">
                          No downtime events
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Reports;
