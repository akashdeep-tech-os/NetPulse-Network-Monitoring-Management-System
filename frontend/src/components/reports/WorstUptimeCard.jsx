import { AlertTriangle, Wifi } from "lucide-react";

const WorstUptimeCard = ({ worstDevices }) => {
  const getUptimeColor = (uptime) => {
    if (uptime >= 99) return "bg-green-500";
    if (uptime >= 95) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getUptimeTextColor = (uptime) => {
    if (uptime >= 99) return "text-green-600 dark:text-green-400";
    if (uptime >= 95) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 md:p-5">
      <div className="flex items-center gap-2 mb-3 md:mb-4">
        <div className="bg-red-100 dark:bg-red-900/30 p-1.5 md:p-2 rounded-lg">
          <AlertTriangle size={16} className="text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Needs Attention</h3>
      </div>
      <div className="space-y-1.5">
        {worstDevices.map((d, i) => (
          <div
            key={d.device_id}
            className={`flex items-center gap-2 md:gap-3 p-1.5 md:p-2 rounded-lg transition-colors ${i === 0 ? "bg-red-50 dark:bg-red-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-700/50"}`}
          >
            <span
              className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                i === 0 ? "bg-red-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
              }`}
            >
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] md:text-sm text-gray-700 dark:text-gray-300 truncate">
                {d.device_name}
              </p>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
              <div className="w-12 md:w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${getUptimeColor(d.uptime_percentage)}`}
                  style={{ width: `${d.uptime_percentage}%` }}
                />
              </div>
              <span
                className={`text-[10px] md:text-xs font-bold tabular-nums w-9 md:w-10 text-right ${getUptimeTextColor(d.uptime_percentage)}`}
              >
                {d.uptime_percentage}%
              </span>
            </div>
          </div>
        ))}
        {worstDevices.length === 0 && (
          <div className="text-center py-6">
            <Wifi size={24} className="mx-auto mb-1 text-gray-300 dark:text-gray-600" />
            <p className="text-xs text-gray-400 dark:text-gray-500">No data</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorstUptimeCard;
