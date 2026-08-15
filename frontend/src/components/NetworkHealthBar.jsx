import { useEffect, useState } from "react";
import { Activity, Wifi, WifiOff } from "lucide-react";

const NetworkHealthBar = ({ total, online, offline }) => {
  const [animatedPercent, setAnimatedPercent] = useState(0);
  const [mounted, setMounted] = useState(false);

  const percent = total > 0 ? Math.round((online / total) * 100) : 0;

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => setAnimatedPercent(percent), 100);
    return () => clearTimeout(timer);
  }, [percent]);

  const getBarGradient = () => {
    if (percent >= 80) return "from-emerald-400 via-green-500 to-teal-500";
    if (percent >= 50) return "from-amber-400 via-orange-500 to-yellow-500";
    return "from-red-400 via-rose-500 to-pink-500";
  };

  const getBarGlow = () => {
    if (percent >= 80) return "shadow-[0_0_20px_rgba(34,197,94,0.4)]";
    if (percent >= 50) return "shadow-[0_0_20px_rgba(249,115,22,0.4)]";
    return "shadow-[0_0_20px_rgba(239,68,68,0.4)]";
  };

  const getTextColor = () => {
    if (percent >= 80) return "text-emerald-500 dark:text-emerald-400";
    if (percent >= 50) return "text-orange-500 dark:text-orange-400";
    return "text-red-500 dark:text-red-400";
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 md:p-5 mb-4 overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-2xl" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 relative">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-xl shadow-lg shadow-blue-500/20">
              <Activity size={18} className="text-white" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white dark:border-gray-800 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
              Network Health
            </h3>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
              Real-time monitoring status
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Live
          </span>
        </div>
      </div>

      {/* Progress Section */}
      <div className="relative mb-4">
        <div className="flex items-end justify-between mb-2">
          <div className="flex items-baseline gap-2">
            <span
              className={`text-4xl md:text-5xl font-black tabular-nums tracking-tight ${getTextColor()} transition-all duration-1000`}
            >
              {animatedPercent}
            </span>
            <span className="text-lg font-bold text-gray-300 dark:text-gray-600">%</span>
          </div>
          <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
            {online} of {total} devices online
          </span>
        </div>

        {/* Track */}
        <div className="relative h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          {/* Animated shimmer */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />

          {/* Fill */}
          <div
            className={`h-full rounded-full bg-gradient-to-r ${getBarGradient()} ${getBarGlow()} transition-all duration-1000 ease-out relative`}
            style={{ width: mounted ? `${animatedPercent}%` : "0%" }}
          >
            {/* Inner glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-full" />

            {/* Edge highlight */}
            <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/40 rounded-full" />
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2.5 bg-green-50 dark:bg-green-900/20 rounded-xl px-3 py-2.5 border border-green-100 dark:border-green-800/30">
          <div className="w-8 h-8 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center">
            <Wifi size={16} className="text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-green-600 dark:text-green-400 tabular-nums">{online}</p>
            <p className="text-[10px] font-medium text-green-500/70 dark:text-green-400/50 uppercase tracking-wider">Online</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2.5 border border-red-100 dark:border-red-800/30">
          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/40 rounded-lg flex items-center justify-center">
            <WifiOff size={16} className="text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">{offline}</p>
            <p className="text-[10px] font-medium text-red-500/70 dark:text-red-400/50 uppercase tracking-wider">Offline</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkHealthBar;
