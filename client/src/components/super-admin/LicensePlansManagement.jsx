import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ConfirmDialog from "../common/ConfirmDialog";
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  Eye,
  DollarSign,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Settings,
  RefreshCw,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * License Plans Management Component
 * Super Admin interface for managing license plans, pricing, and features
 */
const LicensePlansManagement = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);
  const [deletePlanConfirm, setDeletePlanConfirm] = useState({
    isOpen: false,
    planId: null,
  });
  const queryClient = useQueryClient();

  const [allFeatures, setAllFeatures] = useState([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);

  const fetchFeatures = async () => {
    setFeaturesLoading(true);
    try {
      const response = await fetch("/api/super-admin/features", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAllFeatures(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch features:", error);
    } finally {
      setFeaturesLoading(false);
    }
  };

  React.useEffect(() => {
    if (showFeaturesModal) {
      fetchFeatures();
    }
  }, [showFeaturesModal]);

  const handleFeatureActiveToggle = async (featureCode, isChecked) => {
    setAllFeatures((prev) =>
      prev.map((f) =>
        f.feature_code === featureCode ? { ...f, view: isChecked } : f
      )
    );

    try {
      const response = await fetch(`/api/super-admin/features/${featureCode}/toggle-active`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ view: isChecked }),
      });
      if (!response.ok) {
        throw new Error("Failed to update feature active status");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/license/features"] });
    } catch (error) {
      console.error("Error toggling feature active status:", error);
      setAllFeatures((prev) =>
        prev.map((f) =>
          f.feature_code === featureCode ? { ...f, view: !isChecked } : f
        )
      );
    }
  };

  const groupedFeatures = allFeatures.reduce((acc, feature) => {
    const category = feature.category || "OTHER";
    if (!acc[category]) acc[category] = [];
    acc[category].push(feature);
    return acc;
  }, {});

  // Fetch all license plans
  const {
    data: plansData,
    isLoading: plansLoading,
    error: plansError,
  } = useQuery({
    queryKey: ["/api/super-admin/license-plans"],
    queryFn: async () => {
      const response = await fetch("/api/super-admin/license-plans", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to fetch license plans");
      }
      return response.json();
    },
    retry: 1,
  });

  // Fetch license analytics
  const { data: analytics, error: analyticsError } = useQuery({
    queryKey: ["/api/super-admin/license-analytics"],
    queryFn: async () => {
      const response = await fetch("/api/super-admin/license-analytics", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to fetch analytics");
      }
      return response.json();
    },
    retry: 1,
  });

  console.log("Plans Data:", plansData);
  console.log("Plans Error:", plansError);
  console.log("Analytics Data:", analytics);
  console.log("Analytics Error:", analyticsError);

  const plans = plansData?.data || [];
  const stats = analytics?.data || {
    totalRevenue: 0,
    totalSubscriptions: 0,
    activeSeats: 0,
    popularPlan: "PLAN",
  };

  console.log("Processed Plans:", plans);
  console.log("Processed Stats:", stats);

  // Create/Update Plan Mutation
  const savePlanMutation = useMutation({
    mutationFn: async (planData) => {
      const url = planData._id
        ? `/api/super-admin/license-plans/${planData._id}`
        : "/api/super-admin/license-plans";
      const method = planData._id ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(planData),
      });

      if (!response.ok) throw new Error("Failed to save plan");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/super-admin/license-plans"]);
      queryClient.invalidateQueries(["/api/super-admin/license-analytics"]);
      setShowCreateModal(false);
      setShowEditModal(false);
      setSelectedPlan(null);
    },
  });

  // Delete Plan Mutation
  const deletePlanMutation = useMutation({
    mutationFn: async (planId) => {
      const response = await fetch(`/api/super-admin/license-plans/${planId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to delete plan");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/super-admin/license-plans"]);
      queryClient.invalidateQueries(["/api/super-admin/license-analytics"]);
    },
  });

  // Toggle Plan Status Mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ planId, isActive }) => {
      const response = await fetch(
        `/api/super-admin/license-plans/${planId}/toggle-status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ is_active: !isActive }),
        },
      );
      if (!response.ok) throw new Error("Failed to toggle status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/super-admin/license-plans"]);
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries(["/api/super-admin/license-plans"]);
    await queryClient.invalidateQueries(["/api/super-admin/license-analytics"]);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleEdit = (plan) => {
    setSelectedPlan(plan);
    setShowEditModal(true);
  };

  const handleDelete = async (planId) => {
    setDeletePlanConfirm({ isOpen: true, planId });
  };

  const handleToggleStatus = (plan) => {
    toggleStatusMutation.mutate({ planId: plan._id, isActive: plan.is_active });
  };

  const getPlanStats = (licenseCode) => {
    // Sample stats - in real implementation, fetch from API
    const statsMap = {
      EXPLORE: { subscribers: 450, revenue: 0, seats: 1200 },
      PLAN: { subscribers: 180, revenue: 89820, seats: 950 },
      EXECUTE: { subscribers: 95, revenue: 94905, seats: 420 },
      OPTIMIZE: { subscribers: 42, revenue: 83958, seats: 180 },
    };
    return statsMap[licenseCode] || { subscribers: 0, revenue: 0, seats: 0 };
  };

  return (
    <div className="space-y-3 p-4">
      {/* Delete Plan Confirmation */}
      <ConfirmDialog
        isOpen={deletePlanConfirm.isOpen}
        title="Delete Plan?"
        description="Are you sure you want to delete this plan? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        onCancel={() => setDeletePlanConfirm({ isOpen: false, planId: null })}
        onConfirm={() => {
          deletePlanMutation.mutate(deletePlanConfirm.planId);
          setDeletePlanConfirm({ isOpen: false, planId: null });
        }}
      />
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-sm flex items-center justify-center border border-blue-200">
            <Package className="w-7 h-7 text-blue-600" />
          </div>
          <div>
            <h2 className="text-4xl font-bold text-gray-900">
              License Plans Management
            </h2>
            <p className="text-gray-600 mt-1">
              Manage pricing, features, and plan configurations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setShowFeaturesModal(true)}
            data-testid="button-view-features"
          >
            <Eye size={18} className="mr-2" />
            View Features
          </Button>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            data-testid="button-refresh-plans"
          >
            <RefreshCw
              size={18}
              className={`mr-2 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          {/* <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-sm flex items-center gap-2 transition-colors"
            data-testid="button-create-plan"
          >
            <Plus size={18} />
            Create New Plan
          </button> */}
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div
          className="bg-white p-4 rounded-sm border"
          data-testid="card-total-revenue"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Monthly Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{stats.totalRevenue.toLocaleString()}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-sm">
              <DollarSign className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div
          className="bg-white p-4 rounded-sm border"
          data-testid="card-total-subscriptions"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Subscriptions</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalSubscriptions}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-sm">
              <Package className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div
          className="bg-white p-4 rounded-sm border"
          data-testid="card-active-seats"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Seats</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.activeSeats}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-sm">
              <Users className="text-purple-600" size={24} />
            </div>
          </div>
        </div>

        <div
          className="bg-white p-4 rounded-sm border"
          data-testid="card-popular-plan"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Most Popular</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.popularPlan}
              </p>
            </div>
            <div className="bg-indigo-100 p-3 rounded-sm">
              <TrendingUp className="text-indigo-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* License Plans Table */}
      <div
        className="bg-white rounded-sm border"
        data-testid="card-plans-table"
      >
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Available License Plans
          </h3>
        </div>

        {plansLoading ? (
          <div className="p-12 text-center">
            <RefreshCw
              className="animate-spin mx-auto mb-2 text-gray-400"
              size={32}
            />
            <p className="text-gray-600">Loading plans...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="mx-auto mb-2 text-gray-400" size={48} />
            <p className="text-gray-600">No license plans found</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-blue-600 hover:text-blue-800 font-medium"
            >
              Create your first plan
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plan Details
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Features
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pricing
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Limits
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statistics
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {plans.map((plan) => {
                  const planStats = plan.stats || {
                    subscriptions: 0,
                    monthlyRevenue: 0,
                    totalSeats: 0,
                    usedSeats: 0,
                  };
                  return (
                    <tr
                      key={plan._id}
                      className="hover:bg-gray-50"
                      data-testid={`plan-row-${plan.license_code}`}
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-sm ${
                              plan.license_code === "EXPLORE"
                                ? "bg-green-100"
                                : plan.license_code === "PLAN"
                                  ? "bg-blue-100"
                                  : plan.license_code === "EXECUTE"
                                    ? "bg-purple-100"
                                    : "bg-indigo-100"
                            }`}
                          >
                            <Package
                              size={20}
                              className={
                                plan.license_code === "EXPLORE"
                                  ? "text-green-600"
                                  : plan.license_code === "PLAN"
                                    ? "text-blue-600"
                                    : plan.license_code === "EXECUTE"
                                      ? "text-purple-600"
                                      : "text-indigo-600"
                              }
                            />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {plan.name}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {plan.license_code}
                            </p>
                            {plan.is_popular && (
                              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                <TrendingUp size={12} /> Popular
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          {plan.features && plan.features.length > 0 ? (
                            <ul className="text-xs text-gray-600 space-y-1">
                              {plan.features.slice(0, 3).map((feature, idx) => (
                                <li
                                  key={idx}
                                  className="flex items-start gap-1"
                                >
                                  <CheckCircle
                                    size={12}
                                    className="text-green-500 mt-0.5 flex-shrink-0"
                                  />
                                  <span
                                    className="line-clamp-1"
                                    title={feature.description}
                                  >
                                    {feature.name}
                                    {feature.usage_limit !== -1 &&
                                      feature.usage_limit > 0 && (
                                        <span className="text-gray-500">
                                          {" "}
                                          ({feature.usage_limit})
                                        </span>
                                      )}
                                    {feature.is_unlimited && (
                                      <span className="text-gray-500">
                                        {" "}
                                        (Unlimited)
                                      </span>
                                    )}
                                  </span>
                                </li>
                              ))}
                              {plan.features.length > 3 && (
                                <li className="text-blue-600 font-medium">
                                  +{plan.features.length - 3} more features
                                </li>
                              )}
                            </ul>
                          ) : plan.features_summary &&
                            plan.features_summary.length > 0 ? (
                            <ul className="text-xs text-gray-600 space-y-1">
                              {plan.features_summary
                                .slice(0, 3)
                                .map((feature, idx) => (
                                  <li
                                    key={idx}
                                    className="flex items-start gap-1"
                                  >
                                    <CheckCircle
                                      size={12}
                                      className="text-green-500 mt-0.5 flex-shrink-0"
                                    />
                                    <span className="line-clamp-1">
                                      {feature}
                                    </span>
                                  </li>
                                ))}
                              {plan.features_summary.length > 3 && (
                                <li className="text-blue-600 font-medium">
                                  +{plan.features_summary.length - 3} more
                                </li>
                              )}
                            </ul>
                          ) : (
                            <p className="text-xs text-gray-400">
                              No features listed
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-900">
                            ₹{plan.price_monthly}/mo
                          </p>
                          <p className="text-xs text-gray-600">
                            ₹{plan.price_yearly}/yr
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          <p className="text-sm text-gray-700">
                            Max Users:{" "}
                            {plan.max_users === -1
                              ? "Unlimited"
                              : plan.max_users}
                          </p>
                          <p className="text-xs text-gray-600">
                            Trial: {plan.trial_days} days
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-1 text-sm">
                          <p className="text-gray-700">
                            {planStats.subscriptions || 0} orgs
                          </p>
                          <p className="text-gray-700">
                            {planStats.totalSeats || 0} seats
                          </p>
                          <p className="text-green-600 font-medium">
                            ₹{(planStats.monthlyRevenue || 0).toLocaleString()}
                            /mo
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <button
                          onClick={() => handleToggleStatus(plan)}
                          className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                            plan.is_active
                              ? "text-green-700 bg-green-100 hover:bg-green-200"
                              : "text-gray-700 bg-gray-100 hover:bg-gray-200"
                          }`}
                          data-testid={`toggle-status-${plan.license_code}`}
                        >
                          {plan.is_active ? (
                            <>
                              <CheckCircle size={12} /> Active
                            </>
                          ) : (
                            <>
                              <XCircle size={12} /> Inactive
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(plan)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Edit Plan"
                            data-testid={`edit-${plan.license_code}`}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(plan._id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete Plan"
                            data-testid={`delete-${plan.license_code}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Plan Modal */}
      {(showCreateModal || showEditModal) && (
        <PlanFormModal
          plan={selectedPlan}
          isOpen={showCreateModal || showEditModal}
          onClose={() => {
            setShowCreateModal(false);
            setShowEditModal(false);
            setSelectedPlan(null);
          }}
          onSave={(planData) => savePlanMutation.mutate(planData)}
          isSaving={savePlanMutation.isPending}
        />
      )}

      {/* Features Management Modal */}
      {showFeaturesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-sm max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-xl font-semibold text-gray-900">
                Manage System Features
              </h3>
              <button
                onClick={() => setShowFeaturesModal(false)}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                Toggle the active/visible status of each feature globally. Disabled features will be excluded from all API responses and hidden from user-facing plan comparison tables.
              </p>

              {featuresLoading ? (
                <div className="flex items-center justify-center p-7">
                  <RefreshCw className="animate-spin text-gray-400" size={24} />
                  <span className="ml-2 text-gray-600">Loading features...</span>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-sm divide-y divide-gray-200 max-h-[60vh] overflow-y-auto">
                  {Object.entries(groupedFeatures).map(([category, categoryFeatures]) => (
                    <div key={category} className="bg-white">
                      <div className="bg-gray-50 px-4 py-2 font-semibold text-xs text-gray-700 uppercase tracking-wider sticky top-0 border-b border-gray-200">
                        {category}
                      </div>
                      <div className="divide-y divide-gray-100">
                        {categoryFeatures.map((feature) => (
                          <div
                            key={feature.feature_code}
                            className="p-4 flex items-center justify-between hover:bg-gray-50/50"
                          >
                            <div className="pr-4 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-gray-900">
                                  {feature.name}
                                </span>
                                <span className="text-xs text-gray-500 font-mono">
                                  ({feature.feature_code})
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 mt-1">
                                {feature.description}
                              </p>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer select-none ml-4">
                              <input
                                type="checkbox"
                                checked={feature.view !== false}
                                onChange={(e) =>
                                  handleFeatureActiveToggle(
                                    feature.feature_code,
                                    e.target.checked
                                  )
                                }
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-700 font-medium whitespace-nowrap">
                                Show in API
                              </span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end bg-gray-50 sticky bottom-0">
              <Button onClick={() => setShowFeaturesModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Plan Form Modal Component
 */
const PlanFormModal = ({ plan, isOpen, onClose, onSave, isSaving }) => {
  const [formData, setFormData] = useState({
    license_code: "",
    name: "",
    description: "",
    price_monthly: "",
    price_yearly: "",
    max_users: -1,
    trial_days: 14,
    is_active: true,
    is_popular: false,
    display_order: 0,
    features_summary: [],
    selectedFeatures: {}, // { feature_code: { enabled: boolean, usage_limit: number, limit_type: string } }
  });

  const [allFeatures, setAllFeatures] = useState([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);

  // Fetch all available features
  React.useEffect(() => {
    const fetchFeatures = async () => {
      setFeaturesLoading(true);
      try {
        const response = await fetch("/api/super-admin/features", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setAllFeatures(data.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch features:", error);
      } finally {
        setFeaturesLoading(false);
      }
    };

    if (isOpen) {
      fetchFeatures();
    }
  }, [isOpen]);

  // Fetch existing feature mappings for the plan
  React.useEffect(() => {
    const fetchPlanFeatures = async () => {
      if (plan && plan._id) {
        try {
          const response = await fetch(
            `/api/super-admin/license-plans/${plan._id}/features`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
            },
          );
          if (response.ok) {
            const data = await response.json();
            const featureMap = {};
            (data.data || []).forEach((feature) => {
              featureMap[feature.feature_code] = {
                enabled: feature.is_enabled,
                usage_limit: feature.usage_limit,
                limit_type: feature.limit_type || "MONTHLY",
              };
            });
            setFormData((prev) => ({ ...prev, selectedFeatures: featureMap }));
          }
        } catch (error) {
          console.error("Failed to fetch plan features:", error);
        }
      }
    };

    if (plan) {
      fetchPlanFeatures();
    }
  }, [plan]);

  React.useEffect(() => {
    if (plan) {
      setFormData({
        _id: plan._id,
        license_code: plan.license_code,
        name: plan.name,
        description: plan.description || "",
        price_monthly: plan.price_monthly,
        price_yearly: plan.price_yearly,
        max_users: plan.max_users,
        trial_days: plan.trial_days,
        is_active: plan.is_active,
        is_popular: plan.is_popular,
        display_order: plan.display_order,
        features_summary: plan.features_summary || [],
        selectedFeatures: formData.selectedFeatures, // Keep existing selected features
      });
    }
  }, [plan]);

  const handleFeatureToggle = (featureCode) => {
    setFormData((prev) => ({
      ...prev,
      selectedFeatures: {
        ...prev.selectedFeatures,
        [featureCode]: {
          enabled: !prev.selectedFeatures[featureCode]?.enabled,
          usage_limit: prev.selectedFeatures[featureCode]?.usage_limit || -1,
          limit_type:
            prev.selectedFeatures[featureCode]?.limit_type || "MONTHLY",
        },
      },
    }));
  };



  const handleFeatureLimit = (featureCode, field, value) => {
    setFormData((prev) => {
      let finalValue = value;
      if (field === "usage_limit") {
        const parsed = parseInt(value);
        if (value === -1 || value === "-1") {
          finalValue = -1;
        } else if (value === "" || isNaN(parsed)) {
          finalValue = -1;
        } else {
          finalValue = Math.max(1, parsed);
        }
      }

      return {
        ...prev,
        selectedFeatures: {
          ...prev.selectedFeatures,
          [featureCode]: {
            ...prev.selectedFeatures[featureCode],
            enabled: prev.selectedFeatures[featureCode]?.enabled || false,
            [field]: finalValue,
          },
        },
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Save plan first
    await onSave(formData);

    // Then save feature mappings if plan exists
    if (plan && plan._id) {
      try {
        const featureMappings = Object.entries(formData.selectedFeatures)
          .filter(([_, config]) => config.enabled)
          .map(([feature_code, config]) => ({
            feature_code,
            usage_limit: config.usage_limit,
            limit_type: config.limit_type,
            is_enabled: true,
          }));

        await fetch(`/api/super-admin/license-plans/${plan._id}/features`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ features: featureMappings }),
        });
      } catch (error) {
        console.error("Failed to save feature mappings:", error);
      }
    }
  };

  const groupedFeatures = allFeatures
    .filter((feature) => feature.view !== false)
    .reduce((acc, feature) => {
      const category = feature.category || "OTHER";
      if (!acc[category]) acc[category] = [];
      acc[category].push(feature);
      return acc;
    }, {});

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-sm max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="text-xl font-semibold text-gray-900">
            {plan ? "Edit License Plans" : "Create New License Plan"}
          </h3>   
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Basic Information */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Basic Information</h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  License Code *
                </label>
                <input
                  type="text"
                  value={formData.license_code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      license_code: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full px-3 h-9 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="EXPLORE"
                  required
                  disabled={!!plan}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plan Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 h-9 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Explore (Free Trial)"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Perfect for individuals and small teams getting started..."
                required
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Pricing</h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monthly Price (₹) *
                </label>
                <input
                  type="number"
                  value={formData.price_monthly}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price_monthly: parseFloat(e.target.value),
                    })
                  }
                  className="w-full px-3 h-9 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Yearly Price (₹) *
                </label>
                <input
                  type="number"
                  value={formData.price_yearly}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price_yearly: parseFloat(e.target.value),
                    })
                  }
                  className="w-full px-3 h-9 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
            </div>
          </div>

          {/* Limits & Settings */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Limits & Settings</h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trial Days
                </label>
                <input
                  type="number"
                  value={formData.trial_days}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      trial_days: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 h-9 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      display_order: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 h-9 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Flags */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Plan Options</h4>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Active Plan</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_popular}
                  onChange={(e) =>
                    setFormData({ ...formData, is_popular: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Mark as Popular</span>
              </label>
            </div>
          </div>

          {/* Features Management */}
          {plan && (
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                Features & Limits
                <span className="text-xs font-normal text-gray-500">
                  (
                  {
                    Object.values(formData.selectedFeatures).filter(
                      (f) => f.enabled,
                    ).length
                  }{" "}
                  selected)
                </span>
              </h4>

              {featuresLoading ? (
                <div className="flex items-center justify-center p-7">
                  <RefreshCw className="animate-spin text-gray-400" size={24} />
                  <span className="ml-2 text-gray-600">
                    Loading features...
                  </span>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-sm max-h-96 overflow-y-auto">
                  {Object.entries(groupedFeatures).map(
                    ([category, features]) => (
                      <div
                        key={category}
                        className="border-b border-gray-200 last:border-b-0"
                      >
                        <div className="bg-gray-50 px-4 py-2 font-medium text-sm text-gray-700 sticky top-0">
                          {category}
                        </div>
                        <div className="divide-y divide-gray-100">
                          {features
                            .filter(
                              (feature) =>
                                !["REPORT_BASIC", "REPORT_ADV"].includes(
                                  feature.feature_code,
                                ),
                            )
                            .map((feature) => {
                              const isEnabled =
                                formData.selectedFeatures[feature.feature_code]
                                  ?.enabled || false;
                              const usageLimit =
                                formData.selectedFeatures[feature.feature_code]
                                  ?.usage_limit ?? -1;
                              const limitType =
                                formData.selectedFeatures[feature.feature_code]
                                  ?.limit_type || "MONTHLY";

                              return (
                                <div
                                  key={feature.feature_code}
                                  className="p-4 hover:bg-gray-50"
                                >
                                  <div className="flex items-start gap-3">
                                    <input
                                      type="checkbox"
                                      checked={isEnabled}
                                      onChange={() =>
                                        handleFeatureToggle(
                                          feature.feature_code,
                                        )
                                      }
                                      className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium text-sm text-gray-900">
                                          {feature.name}
                                        </p>
                                        <span className="text-xs text-gray-500">
                                          ({feature.feature_code})
                                        </span>
                                      </div>
                                      <p className="text-xs text-gray-600 mt-0.5">
                                        {feature.description}
                                      </p>

                                      {isEnabled && (
                                        <div className="mt-3 grid grid-cols-2 gap-3">
                                          <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                              Usage Limit
                                            </label>
                                            <div className="flex flex-col gap-2">
                                              <input
                                                type="number"
                                                value={
                                                  usageLimit === -1
                                                    ? ""
                                                    : usageLimit
                                                }
                                                onChange={(e) =>
                                                  handleFeatureLimit(
                                                    feature.feature_code,
                                                    "usage_limit",
                                                    e.target.value,
                                                  )
                                                }
                                                disabled={usageLimit === -1}
                                                min="1"
                                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                                placeholder={
                                                  usageLimit === -1
                                                    ? "Unlimited"
                                                    : "Enter count"
                                                }
                                              />
                                              <label className="flex items-center gap-2 cursor-pointer mt-1">
                                                <input
                                                  type="checkbox"
                                                  checked={usageLimit === -1}
                                                  onChange={(e) => {
                                                    const isUnlimited =
                                                      e.target.checked;
                                                    handleFeatureLimit(
                                                      feature.feature_code,
                                                      "usage_limit",
                                                      isUnlimited ? -1 : 100,
                                                    );
                                                  }}
                                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer accent-blue-600"
                                                />
                                                <span className="text-xs text-gray-700 font-medium select-none">
                                                  Unlimited Usage
                                                </span>
                                              </label>
                                            </div>
                                          </div>
                                          <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                              Limit Type
                                            </label>
                                            <select
                                              value={limitType}
                                              onChange={(e) =>
                                                handleFeatureLimit(
                                                  feature.feature_code,
                                                  "limit_type",
                                                  e.target.value,
                                                )
                                              }
                                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 h-9"
                                            >
                                              <option value="MONTHLY">
                                                Monthly
                                              </option>
                                              <option value="TOTAL">
                                                Total
                                              </option>
                                              <option value="NONE">None</option>
                                            </select>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" variant="gradient" disabled={isSaving}>
              {isSaving ? (
                <>
                  <RefreshCw size={18} className="animate-spin mr-2" />{" "}
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} className="mr-2" />{" "}
                  {plan ? "Update Plan" : "Create Plan"}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LicensePlansManagement;
