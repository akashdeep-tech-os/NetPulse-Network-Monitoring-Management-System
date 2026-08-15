import { useState, useEffect } from "react";
import {
  History,
  RefreshCw,
  Trash2,
  Mail,
  MessageSquare,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Wifi,
  WifiOff,
  Clock,
} from "lucide-react";
import DashboardLayout from "../layout/DashboardLayout";
import { getAlertLogs, clearAlertLogs, acknowledgeAlertLog, resolveAlertLog } from "../api.js";
import { useAuth } from "../routes/AuthContext.jsx";

const SEVERITY_CONFIG = {
  critical: {
    bg: "bg-red-50 dark:bg-red-900/20",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-700 dark:text-red-400",
    icon: <WifiOff size={14} className="text-red-500" />,
    badge: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  },
  warning: {
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
    border: "border-yellow-200 dark:border-yellow-800",
    text: "text-yellow-700 dark:text-yellow-400",
    icon: <AlertTriangle size={14} className="text-yellow-500" />,
    badge: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
  },
  info: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-700 dark:text-blue-400",
    icon: <CheckCircle size={14} className="text-blue-500" />,
    badge: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  },
};

const AlertHistory = () => {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("alerts.manage");

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [filter, setFilter] = useState("all");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await getAlertLogs(200);
      setLogs(res.data.logs || res.data);
    } catch (err) {
      console.error("Failed to fetch alert logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleClear = async () => {
    try {
      await clearAlertLogs();
      setClearConfirm(false);
      fetchLogs();
    } catch (err) {
      alert("Failed to clear alert logs");
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filter === "all") return true;
    return log.severity === filter;
  });

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  };

  const formatFullTime = (isoString) => {
    return new Date(isoString).toLocaleString();
  };

  const stats = {
    total: logs.length,
    critical: logs.filter((l) => l.severity === "critical").length,
    warning: logs.filter((l) => l.severity === "warning").length,
    info: logs.filter((l) => l.severity === "info").length,
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full gap-4 md:gap-5 overflow-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg">
              <History size={20} className="text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Alert History
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                View triggered alerts and notifications
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canManage && logs.length > 0 && (
              <button
                onClick={() => setClearConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
              >
                <Trash2 size={14} />
                Clear All
              </button>
            )}
            <button
              onClick={fetchLogs}
              className="p-1.5 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition"
              title="Refresh"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin text-blue-600" : "text-gray-600 dark:text-gray-300"}
              />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-3">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase">Total</p>
            <p className="text-xl font-bold text-gray-800 dark:text-white tabular-nums">{stats.total}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-3">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase">Critical</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400 tabular-nums">{stats.critical}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-3">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase">Warning</p>
            <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400 tabular-nums">{stats.warning}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-3">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase">Info</p>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">{stats.info}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
          {[
            { id: "all", label: "All" },
            { id: "critical", label: "Critical" },
            { id: "warning", label: "Warning" },
            { id: "info", label: "Info" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                filter === f.id
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Alert Logs */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex-1 min-h-0 overflow-auto">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <CheckCircle size={40} className="text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No alerts triggered</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Alerts will appear here when rules are triggered
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-700">
              {filteredLogs.map((log) => {
                const sev = SEVERITY_CONFIG[log.severity] || SEVERITY_CONFIG.info;
                return (
                  <div
                    key={log.id}
                    className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition ${sev.bg}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">{sev.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${sev.badge}`}
                          >
                            {log.severity.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {log.rule_name}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 dark:text-white mt-1">
                          {log.message}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400 dark:text-gray-500">
                          <span className="flex items-center gap-1" title={formatFullTime(log.created_at)}>
                            <Clock size={10} />
                            {formatTime(log.created_at)}
                          </span>
                          {log.device_name && (
                            <span className="flex items-center gap-1">
                              <Wifi size={10} />
                              {log.device_name} ({log.device_ip})
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            {(log.sent_channels || []).length > 0 ? (
                              log.sent_channels.map((ch) => (
                                <span key={ch} className="text-[10px] text-gray-400 dark:text-gray-500">
                                  {ch}
                                </span>
                              ))
                            ) : (
                              "No notifications sent"
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {log.status === "open" && canManage && (
                            <>
                              <button
                                onClick={async () => {
                                  await acknowledgeAlertLog(log.id);
                                  fetchLogs();
                                }}
                                className="px-2 py-1 text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition font-medium"
                              >
                                Acknowledge
                              </button>
                              <button
                                onClick={async () => {
                                  await resolveAlertLog(log.id);
                                  fetchLogs();
                                }}
                                className="px-2 py-1 text-[10px] bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-lg transition font-medium"
                              >
                                Resolve
                              </button>
                            </>
                          )}
                          {log.status !== "open" && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                log.status === "resolved"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              }`}
                            >
                              {log.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Clear Confirmation */}
        {clearConfirm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="text-center">
                <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full inline-block mb-4">
                  <Trash2 size={24} className="text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">
                  Clear Alert History
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  This will permanently delete all {logs.length} alert log entries.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setClearConfirm(false)}
                    className="flex-1 px-4 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg font-medium text-sm transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClear}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium text-sm transition"
                  >
                    Clear All
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

export default AlertHistory;
