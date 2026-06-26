import { useState } from "react";
import { Search, Play, Loader2 } from "lucide-react";
import { scanPorts } from "../api.js";
import DashboardLayout from "../layout/DashboardLayout";

const SERVICES = {
  21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS",
  80: "HTTP", 110: "POP3", 143: "IMAP", 443: "HTTPS", 445: "SMB",
  993: "IMAPS", 995: "POP3S", 1433: "MSSQL", 3306: "MySQL",
  3389: "RDP", 5432: "PostgreSQL", 5900: "VNC", 6379: "Redis",
  8080: "HTTP-Alt", 8443: "HTTPS-Alt", 27017: "MongoDB",
};

const PortScanner = () => {
  const [targetIP, setTargetIP] = useState("");
  const [startPort, setStartPort] = useState("1");
  const [endPort, setEndPort] = useState("5000");
  const [threads, setThreads] = useState("200");
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState(0);

  const handleScan = async () => {
    if (!targetIP.trim()) {
      alert("Enter a target IP");
      return;
    }

    setScanning(true);
    setResults(null);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 2, 95));
    }, 500);

    try {
      const res = await scanPorts({
        target_ip: targetIP.trim(),
        start_port: parseInt(startPort),
        end_port: parseInt(endPort),
        threads: parseInt(threads),
      });
      setResults(res.data);
      setProgress(100);
    } catch (err) {
      alert(err.response?.data?.detail || "Scan failed");
    } finally {
      clearInterval(progressInterval);
      setScanning(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full gap-4">
        {/* Input Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded-lg">
              <Search size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">
              Port Scanner
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <div className="col-span-2 md:col-span-1">
              <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                Target IP
              </label>
              <input
                type="text"
                value={targetIP}
                onChange={(e) => setTargetIP(e.target.value)}
                placeholder="192.168.1.1"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                Start Port
              </label>
              <input
                type="number"
                value={startPort}
                onChange={(e) => setStartPort(e.target.value)}
                min="1"
                max="65535"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                End Port
              </label>
              <input
                type="number"
                value={endPort}
                onChange={(e) => setEndPort(e.target.value)}
                min="1"
                max="65535"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                Threads
              </label>
              <input
                type="number"
                value={threads}
                onChange={(e) => setThreads(e.target.value)}
                min="1"
                max="500"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
              />
            </div>
            <button
              onClick={handleScan}
              disabled={scanning}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition ${
                scanning
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {scanning ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Scanning
                </>
              ) : (
                <>
                  <Play size={16} /> Scan
                </>
              )}
            </button>
          </div>

          {/* Progress Bar */}
          {scanning && (
            <div className="mt-4">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                Scanning ports...
              </p>
            </div>
          )}
        </div>

        {/* Results */}
        {results && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex-1 flex flex-col overflow-hidden">
            {/* Summary */}
            <div className="px-4 md:px-6 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Target: <span className="font-mono text-blue-600 dark:text-blue-400">{results.target_ip}</span>
              </span>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span className="text-gray-500 dark:text-gray-400">
                Scanned: <strong className="text-gray-700 dark:text-gray-200">{results.total_scanned.toLocaleString()}</strong>
              </span>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span className="text-gray-500 dark:text-gray-400">
                Open: <strong className="text-green-600 dark:text-green-400">{results.open_ports.length}</strong>
              </span>
              <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">|</span>
              <span className="text-gray-500 dark:text-gray-400 hidden sm:inline">
                Time: <strong className="text-gray-700 dark:text-gray-200">{results.scan_time}s</strong>
              </span>
            </div>

            {/* Table */}
            <div className="overflow-auto flex-1">
              {results.open_ports.length > 0 ? (
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0">
                    <tr>
                      <th className="px-4 md:px-6 py-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase w-12 text-center">
                        #
                      </th>
                      <th className="px-4 md:px-6 py-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase w-20">
                        Port
                      </th>
                      <th className="px-4 md:px-6 py-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase w-28 hidden sm:table-cell">
                        Service
                      </th>
                      <th className="px-4 md:px-6 py-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase">
                            Banner
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.open_ports.map((p, idx) => (
                      <tr
                        key={p.port}
                        className="border-b border-gray-100 dark:border-gray-700 hover:bg-green-50/50 dark:hover:bg-green-900/10 transition"
                      >
                        <td className="px-4 md:px-6 py-2.5 text-xs text-gray-400 dark:text-gray-500 text-center">
                          {idx + 1}
                        </td>
                        <td className="px-4 md:px-6 py-2.5 text-sm font-mono font-semibold text-green-700 dark:text-green-400">
                          {p.port}
                        </td>
                        <td className="px-4 md:px-6 py-2.5 text-xs text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                          {p.service || "-"}
                        </td>
                        <td className="px-4 md:px-6 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-mono truncate max-w-[200px] md:max-w-md">
                          {p.banner || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 py-12">
                  <div className="text-center">
                    <Search size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No open ports found</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!results && !scanning && (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
            <div className="text-center">
              <Search size={48} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">Enter a target IP and click Scan</p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PortScanner;
