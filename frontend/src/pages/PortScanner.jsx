import { useState } from "react";
import { Search, Play, Square, Loader2 } from "lucide-react";
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

    const total = parseInt(endPort) - parseInt(startPort) + 1;
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
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Search size={20} className="text-blue-600" />
            <h2 className="text-lg font-bold text-gray-800">Port Scanner</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Target IP</label>
              <input
                type="text"
                value={targetIP}
                onChange={(e) => setTargetIP(e.target.value)}
                placeholder="e.g. 192.168.1.1"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Start Port</label>
              <input
                type="number"
                value={startPort}
                onChange={(e) => setStartPort(e.target.value)}
                min="1"
                max="65535"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">End Port</label>
              <input
                type="number"
                value={endPort}
                onChange={(e) => setEndPort(e.target.value)}
                min="1"
                max="65535"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Threads</label>
              <input
                type="number"
                value={threads}
                onChange={(e) => setThreads(e.target.value)}
                min="1"
                max="500"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
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
                  <Loader2 size={16} className="animate-spin" /> Scanning...
                </>
              ) : (
                <>
                  <Play size={16} /> Start Scan
                </>
              )}
            </button>
          </div>

          {/* Progress Bar */}
          {scanning && (
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Scanning {parseInt(startPort).toLocaleString()} - {parseInt(endPort).toLocaleString()} ({(parseInt(endPort) - parseInt(startPort) + 1).toLocaleString()} ports)...
              </p>
            </div>
          )}
        </div>

        {/* Results */}
        {results && (
          <div className="bg-white rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
            {/* Summary */}
            <div className="px-6 py-3 border-b bg-gray-50 flex items-center gap-4 text-sm">
              <span className="font-semibold text-gray-700">
                Target: <span className="font-mono text-blue-600">{results.target_ip}</span>
              </span>
              <span className="text-gray-500">|</span>
              <span className="text-gray-600">
                Scanned: <strong>{results.total_scanned.toLocaleString()}</strong> ports
              </span>
              <span className="text-gray-500">|</span>
              <span className="text-gray-600">
                Open: <strong className="text-green-600">{results.open_ports.length}</strong>
              </span>
              <span className="text-gray-500">|</span>
              <span className="text-gray-600">
                Time: <strong>{results.scan_time}s</strong>
              </span>
            </div>

            {/* Table */}
            <div className="overflow-auto flex-1">
              {results.open_ports.length > 0 ? (
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-sm font-semibold text-gray-600 w-16 text-center">
                        #
                      </th>
                      <th className="px-6 py-3 text-sm font-semibold text-gray-600 w-24">
                        Port
                      </th>
                      <th className="px-6 py-3 text-sm font-semibold text-gray-600 w-40">
                        Service
                      </th>
                      <th className="px-6 py-3 text-sm font-semibold text-gray-600">
                        Banner
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.open_ports.map((p, idx) => (
                      <tr
                        key={p.port}
                        className="border-b border-gray-100 hover:bg-green-50 transition"
                      >
                        <td className="px-6 py-2 text-sm text-gray-500 text-center">
                          {idx + 1}
                        </td>
                        <td className="px-6 py-2 text-sm font-mono font-semibold text-green-700">
                          {p.port}
                        </td>
                        <td className="px-6 py-2 text-sm text-gray-700">
                          {p.service || "-"}
                        </td>
                        <td className="px-6 py-2 text-sm text-gray-500 font-mono truncate max-w-md">
                          {p.banner || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  No open ports found
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!results && !scanning && (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Search size={48} className="mx-auto mb-3 opacity-30" />
              <p>Enter a target IP and click Start Scan</p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PortScanner;
