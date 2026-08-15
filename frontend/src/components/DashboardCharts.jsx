import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useTheme } from "../routes/ThemeContext.jsx";

const STATUS_COLORS = { Online: "#22c55e", Offline: "#ef4444", Warning: "#f59e0b", Unknown: "#94a3b8" };

const tooltipStyle = (theme) => ({
  backgroundColor: theme === "dark" ? "#1e293b" : "#ffffff",
  border: `1px solid ${theme === "dark" ? "#334155" : "#e5e7eb"}`,
  borderRadius: "8px",
  fontSize: "12px",
  color: theme === "dark" ? "#e2e8f0" : "#1e293b",
});

const cardCls = (theme) =>
  `rounded-xl border shadow-sm p-4 ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"}`;

const titleCls = (theme) =>
  `text-xs font-semibold uppercase tracking-wider mb-3 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`;

export const AvailabilityChart = ({ data }) => {
  const { theme } = useTheme();
  return (
    <div className={cardCls(theme)}>
      <h3 className={titleCls(theme)}>Availability (last 24h)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="availGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#334155" : "#e5e7eb"} />
          <XAxis dataKey="timestamp" tick={{ fontSize: 10, fill: theme === "dark" ? "#94a3b8" : "#64748b" }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: theme === "dark" ? "#94a3b8" : "#64748b" }} />
          <Tooltip contentStyle={tooltipStyle(theme)} />
          <Area type="monotone" dataKey="availability" name="Availability %" stroke="#3b82f6" fill="url(#availGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const LatencyChart = ({ data }) => {
  const { theme } = useTheme();
  return (
    <div className={cardCls(theme)}>
      <h3 className={titleCls(theme)}>Average Latency (ms)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#334155" : "#e5e7eb"} />
          <XAxis dataKey="timestamp" tick={{ fontSize: 10, fill: theme === "dark" ? "#94a3b8" : "#64748b" }} />
          <YAxis tick={{ fontSize: 10, fill: theme === "dark" ? "#94a3b8" : "#64748b" }} />
          <Tooltip contentStyle={tooltipStyle(theme)} />
          <Line type="monotone" dataKey="latency" name="Latency ms" stroke="#8b5cf6" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const PacketLossChart = ({ data }) => {
  const { theme } = useTheme();
  return (
    <div className={cardCls(theme)}>
      <h3 className={titleCls(theme)}>Packet Loss (%)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#334155" : "#e5e7eb"} />
          <XAxis dataKey="timestamp" tick={{ fontSize: 10, fill: theme === "dark" ? "#94a3b8" : "#64748b" }} />
          <YAxis tick={{ fontSize: 10, fill: theme === "dark" ? "#94a3b8" : "#64748b" }} />
          <Tooltip contentStyle={tooltipStyle(theme)} />
          <Line type="monotone" dataKey="packet_loss" name="Packet loss %" stroke="#f59e0b" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const StatusDonut = ({ distribution }) => {
  const { theme } = useTheme();
  const byStatus = distribution?.by_status || {};
  const data = Object.entries(byStatus).map(([name, value]) => ({ name, value }));
  return (
    <div className={cardCls(theme)}>
      <h3 className={titleCls(theme)}>Device Status</h3>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[200px] text-xs text-gray-400">No devices</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#94a3b8"} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle(theme)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export const ProblemDevicesCard = ({ devices }) => {
  const { theme } = useTheme();
  const severityCls = {
    Critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    High: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    Medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    Low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };
  return (
    <div className={cardCls(theme)}>
      <h3 className={titleCls(theme)}>Top Problem Devices</h3>
      {devices.length === 0 ? (
        <div className="flex items-center justify-center h-[200px] text-xs text-gray-400">All clear</div>
      ) : (
        <div className="space-y-2.5">
          {devices.map((d) => (
            <div key={d.device_id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className={`text-xs font-semibold truncate ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
                  {d.device_name}
                </p>
                <p className="text-[10px] text-gray-400 font-mono">{d.ip_address}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-gray-400">{d.downtime_percent}% down</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${severityCls[d.severity] || severityCls.Low}`}>
                  {d.severity}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
