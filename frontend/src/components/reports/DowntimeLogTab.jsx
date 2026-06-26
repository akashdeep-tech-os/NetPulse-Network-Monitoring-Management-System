import { CheckCircle } from "lucide-react";

const DowntimeLogTab = ({ downtimeLog, timeRange }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col flex-1 min-h-0">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Downtime Events
            </h3>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
              Last {timeRange} hours
            </p>
          </div>
          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
            {downtimeLog.length}
          </span>
        </div>
      </div>
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-4 font-semibold text-gray-500 dark:text-gray-400 text-[11px] uppercase">
                Device
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-500 dark:text-gray-400 text-[11px] uppercase hidden sm:table-cell">
                IP Address
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-500 dark:text-gray-400 text-[11px] uppercase">
                Started
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-500 dark:text-gray-400 text-[11px] uppercase hidden md:table-cell">
                Ended
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-500 dark:text-gray-400 text-[11px] uppercase">
                Duration
              </th>
            </tr>
          </thead>
          <tbody>
            {downtimeLog.map((event, idx) => (
              <tr
                key={idx}
                className="border-b border-gray-100 dark:border-gray-700 hover:bg-red-50/20 dark:hover:bg-red-900/10 transition"
              >
                <td className="py-2.5 px-4 font-medium text-gray-800 dark:text-gray-200">
                  {event.device_name}
                </td>
                <td className="py-2.5 px-4 text-gray-500 dark:text-gray-400 font-mono text-xs hidden sm:table-cell">
                  {event.ip_address}
                </td>
                <td className="py-2.5 px-4 text-gray-500 dark:text-gray-400 text-[11px] md:text-xs">
                  {new Date(event.started_at).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="py-2.5 px-4 text-[11px] md:text-xs hidden md:table-cell">
                  {event.ended_at ? (
                    <span className="text-gray-500 dark:text-gray-400">
                      {new Date(event.ended_at).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      Ongoing
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-center">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] md:text-xs font-bold ${
                      event.ended_at
                        ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                        : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                    }`}
                  >
                    {event.duration_human}
                  </span>
                </td>
              </tr>
            ))}
            {downtimeLog.length === 0 && (
              <tr>
                <td colSpan="5" className="py-16 text-center">
                  <div className="w-14 h-14 bg-green-50 dark:bg-green-900/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <CheckCircle size={28} className="text-green-400 dark:text-green-500" />
                  </div>
                  <p className="font-medium text-gray-600 dark:text-gray-300">All Clear!</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    No downtime events
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DowntimeLogTab;
