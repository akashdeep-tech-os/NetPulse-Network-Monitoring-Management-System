import { Zap } from "lucide-react";

const LatencyCard = ({ averageLatency }) => {
  const getLatencyColor = (latency) => {
    if (latency === null) return "text-gray-400 dark:text-gray-500";
    if (latency < 50) return "text-green-600 dark:text-green-400";
    if (latency < 100) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 md:p-5">
      <div className="flex items-center gap-2 mb-3 md:mb-4">
        <div className="bg-amber-100 dark:bg-amber-900/30 p-1.5 md:p-2 rounded-lg">
          <Zap size={16} className="text-amber-600 dark:text-amber-400" />
        </div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Avg Latency</h3>
      </div>
      <div className="text-center py-3 md:py-5">
        <p
          className={`text-4xl md:text-5xl font-bold tabular-nums ${getLatencyColor(averageLatency)}`}
        >
          {averageLatency !== null ? averageLatency : "—"}
        </p>
        {averageLatency !== null && (
          <p className="text-[10px] md:text-xs text-gray-400 dark:text-gray-500 mt-1">
            milliseconds
          </p>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1 md:gap-1.5 mt-2 pt-3 border-t border-gray-100 dark:border-gray-700">
        <div className="text-center">
          <div className="w-2 h-2 rounded-full bg-green-500 mx-auto mb-1" />
          <p className="text-[9px] md:text-[10px] text-gray-400 dark:text-gray-500">&lt;50ms</p>
          <p className="text-[9px] md:text-[10px] font-medium text-gray-500 dark:text-gray-400">
            Good
          </p>
        </div>
        <div className="text-center">
          <div className="w-2 h-2 rounded-full bg-yellow-500 mx-auto mb-1" />
          <p className="text-[9px] md:text-[10px] text-gray-400 dark:text-gray-500">&lt;100ms</p>
          <p className="text-[9px] md:text-[10px] font-medium text-gray-500 dark:text-gray-400">
            OK
          </p>
        </div>
        <div className="text-center">
          <div className="w-2 h-2 rounded-full bg-red-500 mx-auto mb-1" />
          <p className="text-[9px] md:text-[10px] text-gray-400 dark:text-gray-500">&gt;100ms</p>
          <p className="text-[9px] md:text-[10px] font-medium text-gray-500 dark:text-gray-400">
            Slow
          </p>
        </div>
      </div>
    </div>
  );
};

export default LatencyCard;
