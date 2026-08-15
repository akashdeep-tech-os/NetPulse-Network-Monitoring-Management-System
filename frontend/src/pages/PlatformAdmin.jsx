import { useState, useEffect } from "react";
import {
  Globe,
  RefreshCw,
  Plus,
  Users,
  Cpu,
  ShieldCheck,
  AlertTriangle,
  KeyRound,
  ListChecks,
  X,
} from "lucide-react";
import DashboardLayout from "../layout/DashboardLayout";
import {
  getPlatformStats,
  getPlatformOrgs,
  createPlatformOrg,
  setPlatformOrgStatus,
  getPlatformPlans,
  createPlatformPlan,
  getPlatformAuditLogs,
  getPlatformApiKeys,
  getPlatformSettings,
  updatePlatformSettings,
} from "../api.js";
import { useTheme } from "../routes/ThemeContext.jsx";

const TABS = [
  { id: "overview", label: "Overview", icon: <Globe size={14} /> },
  { id: "organizations", label: "Organizations", icon: <Users size={14} /> },
  { id: "plans", label: "Plans", icon: <ShieldCheck size={14} /> },
  { id: "audit", label: "Audit Logs", icon: <ListChecks size={14} /> },
  { id: "api-keys", label: "API Keys", icon: <KeyRound size={14} /> },
  { id: "settings", label: "Settings", icon: <Globe size={14} /> },
];

const PlatformAdmin = () => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [plans, setPlans] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [orgForm, setOrgForm] = useState({ name: "", slug: "", plan_slug: "free" });
  const [planForm, setPlanForm] = useState({
    name: "",
    slug: "",
    price: 0,
    max_devices: 5,
    max_users: 1,
    max_groups: 5,
    max_api_keys: 1,
    monitoring_interval: 60,
    ai_requests_per_month: 100,
    max_retention_days: 90,
    ai_features_enabled: true,
    advanced_reports_enabled: true,
  });
  const [settingsDraft, setSettingsDraft] = useState({});

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [statsRes, orgsRes, plansRes, auditRes, keysRes, settingsRes] =
        await Promise.allSettled([
          getPlatformStats(),
          getPlatformOrgs(),
          getPlatformPlans(),
          getPlatformAuditLogs(100),
          getPlatformApiKeys(),
          getPlatformSettings(),
        ]);
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data);
      if (orgsRes.status === "fulfilled") setOrgs(orgsRes.value.data || []);
      if (plansRes.status === "fulfilled") setPlans(plansRes.value.data || []);
      if (auditRes.status === "fulfilled") setAuditLogs(auditRes.value.data || []);
      if (keysRes.status === "fulfilled") setApiKeys(keysRes.value.data || []);
      if (settingsRes.status === "fulfilled") {
        setSettings(settingsRes.value.data || {});
        setSettingsDraft(settingsRes.value.data || {});
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleCreateOrg = async () => {
    try {
      await createPlatformOrg(orgForm);
      setShowOrgModal(false);
      setOrgForm({ name: "", slug: "", plan_slug: "free" });
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to create organization");
    }
  };

  const handleSetOrgStatus = async (orgId, status) => {
    try {
      await setPlatformOrgStatus(orgId, status);
      fetchAll();
    } catch {
      alert("Failed to update organization status");
    }
  };

  const handleCreatePlan = async () => {
    try {
      await createPlatformPlan({ ...planForm, price: parseFloat(planForm.price) || 0 });
      setShowPlanModal(false);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to create plan");
    }
  };

  const handleSaveSettings = async () => {
    try {
      for (const [key, value] of Object.entries(settingsDraft)) {
        await updatePlatformSettings({ key, value: String(value) });
      }
      setSettings(settingsDraft);
      alert("Settings saved");
    } catch {
      alert("Failed to save settings");
    }
  };

  const statCards = [
    { label: "Organizations", value: stats?.total_organizations ?? 0, icon: <Users size={18} />, color: "text-blue-500" },
    { label: "Active Orgs", value: stats?.active_organizations ?? 0, icon: <ShieldCheck size={18} />, color: "text-green-500" },
    { label: "Users", value: stats?.total_users ?? 0, icon: <Users size={18} />, color: "text-purple-500" },
    { label: "Devices", value: stats?.total_devices ?? 0, icon: <Cpu size={18} />, color: "text-teal-500" },
    { label: "Checks (24h)", value: stats?.active_alerts ?? 0, icon: <AlertTriangle size={18} />, color: "text-amber-500" },
    { label: "AI Insights", value: stats?.ai_requests_total ?? 0, icon: <Globe size={18} />, color: "text-violet-500" },
    { label: "MRR", value: `$${stats?.subscription_revenue ?? 0}`, icon: <ShieldCheck size={18} />, color: "text-emerald-500" },
  ];

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full gap-4 overflow-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 dark:bg-slate-700 p-2 rounded-lg">
              <Globe size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Platform Admin
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Manage all organizations, plans and system settings
              </p>
            </div>
          </div>
          <button
            onClick={fetchAll}
            className="p-1.5 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition self-start"
            title="Refresh"
          >
            <RefreshCw
              size={16}
              className={
                loading ? "animate-spin text-blue-600" : "text-gray-600 dark:text-gray-300"
              }
            />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-lg w-fit flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === tab.id
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            {statCards.map((s) => (
              <div
                key={s.label}
                className={`rounded-xl border p-4 ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"}`}
              >
                <div className={`mb-2 ${s.color}`}>{s.icon}</div>
                <p className="text-[10px] font-medium text-gray-400 uppercase">{s.label}</p>
                <p className="text-xl font-bold text-gray-800 dark:text-white tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Organizations */}
        {activeTab === "organizations" && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
                Organizations ({orgs.length})
              </h3>
              <button
                onClick={() => setShowOrgModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition"
              >
                <Plus size={13} />
                New Org
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-700/30">
                    <th className="text-left py-3 px-4 font-semibold text-gray-400 text-[11px] uppercase">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-400 text-[11px] uppercase hidden md:table-cell">Plan</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-400 text-[11px] uppercase">Devices</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-400 text-[11px] uppercase">Users</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-400 text-[11px] uppercase">Status</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-400 text-[11px] uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((o) => (
                    <tr key={o.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50/50 dark:hover:bg-slate-700/30">
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-800 dark:text-white">{o.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{o.slug}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500 hidden md:table-cell">{o.plan}</td>
                      <td className="py-3 px-4 text-xs text-gray-500">{o.devices}</td>
                      <td className="py-3 px-4 text-xs text-gray-500">{o.users}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${o.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          {o.status === "active" ? (
                            <button
                              onClick={() => handleSetOrgStatus(o.id, "suspended")}
                              className="px-2 py-1 text-[10px] bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 rounded-lg transition font-medium"
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSetOrgStatus(o.id, "active")}
                              className="px-2 py-1 text-[10px] bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 rounded-lg transition font-medium"
                            >
                              Activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Plans */}
        {activeTab === "plans" && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
                Plans ({plans.length})
              </h3>
              <button
                onClick={() => setShowPlanModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition"
              >
                <Plus size={13} />
                New Plan
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
              {plans.map((p) => (
                <div key={p.id} className="border border-gray-100 dark:border-slate-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-bold text-gray-800 dark:text-white">{p.name}</h4>
                    <span className="text-sm font-bold text-blue-600">${p.price}/mo</span>
                  </div>
                  <p className="text-[10px] text-gray-400 font-mono mb-3">{p.slug}</p>
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                    <span>Devices: {p.max_devices}</span>
                    <span>Users: {p.max_users}</span>
                    <span>AI Req/mo: {p.ai_requests_per_month}</span>
                    <span>Retention: {p.max_retention_days}d</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit */}
        {activeTab === "audit" && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden flex-1 min-h-0">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
                Platform Audit Logs
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-700/30">
                    <th className="text-left py-3 px-4 font-semibold text-gray-400 text-[11px] uppercase">Action</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-400 text-[11px] uppercase hidden sm:table-cell">Resource</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-400 text-[11px] uppercase hidden md:table-cell">Org ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-400 text-[11px] uppercase">User</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-400 text-[11px] uppercase">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((l) => (
                    <tr key={l.id} className="border-b border-gray-50 dark:border-slate-700/50">
                      <td className="py-2.5 px-4 text-xs font-medium text-gray-700 dark:text-gray-300">{l.action}</td>
                      <td className="py-2.5 px-4 text-xs text-gray-500 hidden sm:table-cell">
                        {l.resource}{l.resource_id ? ` #${l.resource_id}` : ""}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-gray-400 hidden md:table-cell">{l.organization_id || "-"}</td>
                      <td className="py-2.5 px-4 text-xs text-gray-500">{l.user_name || "system"}</td>
                      <td className="py-2.5 px-4 text-xs text-gray-400">{new Date(l.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* API Keys */}
        {activeTab === "api-keys" && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
                Active API Keys Across Platform
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-700/30">
                    <th className="text-left py-3 px-4 font-semibold text-gray-400 text-[11px] uppercase">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-400 text-[11px] uppercase">Key</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-400 text-[11px] uppercase">Org</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-400 text-[11px] uppercase">Last Used</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((k) => (
                    <tr key={k.id} className="border-b border-gray-50 dark:border-slate-700/50">
                      <td className="py-2.5 px-4 text-xs font-medium text-gray-700 dark:text-gray-300">{k.name}</td>
                      <td className="py-2.5 px-4 text-xs font-mono text-gray-400">{k.key_prefix}...</td>
                      <td className="py-2.5 px-4 text-xs text-gray-500">#{k.organization_id}</td>
                      <td className="py-2.5 px-4 text-xs text-gray-400">
                        {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "Never"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Settings */}
        {activeTab === "settings" && (
          <div className="max-w-md bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-4">
              Platform Settings
            </h3>
            <div className="space-y-3">
              {Object.keys(settings).length === 0 && (
                <p className="text-xs text-gray-400">No settings configured yet.</p>
              )}
              {Object.entries(settingsDraft).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {key.replace(/_/g, " ")}
                  </label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setSettingsDraft({ ...settingsDraft, [key]: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white"
                  />
                </div>
              ))}
              <button
                onClick={handleSaveSettings}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition font-medium"
              >
                Save Settings
              </button>
            </div>
          </div>
        )}

        {/* New Org Modal */}
        {showOrgModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-800 dark:text-white">New Organization</h3>
                <button onClick={() => setShowOrgModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                  <X size={18} className="text-gray-400" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                <input
                  type="text"
                  value={orgForm.name}
                  onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                  placeholder="Organization name"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white"
                />
                <input
                  type="text"
                  value={orgForm.slug}
                  onChange={(e) => setOrgForm({ ...orgForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                  placeholder="slug (e.g. acme-corp)"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white font-mono"
                />
                <select
                  value={orgForm.plan_slug}
                  onChange={(e) => setOrgForm({ ...orgForm, plan_slug: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white"
                >
                  <option value="free">Free</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.slug}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700 flex gap-3">
                <button onClick={() => setShowOrgModal(false)} className="flex-1 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg font-medium transition">
                  Cancel
                </button>
                <button onClick={handleCreateOrg} disabled={!orgForm.name.trim() || !orgForm.slug.trim()} className="flex-1 px-4 py-2.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition disabled:opacity-50">
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* New Plan Modal */}
        {showPlanModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-800 dark:text-white">New Plan</h3>
                <button onClick={() => setShowPlanModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                  <X size={18} className="text-gray-400" />
                </button>
              </div>
              <div className="p-5 space-y-3 max-h-[60vh] overflow-auto">
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="Name" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                    className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white" />
                  <input type="text" placeholder="slug" value={planForm.slug} onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })}
                    className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white font-mono" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" placeholder="Price" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                    className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white" />
                  <input type="number" placeholder="Devices" value={planForm.max_devices} onChange={(e) => setPlanForm({ ...planForm, max_devices: e.target.value })}
                    className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" placeholder="Users" value={planForm.max_users} onChange={(e) => setPlanForm({ ...planForm, max_users: e.target.value })}
                    className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white" />
                  <input type="number" placeholder="AI requests/mo" value={planForm.ai_requests_per_month} onChange={(e) => setPlanForm({ ...planForm, ai_requests_per_month: e.target.value })}
                    className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white" />
                </div>
              </div>
              <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700 flex gap-3">
                <button onClick={() => setShowPlanModal(false)} className="flex-1 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg font-medium transition">
                  Cancel
                </button>
                <button onClick={handleCreatePlan} disabled={!planForm.name.trim() || !planForm.slug.trim()} className="flex-1 px-4 py-2.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition disabled:opacity-50">
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PlatformAdmin;