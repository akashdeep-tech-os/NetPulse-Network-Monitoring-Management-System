import { Activity, Wifi } from "lucide-react";

const UptimeBarChart = ({ devicesReport }) => {
  const getUptimeColor = (uptime) => {
    if (uptime >= 99) return "bg-green-500";
    if (uptime >= 95) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getLatencyColor = (latency) => {
    if (latency === null) return "text-gray-400 dark:text-gray-500";
    if (latency < 50) return "text-green-600 dark:text-green-400";
    if (latency < 100) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col flex-1 min-h-0">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-1.5 rounded-lg">
              <Activity size={16} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Uptime by Device
              </h3>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">Performance ranking</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
            {devicesReport.length}
          </span>
        </div>
      </div>
      <div className="overflow-auto flex-1 p-4">
        <div className="space-y-2">
          {devicesReport.map((device, index) => (
            <div key={device.device_id} className="group">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-28 md:w-44 shrink-0">
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <span className="text-[10px] font-bold text-gray-300 dark:text-gray-600 w-4 tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p
                        className="text-[12px] md:text-[13px] text-gray-700 dark:text-gray-300 truncate group-hover:text-gray-900 dark:group-hover:text-white transition-colors"
                        title={device.device_name}
                      >
                        {device.device_name}
                      </p>
                      <p className="text-[9px] md:text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                        {device.ip_address}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 h-6 md:h-7 bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden relative border border-gray-100 dark:border-gray-600">
                  <div
                    className={`h-full rounded-lg ${getUptimeColor(device.uptime_percentage)} transition-all duration-500 flex items-center justify-end pr-2`}
                    style={{
                      width: `${Math.max(device.uptime_percentage, 3)}%`,
                    }}
                  >
                    {device.uptime_percentage >= 10 && (
                      <span className="text-[9px] md:text-[10px] text-white font-bold tabular-nums drop-shadow-sm">
                        {device.uptime_percentage}%
                      </span>
                    )}
                  </div>
                  {device.uptime_percentage < 10 && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] md:text-[10px] font-bold text-gray-500 dark:text-gray-400 tabular-nums">
                      {device.uptime_percentage}%
                    </span>
                  )}
                </div>
                <div className="w-12 md:w-14 shrink-0 text-right">
                  <span
                    className={`text-[10px] md:text-[11px] font-semibold tabular-nums ${getLatencyColor(device.current_latency)}`}
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
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Wifi size={20} className="text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-sm font-medium text-gray-400 dark:text-gray-500">
                No data available
              </p>
              <p className="text-xs text-gray-300 dark:text-gray-600 mt-0.5">No device data found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UptimeBarChart;
