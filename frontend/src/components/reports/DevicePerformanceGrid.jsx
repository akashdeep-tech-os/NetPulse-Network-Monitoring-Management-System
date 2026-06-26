import { Wifi } from "lucide-react";

const DevicePerformanceGrid = ({ devicesReport }) => {
  const getUptimeBg = (uptime) => {
    if (uptime >= 99) return "bg-green-500";
    if (uptime >= 95) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getLatencyBg = (latency) => {
    if (latency === null) return "bg-gray-200 dark:bg-gray-700";
    if (latency < 50) return "bg-green-400";
    if (latency < 100) return "bg-yellow-400";
    return "bg-red-400";
  };

  const sorted = [...devicesReport].sort((a, b) => b.uptime_percentage - a.uptime_percentage);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 flex flex-col flex-1 min-h-0">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Device Performance
          </span>
        </div>
        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
          {devicesReport.length} devices
        </span>
      </div>

      <div className="overflow-auto flex-1 p-3">
        {devicesReport.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <Wifi size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No data available</p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_60px_50px_50px_50px] md:grid-cols-[1fr_80px_60px_60px_60px] gap-2 px-2 py-1 text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              <span>Device</span>
              <span className="text-right">Uptime</span>
              <span className="text-center">Status</span>
              <span className="text-center">Latency</span>
              <span className="text-center">Checks</span>
            </div>

            {/* Device Rows */}
            {sorted.map((d, i) => (
              <div
                key={d.device_id}
                className="grid grid-cols-[1fr_60px_50px_50px_50px] md:grid-cols-[1fr_80px_60px_60px_60px] gap-2 items-center px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
              >
                {/* Device Name */}
                <div className="min-w-0">
                  <p className="text-[11px] md:text-xs font-medium text-gray-700 dark:text-gray-300 truncate group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    {d.device_name}
                  </p>
                  <p className="text-[9px] text-gray-400 dark:text-gray-500 font-mono truncate">
                    {d.ip_address}
                  </p>
                </div>

                {/* Uptime Bar */}
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getUptimeBg(d.uptime_percentage)} transition-all duration-500`}
                      style={{ width: `${Math.max(d.uptime_percentage, 2)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 tabular-nums w-8 text-right">
                    {d.uptime_percentage}%
                  </span>
                </div>

                {/* Status Dot */}
                <div className="flex justify-center">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      d.current_status === "Online" ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                </div>

                {/* Latency */}
                <div className="flex justify-center">
                  <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 tabular-nums">
                    {d.current_latency !== null ? `${d.current_latency}` : "—"}
                  </span>
                </div>

                {/* Checks */}
                <div className="flex justify-center">
                  <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 tabular-nums">
                    {d.online_checks}/{d.total_checks}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DevicePerformanceGrid;
