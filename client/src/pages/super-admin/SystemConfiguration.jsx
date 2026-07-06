import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Zap, Bell, Shield, AlertCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SystemConfiguration() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("feature-flags");

  // Fetch feature flags
  const { data: featureFlags, isLoading: flagsLoading } = useQuery({
    queryKey: ["/api/super-admin/feature-flags"],
    queryFn: async () => {
      const response = await fetch("/api/super-admin/feature-flags", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.ok) throw new Error("Failed to fetch feature flags");
      return response.json();
    },
  });

  // Toggle feature flag
  const toggleFlagMutation = useMutation({
    mutationFn: async ({ flagName, enabled }) => {
      const response = await fetch(
        `/api/super-admin/feature-flags/${flagName}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ enabled }),
        },
      );
      if (!response.ok) throw new Error("Failed to update flag");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/super-admin/feature-flags"],
      });
    },
  });

  const tabs = [
    { id: "feature-flags", label: "Feature Flags", icon: Zap },
    { id: "notification-config", label: "Notifications", icon: Bell },
    { id: "integrations", label: "Integrations", icon: Shield },
  ];

  return (
    <div className="space-y-3 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-purple-100 rounded-sm flex items-center justify-center border border-purple-200">
          <Settings className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            System Configuration
          </h2>
          <p className="text-gray-600 mt-1">
            Manage platform-wide settings and features
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant="ghost"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-none border-b-2 transition-all ${
                  activeTab === tab.id
                    ? "border-purple-600 text-purple-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Feature Flags Tab */}
      {activeTab === "feature-flags" && (
        <div className="bg-white rounded-sm border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Global Feature Flags
          </h3>

          {flagsLoading ? (
            <div className="text-center py-8 text-gray-500">
              Loading feature flags...
            </div>
          ) : (
            <div className="space-y-3">
              {featureFlags?.data?.map((flag) => (
                <div
                  key={flag._id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-sm hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{flag.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {flag.description}
                    </p>
                    {flag.rollout_percentage < 100 && (
                      <p className="text-xs text-orange-600 mt-2">
                        Rollout: {flag.rollout_percentage}%
                      </p>
                    )}
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={flag.enabled}
                      onChange={(e) =>
                        toggleFlagMutation.mutate({
                          flagName: flag.name,
                          enabled: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-14 h-8 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notification Config Tab */}
      {activeTab === "notification-config" && (
        <div className="bg-white rounded-sm border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Notification Configuration
          </h3>
          <div className="space-y-3">
            <div className="p-4 border border-gray-200 rounded-sm">
              <label className="flex items-center gap-3">
                <input type="checkbox" defaultChecked className="w-4 h-4" />
                <span className="font-medium text-gray-900">
                  Enable Email Notifications
                </span>
              </label>
              <p className="text-sm text-gray-600 mt-2 ml-7">
                Allow system to send email notifications
              </p>
            </div>
            <div className="p-4 border border-gray-200 rounded-sm">
              <label className="flex items-center gap-3">
                <input type="checkbox" defaultChecked className="w-4 h-4" />
                <span className="font-medium text-gray-900">
                  Enable Push Notifications
                </span>
              </label>
              <p className="text-sm text-gray-600 mt-2 ml-7">
                Allow system to send push notifications
              </p>
            </div>
            <div className="p-4 border border-gray-200 rounded-sm">
              <label className="flex items-center gap-3">
                <input type="checkbox" className="w-4 h-4" />
                <span className="font-medium text-gray-900">
                  Enable SMS Notifications (Future)
                </span>
              </label>
              <p className="text-sm text-gray-600 mt-2 ml-7">
                Allow system to send SMS notifications
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === "integrations" && (
        <div className="bg-white rounded-sm border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Integration Settings
          </h3>
          <div className="space-y-3">
            <div className="p-4 border border-gray-200 rounded-sm">
              <h4 className="font-semibold text-gray-900 mb-3">
                SSO Configuration
              </h4>
              <input
                type="text"
                placeholder="SSO Provider URL"
                className="w-full h-9 px-3 border border-gray-300 rounded-sm mb-2"
              />
              <input
                type="text"
                placeholder="Client ID"
                className="w-full h-9 px-3 border border-gray-300 rounded-sm"
              />
            </div>
            <div className="p-4 border border-gray-200 rounded-sm">
              <h4 className="font-semibold text-gray-900 mb-3">
                OAuth Configuration
              </h4>
              <input
                type="text"
                placeholder="OAuth Client ID"
                className="w-full h-9 px-3 border border-gray-300 rounded-sm mb-2"
              />
              <input
                type="text"
                placeholder="OAuth Client Secret"
                className="w-full h-9 px-3 border border-gray-300 rounded-sm"
              />
            </div>
            <Button variant="primary" className="h-9 flex items-center gap-2">
              <Save className="w-4 h-4" />
              Save Configuration
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
