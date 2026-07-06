import { useState, useEffect } from "react";
import {
  X,
  Save,
  Plus,
  Minus,
  Settings,
  CreditCard,
  Tag,
  DollarSign,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

const PlanManagementModal = ({ isOpen, onClose, plan = null }) => {
  const [formData, setFormData] = useState({
    license_code: "",
    license_name: "",
    description: "",
    monthly_price: "",
    annual_price: "",
    is_active: true,
    features: [],
  });

  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const queryClient = useQueryClient();

  // Fetch available features
  const { data: availableFeatures } = useQuery({
    queryKey: ["/api/license/features"],
    queryFn: async () => {
      const response = await fetch("/api/license/features", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.ok) throw new Error("Failed to fetch features");
      return response.json();
    },
    enabled: isOpen,
  });

  useEffect(() => {
    if (plan) {
      setFormData({
        license_code: plan.license_code || "",
        license_name: plan.license_name || "",
        description: plan.description || "",
        monthly_price: plan.monthly_price || "",
        annual_price: plan.annual_price || "",
        is_active: plan.is_active !== undefined ? plan.is_active : true,
        features: plan.features || [],
      });
      setSelectedFeatures(
        plan.features?.map((f) => ({
          feature_code: f.feature_code,
          usage_limit: f.usage_limit,
          is_enabled: f.is_enabled !== undefined ? f.is_enabled : true,
        })) || [],
      );
    } else {
      setFormData({
        license_code: "",
        license_name: "",
        description: "",
        monthly_price: "",
        annual_price: "",
        is_active: true,
        features: [],
      });
      setSelectedFeatures([]);
    }
  }, [plan, isOpen]);

  const createOrUpdatePlan = useMutation({
    mutationFn: async (data) => {
      const url = plan
        ? `/api/super-admin/license-plans/${plan.license_code}`
        : "/api/super-admin/license-plans";

      const response = await fetch(url, {
        method: plan ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok)
        throw new Error(`Failed to ${plan ? "update" : "create"} plan`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/super-admin/license-plans"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/super-admin/subscription-stats"],
      });
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const planData = {
      ...formData,
      monthly_price: formData.monthly_price
        ? parseFloat(formData.monthly_price)
        : null,
      annual_price: formData.annual_price
        ? parseFloat(formData.annual_price)
        : null,
      features: selectedFeatures,
    };
    createOrUpdatePlan.mutate(planData);
  };

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleFeatureToggle = (featureCode) => {
    const existingFeature = selectedFeatures.find(
      (f) => f.feature_code === featureCode,
    );

    if (existingFeature) {
      setSelectedFeatures((prev) =>
        prev.filter((f) => f.feature_code !== featureCode),
      );
    } else {
      setSelectedFeatures((prev) => [
        ...prev,
        {
          feature_code: featureCode,
          usage_limit: -1,
          is_enabled: true,
        },
      ]);
    }
  };

  const handleFeatureLimit = (featureCode, limit) => {
    setSelectedFeatures((prev) =>
      prev.map((f) =>
        f.feature_code === featureCode
          ? { ...f, usage_limit: limit === "" ? 0 : parseInt(limit) || 0 }
          : f,
      ),
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {plan ? "Edit License Plan" : "Create New License Plan"}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {plan
                ? "Update existing plan details and features"
                : "Define a new subscription plan for organizations"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Basic Plan Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Tag className="inline h-4 w-4 mr-1" />
                Plan Code *
              </label>
              <input
                type="text"
                name="license_code"
                value={formData.license_code}
                onChange={handleChange}
                placeholder="e.g., PREMIUM"
                className="w-full px-3 h-9 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={!!plan}
              />
              <p className="text-xs text-gray-500 mt-1">
                {plan
                  ? "Plan code cannot be changed"
                  : "Unique identifier for the plan"}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Plan Name *
              </label>
              <input
                type="text"
                name="license_name"
                value={formData.license_name}
                onChange={handleChange}
                placeholder="e.g., Premium Plan"
                className="w-full px-3 h-9 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                placeholder="Describe what this plan includes..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <DollarSign className="inline h-4 w-4 mr-1" />
                Monthly Price
              </label>
              <input
                type="number"
                name="monthly_price"
                value={formData.monthly_price}
                onChange={handleChange}
                placeholder="29.99"
                step="0.01"
                min="0"
                className="w-full px-3 h-9 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty for free plans
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Annual Price
              </label>
              <input
                type="number"
                name="annual_price"
                value={formData.annual_price}
                onChange={handleChange}
                placeholder="299.99"
                step="0.01"
                min="0"
                className="w-full px-3 h-9 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Typically 10-20% discount from monthly
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      is_active: e.target.checked,
                    }))
                  }
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">
                  Plan is active and available for selection
                </span>
              </label>
            </div>
          </div>

          {/* Features Selection */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              <Settings className="inline h-5 w-5 mr-2" />
              Plan Features
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableFeatures?.features?.map((feature) => {
                const selectedFeature = selectedFeatures.find(
                  (f) => f.feature_code === feature.feature_code,
                );
                const isSelected = !!selectedFeature;

                return (
                  <div
                    key={feature.feature_code}
                    className={`border rounded-sm p-4 transition-colors ${
                      isSelected
                        ? "border-blue-300 bg-blue-50"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() =>
                            handleFeatureToggle(feature.feature_code)
                          }
                          className="mr-3"
                        />
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">
                            {feature.feature_name}
                          </h4>
                          <p className="text-xs text-gray-500">
                            {feature.feature_code}
                          </p>
                        </div>
                      </div>
                      {isSelected ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-300" />
                      )}
                    </div>

                    {isSelected && (
                      <div className="mt-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Usage Limit
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            value={
                              selectedFeature.usage_limit === -1
                                ? ""
                                : selectedFeature.usage_limit
                            }
                            onChange={(e) =>
                              handleFeatureLimit(
                                feature.feature_code,
                                e.target.value,
                              )
                            }
                            placeholder="Unlimited"
                            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleFeatureLimit(feature.feature_code, -1)
                            }
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Unlimited
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {selectedFeature.usage_limit === -1
                            ? "Unlimited usage"
                            : selectedFeature.usage_limit === 0
                              ? "Feature disabled"
                              : `Limited to ${selectedFeature.usage_limit} uses`}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="gradient"
              disabled={createOrUpdatePlan.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {createOrUpdatePlan.isPending
                ? plan
                  ? "Updating..."
                  : "Creating..."
                : plan
                  ? "Update Plan"
                  : "Create Plan"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlanManagementModal;
