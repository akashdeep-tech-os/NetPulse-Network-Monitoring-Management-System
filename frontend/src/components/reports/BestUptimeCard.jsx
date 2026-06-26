import { Shield, Wifi } from "lucide-react";

const BestUptimeCard = ({ topDevices }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 md:p-5">
      <div className="flex items-center gap-2 mb-3 md:mb-4">
        <div className="bg-green-100 dark:bg-green-900/30 p-1.5 md:p-2 rounded-lg">
          <Shield size={16} className="text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Best Uptime</h3>
      </div>
      <div className="space-y-1.5">
        {topDevices.map((d, i) => (
          <div
            key={d.device_id}
            className={`flex items-center gap-2 md:gap-3 p-1.5 md:p-2 rounded-lg transition-colors ${i === 0 ? "bg-green-50 dark:bg-green-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-700/50"}`}
          >
            <span
              className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                i === 0
                  ? "bg-green-500 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
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
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${d.uptime_percentage}%` }}
                />
              </div>
              <span className="text-[10px] md:text-xs font-bold text-green-600 dark:text-green-400 tabular-nums w-9 md:w-10 text-right">
                {d.uptime_percentage}%
              </span>
            </div>
          </div>
        ))}
        {topDevices.length === 0 && (
          <div className="text-center py-6">
            <Wifi size={24} className="mx-auto mb-1 text-gray-300 dark:text-gray-600" />
            <p className="text-xs text-gray-400 dark:text-gray-500">No data</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BestUptimeCard;
