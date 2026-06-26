import { Wifi, WifiOff, Zap, Clock, TrendingUp, TrendingDown } from "lucide-react";

const OverviewStats = ({ overview, devicesReport }) => {
  const online = devicesReport.filter((d) => d.current_status === "Online").length;
  const offline = devicesReport.filter((d) => d.current_status === "Offline").length;
  const total = devicesReport.length;
  const avgUptime = total > 0
    ? (devicesReport.reduce((sum, d) => sum + d.uptime_percentage, 0) / total).toFixed(1)
    : 0;
  const goodLatency = devicesReport.filter((d) => d.current_latency !== null && d.current_latency < 50).length;
  const warnLatency = devicesReport.filter((d) => d.current_latency !== null && d.current_latency >= 50 && d.current_latency < 100).length;
  const slowLatency = devicesReport.filter((d) => d.current_latency !== null && d.current_latency >= 100).length;

  const stats = [
    {
      label: "Avg Latency",
      value: overview.average_latency !== null ? `${overview.average_latency}` : "—",
      unit: "ms",
      icon: <Zap size={14} />,
      gradient: "from-amber-500 to-orange-500",
      bg: "bg-amber-50 dark:bg-amber-900/20",
      text: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Avg Uptime",
      value: avgUptime,
      unit: "%",
      icon: <Clock size={14} />,
      gradient: "from-blue-500 to-indigo-500",
      bg: "bg-blue-50 dark:bg-blue-900/20",
      text: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Online",
      value: online,
      unit: `/ ${total}`,
      icon: <Wifi size={14} />,
      gradient: "from-green-500 to-emerald-500",
      bg: "bg-green-50 dark:bg-green-900/20",
      text: "text-green-600 dark:text-green-400",
    },
    {
      label: "Offline",
      value: offline,
      unit: `/ ${total}`,
      icon: <WifiOff size={14} />,
      gradient: "from-red-500 to-rose-500",
      bg: "bg-red-50 dark:bg-red-900/20",
      text: "text-red-600 dark:text-red-400",
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`${s.bg} p-1.5 rounded-lg ${s.text}`}>
                {s.icon}
              </div>
              <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                {s.label}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-black tabular-nums ${s.text}`}>
                {s.value}
              </span>
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                {s.unit}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Latency Distribution */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Latency Distribution
          </span>
        </div>
        <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
          <div
            className="bg-green-500 rounded-full transition-all duration-700"
            style={{ width: total > 0 ? `${(goodLatency / total) * 100}%` : "0%" }}
          />
          <div
            className="bg-yellow-500 rounded-full transition-all duration-700"
            style={{ width: total > 0 ? `${(warnLatency / total) * 100}%` : "0%" }}
          />
          <div
            className="bg-red-500 rounded-full transition-all duration-700"
            style={{ width: total > 0 ? `${(slowLatency / total) * 100}%` : "0%" }}
          />
        </div>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[10px] text-gray-500 dark:text-gray-400">&lt;50ms ({goodLatency})</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-[10px] text-gray-500 dark:text-gray-400">50-100ms ({warnLatency})</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[10px] text-gray-500 dark:text-gray-400">&gt;100ms ({slowLatency})</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewStats;
