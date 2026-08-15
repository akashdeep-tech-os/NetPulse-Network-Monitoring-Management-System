import { Monitor, Wifi, WifiOff, Activity, HeartPulse, AlertTriangle, Gauge } from "lucide-react";
import { useTheme } from "../routes/ThemeContext.jsx";

const StatsCards = ({ kpis = {}, health }) => {
  const { theme } = useTheme();

  const cards = [
    {
      title: "Total Devices",
      value: kpis.total_devices ?? 0,
      icon: <Monitor size={20} />,
      color: "bg-blue-500",
      textColor: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-900/30",
    },
    {
      title: "Online",
      value: kpis.online_devices ?? 0,
      icon: <Wifi size={20} />,
      color: "bg-green-500",
      textColor: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-900/30",
    },
    {
      title: "Offline",
      value: kpis.offline_devices ?? 0,
      icon: <WifiOff size={20} />,
      color: "bg-red-500",
      textColor: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-50 dark:bg-red-900/30",
    },
    {
      title: "Uptime",
      value: kpis.overall_uptime != null ? `${kpis.overall_uptime}%` : "0%",
      icon: <Activity size={20} />,
      color: "bg-orange-500",
      textColor: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-50 dark:bg-orange-900/30",
    },
    {
      title: "Avg Latency",
      value: kpis.avg_latency != null ? `${kpis.avg_latency} ms` : "-",
      icon: <Gauge size={20} />,
      color: "bg-violet-500",
      textColor: "text-violet-600 dark:text-violet-400",
      bgColor: "bg-violet-50 dark:bg-violet-900/30",
    },
    {
      title: "Active Alerts",
      value: kpis.active_alerts ?? 0,
      icon: <AlertTriangle size={20} />,
      color: "bg-amber-500",
      textColor: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-900/30",
    },
    {
      title: "Health Score",
      value: health?.score != null ? `${health.score}/100` : "-",
      icon: <HeartPulse size={20} />,
      color: "bg-emerald-500",
      textColor: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-900/30",
    },
    {
      title: "Packet Loss",
      value: kpis.packet_loss != null ? `${kpis.packet_loss}%` : "-",
      icon: <Activity size={20} />,
      color: "bg-cyan-500",
      textColor: "text-cyan-600 dark:text-cyan-400",
      bgColor: "bg-cyan-50 dark:bg-cyan-900/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`rounded-xl shadow-sm border p-3 ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"}`}
        >
          <div className={`${card.bgColor} p-2 rounded-xl ${card.textColor} inline-block mb-2`}>{card.icon}</div>
          <p className={`text-[10px] font-medium uppercase tracking-wider truncate ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>
            {card.title}
          </p>
          <p className={`text-lg md:text-xl font-bold tabular-nums ${card.textColor}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;
