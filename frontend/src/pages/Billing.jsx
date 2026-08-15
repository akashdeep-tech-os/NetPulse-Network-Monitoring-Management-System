import { useState, useEffect } from "react";
import {
  CreditCard,
  RefreshCw,
  Check,
  Crown,
  X,
  BarChart3,
} from "lucide-react";
import DashboardLayout from "../layout/DashboardLayout";
import {
  getPlans,
  getBillingSubscription,
  subscribeToPlan,
  cancelSubscription,
  getBillingUsage,
} from "../api.js";

const FEATURE_MAP = [
  { key: "max_devices", label: "Devices", suffix: "" },
  { key: "max_users", label: "Users", suffix: "" },
  { key: "max_groups", label: "Groups", suffix: "" },
  { key: "max_api_keys", label: "API Keys", suffix: "" },
  { key: "monitoring_interval", label: "Monitoring Interval", suffix: "s" },
  { key: "ai_requests_per_month", label: "AI Requests", suffix: "/mo" },
  { key: "max_retention_days", label: "Data Retention", suffix: " days" },
];

const Billing = () => {
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansRes, subRes, usageRes] = await Promise.allSettled([
        getPlans(),
        getBillingSubscription(),
        getBillingUsage(),
      ]);
      if (plansRes.status === "fulfilled") setPlans(plansRes.value.data || []);
      if (subRes.status === "fulfilled") setSubscription(subRes.value.data);
      if (usageRes.status === "fulfilled") setUsage(usageRes.value.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubscribe = async (plan) => {
    setSubscribing(plan.slug);
    try {
      await subscribeToPlan(plan.slug, "monthly");
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to subscribe");
    } finally {
      setSubscribing(null);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelSubscription();
      setCancelConfirm(false);
      fetchData();
    } catch {
      alert("Failed to cancel subscription");
    }
  };

  const currentPlanSlug = subscription?.plan?.slug;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full gap-4 md:gap-5 overflow-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg">
              <CreditCard size={20} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Billing & Plan
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Manage your subscription and usage
              </p>
            </div>
          </div>
          <button
            onClick={fetchData}
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
        </div>

        {/* Current Plan Banner */}
        {subscription && (
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl p-4 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Crown size={20} />
              </div>
              <div>
                <h3 className="text-sm font-semibold">
                  {subscription.plan?.name || "Current Plan"}
                </h3>
                <p className="text-xs text-white/70">
                  Status: {subscription.status} · Cycle: {subscription.billing_cycle}
                  {subscription.expires_at
                    ? ` · Expires ${new Date(subscription.expires_at).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
            </div>
            {subscription.status === "active" && (
              <button
                onClick={() => setCancelConfirm(true)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-xs rounded-lg font-medium transition"
              >
                Cancel Subscription
              </button>
            )}
          </div>
        )}

        {/* Usage */}
        {usage.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {usage.map((u) => (
              <div
                key={u.resource}
                className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4"
              >
                <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase mb-1">
                  {u.resource.replace(/_/g, " ")}
                </p>
                <p className="text-lg font-bold text-gray-800 dark:text-white tabular-nums">
                  {u.used} <span className="text-xs font-medium text-gray-400">/ {u.limit}</span>
                </p>
                <div className="mt-2 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${u.percent >= 90 ? "bg-red-500" : u.percent >= 70 ? "bg-yellow-500" : "bg-green-500"}`}
                    style={{ width: `${Math.min(u.percent, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent = plan.slug === currentPlanSlug;
            const popular = plan.slug === "pro";
            return (
              <div
                key={plan.id}
                className={`rounded-2xl border p-5 flex flex-col ${
                  popular
                    ? "bg-gradient-to-b from-indigo-50 to-white dark:from-indigo-900/20 dark:to-slate-800 border-indigo-200 dark:border-indigo-800"
                    : "bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                  {popular && (
                    <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full">
                      POPULAR
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 min-h-[32px]">
                  {plan.description || ""}
                </p>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-black text-gray-900 dark:text-white">
                    ${plan.price}
                  </span>
                  <span className="text-xs text-gray-400">/{plan.billing_cycle}</span>
                </div>
                <div className="flex-1 space-y-2 mb-5">
                  {FEATURE_MAP.map((f) => (
                    <div key={f.key} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                      <Check size={13} className="text-green-500 shrink-0" />
                      {plan[f.key] !== undefined ? `${plan[f.key]}${f.suffix} ${f.label}` : f.label}
                    </div>
                  ))}
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <Check size={13} className="text-green-500 shrink-0" />
                    {plan.ai_features_enabled ? "AI Insights included" : "No AI features"}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <Check size={13} className="text-green-500 shrink-0" />
                    {plan.advanced_reports_enabled ? "Advanced Reports" : "Basic Reports"}
                  </div>
                </div>
                {isCurrent ? (
                  <div className="w-full py-2.5 text-center text-sm font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-xl">
                    Current Plan
                  </div>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan)}
                    disabled={subscribing === plan.slug}
                    className="w-full py-2.5 text-sm font-semibold rounded-xl transition disabled:opacity-50 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {subscribing === plan.slug ? "Switching..." : "Switch to this plan"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Cancel Confirm */}
        {cancelConfirm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="text-center">
                <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full inline-block mb-4">
                  <X size={24} className="text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">
                  Cancel Subscription
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Your plan will be downgraded. This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setCancelConfirm(false)}
                    className="flex-1 px-4 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg font-medium text-sm transition"
                  >
                    Keep Plan
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium text-sm transition"
                  >
                    Cancel
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

export default Billing;