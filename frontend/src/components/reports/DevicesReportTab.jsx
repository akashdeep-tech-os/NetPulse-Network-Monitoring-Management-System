import { Wifi } from "lucide-react";

const DevicesReportTab = ({
  devices,
  selectedDevice,
  setSelectedDevice,
  filteredReport,
}) => {
  const getLatencyColor = (latency) => {
    if (latency === null) return "text-gray-400 dark:text-gray-500";
    if (latency < 50) return "text-green-600 dark:text-green-400";
    if (latency < 100) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getUptimeTextColor = (uptime) => {
    if (uptime >= 99) return "text-green-600 dark:text-green-400";
    if (uptime >= 95) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col h-full">
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-4 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase">
                Device
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase">
                IP Address
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase">
                Status
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase">
                Latency
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase">
                Uptime
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase">
                Checks
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase">
                Online
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase">
                Offline
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredReport.map((r) => (
              <tr
                key={r.device_id}
                className="border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition"
              >
                <td className="py-2.5 px-4 font-medium text-gray-800 dark:text-gray-200">
                  {r.device_name}
                </td>
                <td className="py-2.5 px-4 text-gray-500 dark:text-gray-400 font-mono text-xs">
                  {r.ip_address}
                </td>
                <td className="py-2.5 px-4 text-center">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      r.current_status === "Online"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                        : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
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
                  className={`py-2.5 px-4 text-center text-xs font-semibold ${getLatencyColor(r.current_latency)}`}
                >
                  {r.current_latency !== null
                    ? `${r.current_latency}ms`
                    : "N/A"}
                </td>
                <td className="py-2.5 px-4 text-center">
                  <span
                    className={`font-bold text-sm ${getUptimeTextColor(r.uptime_percentage)}`}
                  >
                    {r.uptime_percentage}%
                  </span>
                </td>
                <td className="py-2.5 px-4 text-center text-gray-500 dark:text-gray-400">
                  {r.total_checks}
                </td>
                <td className="py-2.5 px-4 text-center text-green-600 dark:text-green-400 font-medium">
                  {r.online_checks}
                </td>
                <td className="py-2.5 px-4 text-center text-red-600 dark:text-red-400 font-medium">
                  {r.offline_checks}
                </td>
              </tr>
            ))}
            {filteredReport.length === 0 && (
              <tr>
                <td colSpan="8" className="py-12 text-center text-gray-400 dark:text-gray-500">
                  <Wifi size={32} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm">No data available</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DevicesReportTab;
