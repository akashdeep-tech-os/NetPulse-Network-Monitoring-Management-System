import { Monitor, Wifi, WifiOff, Activity } from "lucide-react";

const StatsCards = ({ total, online, offline }) => {
  const cards = [
    {
      title: "Total Devices",
      value: total,
      icon: <Monitor size={24} />,
      color: "bg-blue-500",
      textColor: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Online",
      value: online,
      icon: <Wifi size={24} />,
      color: "bg-green-500",
      textColor: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Offline",
      value: offline,
      icon: <WifiOff size={24} />,
      color: "bg-red-500",
      textColor: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Uptime",
      value: total > 0 ? `${Math.round((online / total) * 100)}%` : "0%",
      icon: <Activity size={24} />,
      color: "bg-orange-500",
      textColor: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div key={card.title} className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{card.title}</p>
              <p className={`text-2xl font-bold mt-1 ${card.textColor}`}>
                {card.value}
              </p>
            </div>
            <div className={`${card.bgColor} p-3 rounded-lg ${card.textColor}`}>
              {card.icon}
            </div>
          </div>
          <div className={`${card.color} h-1.5 rounded-full mt-4`}></div>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;
