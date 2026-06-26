import { useEffect, useState } from "react";

const StatusDonut = ({ devicesReport }) => {
  const [mounted, setMounted] = useState(false);
  const online = devicesReport.filter((d) => d.current_status === "Online").length;
  const offline = devicesReport.filter((d) => d.current_status === "Offline").length;
  const total = devicesReport.length;
  const percent = total > 0 ? Math.round((online / total) * 100) : 0;

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const onlineDash = mounted ? (online / total) * circumference : 0;
  const offlineDash = mounted ? (offline / total) * circumference : 0;
  const onlineOffset = 0;
  const offlineOffset = -onlineDash;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 h-full flex flex-col">
      <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
        Status Overview
      </span>

      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        {/* Donut */}
        <div className="relative w-32 h-32">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
            {/* Background */}
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              className="stroke-gray-100 dark:stroke-gray-700"
              strokeWidth="10"
            />
            {/* Online arc */}
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke="url(#onlineGradient)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={onlineOffset}
              className="transition-all duration-1000 ease-out"
            />
            {/* Offline arc */}
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke="url(#offlineGradient)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offlineOffset}
              className="transition-all duration-1000 ease-out"
            />
            <defs>
              <linearGradient id="onlineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
              <linearGradient id="offlineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#f43f5e" />
              </linearGradient>
            </defs>
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-gray-800 dark:text-white tabular-nums">
              {percent}
            </span>
            <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 -mt-0.5">% Online</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-500" />
            <div>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200 tabular-nums">{online}</p>
              <p className="text-[9px] text-gray-400 dark:text-gray-500">Online</p>
            </div>
          </div>
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-red-500 to-rose-500" />
            <div>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200 tabular-nums">{offline}</p>
              <p className="text-[9px] text-gray-400 dark:text-gray-500">Offline</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusDonut;
