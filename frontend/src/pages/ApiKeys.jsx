import { useState, useEffect } from "react";
import {
  KeyRound,
  Plus,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  Ban,
  X,
} from "lucide-react";
import DashboardLayout from "../layout/DashboardLayout";
import {
  getApiKeys,
  createApiKey,
  revokeApiKey,
  deleteApiKey,
} from "../api.js";

const SCOPE_OPTIONS = [
  { value: "devices:read", label: "Devices Read" },
  { value: "devices:write", label: "Devices Write" },
  { value: "checks:run", label: "Run Checks" },
  { value: "monitoring:read", label: "Monitoring Read" },
  { value: "alerts:read", label: "Alerts Read" },
  { value: "reports:read", label: "Reports Read" },
];

const ApiKeys = () => {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: "", scopes: [], expires_at: "" });
  const [plainKey, setPlainKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [revokeConfirm, setRevokeConfirm] = useState(null);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await getApiKeys();
      setKeys(res.data || []);
    } catch {
      setKeys([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const toggleScope = (scope) => {
    setFormData((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) return;
    try {
      const payload = { name: formData.name, scopes: formData.scopes };
      if (formData.expires_at) payload.expires_at = formData.expires_at;
      const res = await createApiKey(payload);
      setPlainKey(res.data.plain_key);
      setShowModal(false);
      setFormData({ name: "", scopes: [], expires_at: "" });
      fetchKeys();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to create API key");
    }
  };

  const handleRevoke = async (id) => {
    try {
      await revokeApiKey(id);
      setRevokeConfirm(null);
      fetchKeys();
    } catch {
      alert("Failed to revoke API key");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteApiKey(id);
      setDeleteConfirm(null);
      fetchKeys();
    } catch {
      alert("Failed to delete API key");
    }
  };

  const copyKey = () => {
    navigator.clipboard?.writeText(plainKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString() : "Never");

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full gap-4 md:gap-5 overflow-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-teal-100 dark:bg-teal-900/30 p-2 rounded-lg">
              <KeyRound size={20} className="text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                API Keys
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Authenticate external integrations with scoped keys
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchKeys}
              className="p-1.5 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition"
              title="Refresh"
            >
              <RefreshCw
                size={16}
                className={
                  loading ? "animate-spin text-blue-600" : "text-gray-600 dark:text-gray-300"
                }
              />
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition"
            >
              <Plus size={15} />
              New API Key
            </button>
          </div>
        </div>

        {/* Plain Key Reveal */}
        {plainKey && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
              API Key Created - Copy it now
            </h3>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2">
              This is the only time the full key will be shown.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 rounded-lg text-sm font-mono text-emerald-700 dark:text-emerald-400 break-all">
                {plainKey}
              </code>
              <button
                onClick={copyKey}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={() => setPlainKey(null)}
                className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Keys Table */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden flex-1 min-h-0">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
              API Keys ({keys.length})
            </h3>
          </div>
          {keys.length === 0 ? (
            <div className="py-12 text-center text-gray-400 dark:text-gray-500">
              <KeyRound size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No API keys created</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-700/30">
                    <th className="text-left py-3 px-4 font-semibold text-gray-400 dark:text-gray-500 text-[11px] uppercase">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-400 dark:text-gray-500 text-[11px] uppercase hidden md:table-cell">Key</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-400 dark:text-gray-500 text-[11px] uppercase hidden lg:table-cell">Scopes</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-400 dark:text-gray-500 text-[11px] uppercase hidden sm:table-cell">Expires</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-400 dark:text-gray-500 text-[11px] uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50/50 dark:hover:bg-slate-700/30">
                      <td className="py-3 px-4 font-medium text-gray-800 dark:text-white">{k.name}</td>
                      <td className="py-3 px-4 font-mono text-xs text-gray-500 dark:text-gray-400 hidden md:table-cell">{k.key_prefix}...</td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {(k.scopes || []).map((s) => (
                            <span key={s} className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 text-[10px] rounded">
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                        {k.expires_at ? new Date(k.expires_at).toLocaleDateString() : "Never"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          {!k.revoked_at && (
                            <button
                              onClick={() => setRevokeConfirm(k)}
                              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition"
                              title="Revoke"
                            >
                              <Ban size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteConfirm(k)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-800 dark:text-white">
                  New API Key
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  <X size={18} className="text-gray-400" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    Key Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Monitoring Integration"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder:text-gray-400"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    Scopes
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {SCOPE_OPTIONS.map((s) => (
                      <label key={s.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.scopes.includes(s.value)}
                          onChange={() => toggleScope(s.value)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600"
                        />
                        <span className="text-xs text-gray-700 dark:text-gray-300">{s.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    Expires At (optional)
                  </label>
                  <input
                    type="date"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white"
                  />
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
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Revoke Confirm */}
        {revokeConfirm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="text-center">
                <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-full inline-block mb-4">
                  <Ban size={24} className="text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">
                  Revoke API Key
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  "{revokeConfirm.name}" will stop working immediately.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setRevokeConfirm(null)}
                    className="flex-1 px-4 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg font-medium text-sm transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleRevoke(revokeConfirm.id)}
                    className="flex-1 px-4 py-2.5 bg-amber-600 text-white hover:bg-amber-700 rounded-lg font-medium text-sm transition"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirm */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="text-center">
                <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full inline-block mb-4">
                  <Trash2 size={24} className="text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">
                  Delete API Key
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
                    onClick={() => handleDelete(deleteConfirm.id)}
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

export default ApiKeys;