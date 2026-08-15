import { useState, useEffect } from "react";
import { ListChecks, RefreshCw, Search } from "lucide-react";
import DashboardLayout from "../layout/DashboardLayout";
import { getAuditLogs } from "../api.js";

const ACTION_COLORS = {
  "user.create": "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  "user.update": "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  "user.delete": "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  "organization.update": "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
  "device.create": "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400",
  "device.update": "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  "device.delete": "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  "check.run": "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
};

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await getAuditLogs(200);
      setLogs(res.data || []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filtered = logs.filter(
    (l) =>
      !searchQuery ||
      (l.action || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.resource || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.user_name || "").toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full gap-4 overflow-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
              <ListChecks size={20} className="text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Audit Logs
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Security and activity trail for your organization
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={14} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder:text-gray-400"
              />
            </div>
            <button
              onClick={fetchLogs}
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
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex-1 min-h-0 overflow-hidden">
          <div className="overflow-auto h-full">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 dark:bg-slate-700/50">
                  <th className="text-left py-3 px-4 font-semibold text-gray-400 dark:text-gray-500 text-[11px] uppercase">Action</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-400 dark:text-gray-500 text-[11px] uppercase hidden sm:table-cell">Resource</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-400 dark:text-gray-500 text-[11px] uppercase hidden md:table-cell">User</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-400 dark:text-gray-500 text-[11px] uppercase hidden lg:table-cell">IP Address</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-400 dark:text-gray-500 text-[11px] uppercase">Time</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-16 text-center text-gray-400 dark:text-gray-500">
                      <ListChecks size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No audit logs found</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((l) => (
                    <tr key={l.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50/50 dark:hover:bg-slate-700/30">
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${ACTION_COLORS[l.action] || "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400"}`}>
                          {l.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-gray-600 dark:text-gray-300 hidden sm:table-cell">
                        {l.resource}
                        {l.resource_id ? ` #${l.resource_id}` : ""}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-gray-500 dark:text-gray-400 hidden md:table-cell">
                        {l.user_name || "system"}
                      </td>
                      <td className="py-2.5 px-4 text-xs font-mono text-gray-400 dark:text-gray-500 hidden lg:table-cell">
                        {l.ip_address || "-"}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                        {new Date(l.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AuditLogs;