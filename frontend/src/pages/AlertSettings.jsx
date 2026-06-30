import { useState, useEffect } from "react";
import {
  Bell,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  ToggleLeft,
  ToggleRight,
  Mail,
  Smartphone,
  Send,
  RefreshCw,
  AlertTriangle,
  Clock,
  Shield,
} from "lucide-react";
import DashboardLayout from "../layout/DashboardLayout";
import {
  getAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  toggleAlertRule,
  getAlertConfig,
  updateAlertConfig,
  testAlertNotification,
  getDevices,
  getGroups,
} from "../api.js";
import { useAuth } from "../routes/AuthContext.jsx";

const RULE_TYPES = [
  { value: "device_offline", label: "Device Goes Offline", icon: "🔴" },
  { value: "device_online", label: "Device Comes Online", icon: "🟢" },
  { value: "high_latency", label: "High Latency", icon: "🟡" },
];

const TARGET_TYPES = [
  { value: "all", label: "All Devices" },
  { value: "group", label: "Device Group" },
  { value: "device", label: "Add Specific IP" },
];

const AlertSettings = () => {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("manage_users");

  const [rules, setRules] = useState([]);
  const [devices, setDevices] = useState([]);
  const [groups, setGroups] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testingChannel, setTestingChannel] = useState(null);
  const [emailRecipients, setEmailRecipients] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    rule_type: "device_offline",
    target_type: "all",
    target_id: null,
    target_ip: "",
    threshold_value: 100,
    cooldown_minutes: 5,
    notify_email: true,
    notify_mobile: false,
    enabled: true,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rulesRes, configRes, devicesRes, groupsRes] = await Promise.allSettled([
        getAlertRules(),
        getAlertConfig(),
        getDevices(),
        getGroups(),
      ]);
      if (rulesRes.status === "fulfilled") setRules(rulesRes.value.data);
      if (configRes.status === "fulfilled") {
        setConfig(configRes.value.data);
        setEmailRecipients(configRes.value.data.email_recipients || "");
        setMobileNumber(configRes.value.data.mobile_number || "");
      }
      if (devicesRes.status === "fulfilled") setDevices(devicesRes.value.data);
      if (groupsRes.status === "fulfilled") setGroups(groupsRes.value.data);
    } catch (err) {
      console.error("Failed to fetch alert data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async () => {
    if (!formData.name.trim()) return;
    try {
      const payload = { ...formData };
      if (payload.target_type === "all") payload.target_id = null;
      if (editingRule) {
        await updateAlertRule(editingRule.id, payload);
      } else {
        await createAlertRule(payload);
      }
      setShowModal(false);
      setEditingRule(null);
      resetForm();
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to save alert rule");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteAlertRule(id);
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete alert rule");
    }
  };

  const handleToggle = async (id) => {
    try {
      await toggleAlertRule(id);
      fetchData();
    } catch (err) {
      alert("Failed to toggle alert rule");
    }
  };

  const handleTest = async (channel) => {
    setTestingChannel(channel);
    setTestResult(null);
    try {
      const res = await testAlertNotification({ channel });
      setTestResult({ channel, ...res.data });
    } catch (err) {
      setTestResult({ channel, success: false, message: "Test failed" });
    } finally {
      setTestingChannel(null);
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setConfigSaved(false);
    try {
      await updateAlertConfig({
        email_recipients: emailRecipients,
        mobile_number: mobileNumber,
      });
      setConfigSaved(true);
      fetchData();
      setTimeout(() => setConfigSaved(false), 3000);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to save config");
    } finally {
      setSavingConfig(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      rule_type: "device_offline",
      target_type: "all",
      target_id: null,
      target_ip: "",
      threshold_value: 100,
      cooldown_minutes: 5,
      notify_email: true,
      notify_mobile: false,
      enabled: true,
    });
  };

  const openEditModal = (rule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      rule_type: rule.rule_type,
      target_type: rule.target_type,
      target_id: rule.target_id,
      target_ip: rule.target_ip || "",
      threshold_value: rule.threshold_value || 100,
      cooldown_minutes: rule.cooldown_minutes,
      notify_email: rule.notify_email,
      notify_mobile: rule.notify_mobile,
      enabled: rule.enabled,
    });
    setShowModal(true);
  };

  const getTargetName = (rule) => {
    if (rule.target_type === "all") return "All Devices";
    if (rule.target_type === "group" && rule.target_name) return rule.target_name;
    if (rule.target_type === "device" && rule.target_name) return rule.target_name;
    return "Unknown";
  };

  const getRuleTypeLabel = (type) => {
    return RULE_TYPES.find((r) => r.value === type)?.label || type;
  };

  if (loading && !config) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <RefreshCw size={24} className="animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full gap-4 md:gap-5 overflow-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-lg">
              <Bell size={20} className="text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add Alert
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Configure notifications and alert rules
              </p>
            </div>
          </div>
          {canManage && (
            <button
              onClick={() => {
                setEditingRule(null);
                resetForm();
                setShowModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition"
            >
              <Plus size={15} />
              New Rule
            </button>
          )}
        </div>

        {/* Notification Config */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={18} className="text-orange-500" />
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
              Notification Settings
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Email Config */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-blue-500" />
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Email Notifications
                </h4>
                {config?.smtp_configured ? (
                  <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-medium rounded-full">
                    SMTP Ready
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-[10px] font-medium rounded-full">
                    SMTP not set
                  </span>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Recipient Emails (comma-separated)
                </label>
                <input
                  type="text"
                  value={emailRecipients}
                  onChange={(e) => setEmailRecipients(e.target.value)}
                  placeholder="admin@example.com, ops@example.com"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder:text-gray-400"
                />
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                  Alerts will be sent to these email addresses
                </p>
              </div>
              <button
                onClick={() => handleTest("email")}
                disabled={testingChannel === "email" || !emailRecipients.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition disabled:opacity-50"
              >
                {testingChannel === "email" ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <Send size={12} />
                )}
                Send Test
              </button>
            </div>

            {/* Mobile Config */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Smartphone size={16} className="text-green-500" />
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Mobile Notifications
                </h4>
                {config?.mobile_configured ? (
                  <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-medium rounded-full">
                    SMS Ready
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-[10px] font-medium rounded-full">
                    Not configured
                  </span>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder:text-gray-400"
                />
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                  Alerts will be sent via SMS to this number
                </p>
              </div>
              <button
                onClick={() => handleTest("mobile")}
                disabled={testingChannel === "mobile" || !mobileNumber.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-lg transition disabled:opacity-50"
              >
                {testingChannel === "mobile" ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <Send size={12} />
                )}
                Send Test
              </button>
            </div>
          </div>

          {/* Save Button */}
          {canManage && (
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700 flex items-center gap-3">
              <button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition disabled:opacity-50"
              >
                {savingConfig ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                Save Settings
              </button>
              {configSaved && (
                <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <Check size={12} />
                  Saved successfully
                </span>
              )}
            </div>
          )}
        </div>

        {/* Test Result */}
        {testResult && (
          <div
            className={`px-4 py-3 rounded-lg text-sm ${
              testResult.success
                ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
                : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
            }`}
          >
            {testResult.message}
          </div>
        )}

        {/* Alert Rules */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
              Alert Rules ({rules.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {rules.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <AlertTriangle size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No alert rules configured
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Create a rule to start receiving notifications
                </p>
              </div>
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  className="px-4 py-3 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition"
                >
                  <button
                    onClick={() => canManage && handleToggle(rule.id)}
                    className={`shrink-0 ${canManage ? "cursor-pointer" : "cursor-default"}`}
                    title={rule.enabled ? "Disable" : "Enable"}
                  >
                    {rule.enabled ? (
                      <ToggleRight size={28} className="text-green-500" />
                    ) : (
                      <ToggleLeft size={28} className="text-gray-300 dark:text-gray-600" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-gray-800 dark:text-white truncate">
                        {rule.name}
                      </h4>
                      <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 text-[10px] rounded font-medium">
                        {getRuleTypeLabel(rule.rule_type)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                      <span className="flex items-center gap-1">
                        <Shield size={10} />
                        {getTargetName(rule)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {rule.cooldown_minutes}m cooldown
                      </span>
                      {rule.notify_email && (
                        <span className="flex items-center gap-1">
                          <Mail size={10} />
                          Email
                        </span>
                      )}
                      {rule.notify_mobile && (
                        <span className="flex items-center gap-1">
                          <Smartphone size={10} />
                          Mobile
                        </span>
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditModal(rule)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(rule.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-800 dark:text-white">
                  {editingRule ? "Edit Alert Rule" : "New Alert Rule"}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  <X size={18} className="text-gray-400" />
                </button>
              </div>
              <div className="p-5 space-y-4 max-h-[70vh] overflow-auto">
                {/* Rule Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    Rule Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Camera Down Alert"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder:text-gray-400"
                    autoFocus
                  />
                </div>

                {/* Rule Type */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    Alert When
                  </label>
                  <select
                    value={formData.rule_type}
                    onChange={(e) => setFormData({ ...formData, rule_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white"
                  >
                    {RULE_TYPES.map((rt) => (
                      <option key={rt.value} value={rt.value}>
                        {rt.icon} {rt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Threshold for high latency */}
                {formData.rule_type === "high_latency" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                      Latency Threshold (ms)
                    </label>
                    <input
                      type="number"
                      value={formData.threshold_value}
                      onChange={(e) =>
                        setFormData({ ...formData, threshold_value: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white"
                    />
                  </div>
                )}

                {/* Target */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    Apply To
                  </label>
                  <select
                    value={formData.target_type}
                    onChange={(e) =>
                      setFormData({ ...formData, target_type: e.target.value, target_id: null })
                    }
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white"
                  >
                    {TARGET_TYPES.map((tt) => (
                      <option key={tt.value} value={tt.value}>
                        {tt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Target Selection */}
                {formData.target_type === "group" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                      Select Group
                    </label>
                    <select
                      value={formData.target_id || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, target_id: parseInt(e.target.value) || null })
                      }
                      className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white"
                    >
                      <option value="">Select a group</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.target_type === "device" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                      Add Specific IP
                    </label>
                    <input
                      type="text"
                      value={formData.target_ip || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, target_ip: e.target.value })
                      }
                      placeholder="e.g., 192.168.1.100"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder:text-gray-400 font-mono"
                    />
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                      Enter the IP address of the specific device
                    </p>
                  </div>
                )}

                {/* Cooldown */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    Cooldown (minutes)
                  </label>
                  <input
                    type="number"
                    value={formData.cooldown_minutes}
                    onChange={(e) =>
                      setFormData({ ...formData, cooldown_minutes: parseInt(e.target.value) || 1 })
                    }
                    min="1"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white"
                  />
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                    Minimum time between repeat notifications for the same rule
                  </p>
                </div>

                {/* Notification Channels */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Notify Via
                  </label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.notify_email}
                        onChange={(e) =>
                          setFormData({ ...formData, notify_email: e.target.checked })
                        }
                        className="w-4 h-4 rounded border-gray-300 text-blue-600"
                      />
                      <Mail size={14} className="text-gray-500" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Email</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.notify_mobile}
                        onChange={(e) =>
                          setFormData({ ...formData, notify_mobile: e.target.checked })
                        }
                        className="w-4 h-4 rounded border-gray-300 text-blue-600"
                      />
                      <Smartphone size={14} className="text-gray-500" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Mobile</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700 flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!formData.name.trim()}
                  className="flex-1 px-4 py-2.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition disabled:opacity-50"
                >
                  {editingRule ? "Save" : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="text-center">
                <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full inline-block mb-4">
                  <Trash2 size={24} className="text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">
                  Delete Alert Rule
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 px-4 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg font-medium text-sm transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(deleteConfirm)}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium text-sm transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AlertSettings;
