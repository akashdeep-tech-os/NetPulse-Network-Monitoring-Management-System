import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Send,
  RefreshCw,
  Trash2,
  Bot,
  User as UserIcon,
  BarChart3,
  ShieldAlert,
  Gauge,
  Wrench,
  CheckCircle2,
} from "lucide-react";
import DashboardLayout from "../layout/DashboardLayout";
import {
  getAiDashboard,
  getAiInsights,
  aiChat,
  getAiHistory,
  getAiUsage,
  clearAiHistory,
} from "../api.js";
import { useTheme } from "../routes/ThemeContext.jsx";

const ChatBubble = ({ msg, theme }) => (
  <div className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
    <div
      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
        msg.role === "user"
          ? "bg-blue-600"
          : "bg-gradient-to-br from-violet-500 to-purple-600"
      }`}
    >
      {msg.role === "user" ? (
        <UserIcon size={15} className="text-white" />
      ) : (
        <Bot size={15} className="text-white" />
      )}
    </div>
    <div
      className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
        msg.role === "user"
          ? "bg-blue-600 text-white rounded-tr-sm"
          : theme === "dark"
            ? "bg-slate-800 border border-slate-700 text-gray-200 rounded-tl-sm"
            : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
      }`}
    >
      <p className="whitespace-pre-wrap">{msg.content}</p>
      {msg.tool_name && msg.role === "assistant" && (
        <span
          className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${
            theme === "dark"
              ? "bg-slate-700 text-slate-300"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          <Wrench size={10} />
          {msg.tool_name}
        </span>
      )}
    </div>
  </div>
);

const AiAssistant = () => {
  const { theme } = useTheme();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [usage, setUsage] = useState(null);
  const [summary, setSummary] = useState(null);
  const [rootCause, setRootCause] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const chatEndRef = useRef(null);

  const loadData = async () => {
    setLoadingInsights(true);
    try {
      const [insightsRes, usageRes, historyRes, dashRes] = await Promise.allSettled([
        getAiInsights(5),
        getAiUsage(),
        getAiHistory(),
        getAiDashboard(),
      ]);
      if (insightsRes.status === "fulfilled") {
        setSummary(insightsRes.value.data.summary);
        setRootCause(insightsRes.value.data.root_cause);
      }
      if (usageRes.status === "fulfilled") setUsage(usageRes.value.data);
      if (historyRes.status === "fulfilled") {
        const items = historyRes.value.data || [];
        if (items.length > 0) {
          setMessages(
            items.map((m) => ({
              role: m.role,
              content: m.content,
              tool_name: m.tool_name,
            })),
          );
        } else {
          setMessages([
            {
              role: "assistant",
              content:
                "Hello! I'm your NetPulse AI assistant. Ask me about your network health, device status, latency issues, or what's causing downtime.",
            },
          ]);
        }
      }
    } finally {
      setLoadingInsights(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setSending(true);
    try {
      const res = await aiChat(text);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.data.reply || "No answer generated.",
          tool_name: res.data.tool_name,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            err.response?.data?.detail || "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("Clear AI chat history?")) return;
    try {
      await clearAiHistory();
      setMessages([
        {
          role: "assistant",
          content: "History cleared. How can I help?",
        },
      ]);
    } catch {
      alert("Failed to clear history");
    }
  };

  const pctUsed =
    usage && usage.limit > 0 ? Math.round((usage.used / usage.limit) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full gap-4 md:gap-5 overflow-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-2 rounded-lg">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                AI Assistant
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Ask questions about your network health
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {usage && (
              <div className="px-3 py-1.5 bg-white dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700 text-xs text-gray-500 dark:text-gray-400">
                AI Requests: {usage.used}/{usage.limit} ({pctUsed}%)
              </div>
            )}
            <button
              onClick={loadData}
              className="p-1.5 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition"
              title="Refresh"
            >
              <RefreshCw
                size={16}
                className={
                  loadingInsights
                    ? "animate-spin text-blue-600"
                    : "text-gray-600 dark:text-gray-300"
                }
              />
            </button>
            <button
              onClick={handleClearHistory}
              className="p-1.5 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
              title="Clear History"
            >
              <Trash2 size={16} className="text-red-500" />
            </button>
          </div>
        </div>

        {/* AI Insights Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={16} className="text-violet-500" />
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
                Network Summary
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
              {summary || (loadingInsights ? "Analyzing network..." : "No data yet")}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert size={16} className="text-red-500" />
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
                Root Cause Analysis
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
              {rootCause || (loadingInsights ? "Investigating..." : "No issues found")}
            </p>
          </div>
        </div>

        {/* Chat */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 flex-1 min-h-0 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Bot size={14} className="text-white" />
              </div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
                Assistant Chat
              </h3>
            </div>
            <Gauge size={16} className="text-gray-300 dark:text-gray-600" />
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <ChatBubble key={i} msg={msg} theme={theme} />
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <RefreshCw size={12} className="animate-spin" />
                Thinking...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-3 border-t border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask about your network... e.g. Which devices are down?"
                className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none text-gray-800 dark:text-white placeholder:text-gray-400"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm rounded-xl font-semibold hover:from-violet-700 hover:to-purple-700 transition disabled:opacity-50"
              >
                <Send size={14} />
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>
            {usage && !usage.enabled && (
              <p className="text-[10px] text-red-500 mt-2">
                AI features are not enabled on your plan.
              </p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AiAssistant;