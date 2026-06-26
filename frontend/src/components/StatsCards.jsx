import { Monitor, Wifi, WifiOff, Activity } from "lucide-react";
import { useTheme } from "../routes/ThemeContext.jsx";

const StatsCards = ({ total, online, offline }) => {
  const { theme } = useTheme();

  const cards = [
    {
      title: "Total Devices",
      value: total,
      icon: <Monitor size={20} />,
      color: "bg-blue-500",
      textColor: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-900/30",
    },
    {
      title: "Online",
      value: online,
      icon: <Wifi size={20} />,
      color: "bg-green-500",
      textColor: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-900/30",
    },
    {
      title: "Offline",
      value: offline,
      icon: <WifiOff size={20} />,
      color: "bg-red-500",
      textColor: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-50 dark:bg-red-900/30",
    },
    {
      title: "Uptime",
      value: total > 0 ? `${Math.round((online / total) * 100)}%` : "0%",
      icon: <Activity size={20} />,
      color: "bg-orange-500",
      textColor: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-50 dark:bg-orange-900/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {cards.map((card) => (
        <div key={card.title} className={`rounded-xl shadow-sm border p-3 md:p-4 ${
          theme === "dark"
            ? "bg-slate-800 border-slate-700"
            : "bg-white border-gray-100"
        }`}>
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className={`text-[10px] md:text-xs font-medium uppercase tracking-wider truncate ${
                theme === "dark" ? "text-gray-500" : "text-gray-400"
              }`}>
                {card.title}
              </p>
              <p className={`text-xl md:text-2xl font-bold mt-1 tabular-nums ${card.textColor}`}>
                {card.value}
              </p>
            </div>
            <div className={`${card.bgColor} p-2 md:p-2.5 rounded-xl ${card.textColor} shrink-0`}>
              {card.icon}
            </div>
          </div>
          <div className={`${card.color} h-1 rounded-full mt-3`}></div>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;
