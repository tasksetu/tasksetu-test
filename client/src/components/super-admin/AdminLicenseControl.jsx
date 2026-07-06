import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Shield,
  Download,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  CreditCard,
  Activity,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card } from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useToast } from "@/hooks/use-toast";

// Use empty string for relative URLs - requests will go through Vite proxy
const API_URL = "";

// Status badge component
const StatusBadge = ({ status }) => {
  const statusConfig = {
    ACTIVE: {
      color: "bg-green-100 text-green-800",
      icon: CheckCircle,
      label: "Active",
    },
    TRIAL: { color: "bg-blue-100 text-blue-800", icon: Clock, label: "Trial" },
    EXPIRED: {
      color: "bg-red-100 text-red-800",
      icon: XCircle,
      label: "Expired",
    },
    SUSPENDED: {
      color: "bg-orange-100 text-orange-800",
      icon: AlertCircle,
      label: "Suspended",
    },
    CANCELLED: {
      color: "bg-gray-100 text-gray-800",
      icon: XCircle,
      label: "Cancelled",
    },
  };

  const config = statusConfig[status] || statusConfig.TRIAL;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};

// Confirmation Modal Component
const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  requiresTyping = false,
  isDestructive = false,
}) => {
  const [confirmInput, setConfirmInput] = useState("");
  const canConfirm = !requiresTyping || confirmInput === "CONFIRM";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle
              className={`w-5 h-5 ${isDestructive ? "text-red-500" : "text-orange-500"}`}
            />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-gray-600 mb-3">{message}</p>
          {requiresTyping && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Type "CONFIRM" to proceed:</p>
              <Input
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value.toUpperCase())}
                placeholder="Type CONFIRM"
                className="uppercase"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              setConfirmInput("");
            }}
            disabled={!canConfirm}
            className={isDestructive ? "bg-red-500 hover:bg-red-600" : ""}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const AdminLicenseControl = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [overrideModal, setOverrideModal] = useState({
    isOpen: false,
    data: null,
  });
  const [extendModal, setExtendModal] = useState({ isOpen: false, data: null });
  const [suspendModal, setSuspendModal] = useState({
    isOpen: false,
    suspend: true,
  });
  const [featureModal, setFeatureModal] = useState({
    isOpen: false,
    data: null,
  });
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    config: null,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Search organizations
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["organizations-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return { data: [], pagination: { total: 0 } };

      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/api/super-admin/organizations/search?q=${encodeURIComponent(searchQuery)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) throw new Error("Failed to search organizations");
      return response.json();
    },
    enabled: searchQuery.length > 0,
  });

  // Get organization details
  const {
    data: orgDetails,
    isLoading: isLoadingDetails,
    refetch: refetchDetails,
  } = useQuery({
    queryKey: ["organization-details", selectedOrg],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/api/super-admin/organizations/${selectedOrg}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) throw new Error("Failed to fetch organization details");
      return response.json();
    },
    enabled: !!selectedOrg,
  });

  // Get audit logs
  const { data: auditLogs } = useQuery({
    queryKey: ["audit-logs", selectedOrg],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const url = selectedOrg
        ? `${API_URL}/api/super-admin/audit-logs?organizationId=${selectedOrg}&limit=20`
        : `${API_URL}/api/super-admin/audit-logs?limit=20`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch audit logs");
      return response.json();
    },
  });

  // Override license mutation
  const overrideLicenseMutation = useMutation({
    mutationFn: async (data) => {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/api/super-admin/organizations/${selectedOrg}/override-license`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to override license");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "License overridden successfully",
      });
      queryClient.invalidateQueries(["organization-details", selectedOrg]);
      queryClient.invalidateQueries(["audit-logs"]);
      setOverrideModal({ isOpen: false, data: null });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Extend trial mutation
  const extendTrialMutation = useMutation({
    mutationFn: async (data) => {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/api/super-admin/organizations/${selectedOrg}/extend-trial`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to extend trial");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Trial extended successfully",
      });
      queryClient.invalidateQueries(["organization-details", selectedOrg]);
      queryClient.invalidateQueries(["audit-logs"]);
      setExtendModal({ isOpen: false, data: null });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Suspend license mutation
  const suspendLicenseMutation = useMutation({
    mutationFn: async (data) => {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/api/super-admin/organizations/${selectedOrg}/suspend`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update license status");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Success",
        description: variables.suspend
          ? "License suspended"
          : "License reactivated",
      });
      queryClient.invalidateQueries(["organization-details", selectedOrg]);
      queryClient.invalidateQueries(["audit-logs"]);
      setSuspendModal({ isOpen: false, suspend: true });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Override feature flag mutation
  const overrideFeatureMutation = useMutation({
    mutationFn: async (data) => {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/api/super-admin/organizations/${selectedOrg}/feature-flags`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to override feature flag");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Feature flag updated",
      });
      queryClient.invalidateQueries(["organization-details", selectedOrg]);
      queryClient.invalidateQueries(["audit-logs"]);
      setFeatureModal({ isOpen: false, data: null });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Export organizations
  const handleExport = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/api/super-admin/export/organizations?format=csv`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) throw new Error("Failed to export data");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `organizations-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "Organizations exported successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const organization = orgDetails?.data?.organization;
  const subscription = orgDetails?.data?.subscription;
  const users = orgDetails?.data?.users || [];
  const usageStats = orgDetails?.data?.usageStats || [];

  return (
    <div className="space-y-3 p-4">
      {/* Header with Search */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-sm flex items-center justify-center border border-blue-200">
            <Shield className="w-7 h-7 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-4xl font-bold flex items-center gap-2">
              License Control
            </h2>
            <p className="text-gray-500 mt-1">
              Manage organization licenses and access
            </p>
          </div>
        </div>
        <Button onClick={handleExport} className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export All
        </Button>
      </div>

      {/* Search Bar */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            type="text"
            placeholder="Search by organization name, email, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 w-full"
          />
        </div>

        {/* Search Results */}
        {isSearching && (
          <div className="mt-4 text-center text-sm text-gray-500">
            Searching...
          </div>
        )}

        {searchResults?.data?.length > 0 && (
          <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
            {searchResults.data.map((org) => (
              <div
                key={org._id}
                onClick={() => {
                  setSelectedOrg(org._id);
                  setSearchQuery("");
                }}
                className="p-3 border rounded-sm hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{org.name}</p>
                    <p className="text-sm text-gray-500">{org.email}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={org.subscription?.status || "TRIAL"} />
                    <p className="text-xs text-gray-500 mt-1">
                      {org.userCount} user{org.userCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {searchQuery && !isSearching && searchResults?.data?.length === 0 && (
          <div className="mt-4 text-center text-sm text-gray-500">
            No organizations found matching "{searchQuery}"
          </div>
        )}
      </Card>

      {/* Organization Details */}
      {selectedOrg && !isLoadingDetails && organization && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Left Panel - Organization Profile */}
          <Card className="p-4 lg:col-span-1">
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  {organization.name}
                </h3>
                <p className="text-sm text-gray-600">{organization.email}</p>
                {organization.phone && (
                  <p className="text-sm text-gray-600">{organization.phone}</p>
                )}
              </div>

              <div className="pt-4 border-t space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <StatusBadge status={subscription?.status || "TRIAL"} />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Plan:</span>
                  <span className="text-sm font-medium">
                    {subscription?.license_code || "NONE"}
                  </span>
                </div>

                {subscription?.expiry_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Expires:</span>
                    <span className="text-sm font-medium">
                      {new Date(subscription.expiry_date).toLocaleDateString()}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Seats:</span>
                  <span className="text-sm font-medium">
                    {subscription?.seats_used || 0} /{" "}
                    {subscription?.seats_purchased || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Users:</span>
                  <span className="text-sm font-medium">{users.length}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t space-y-2">
                <Button
                  onClick={() => setOverrideModal({ isOpen: true, data: {} })}
                  className="w-full"
                  variant="outline"
                >
                  Override License
                </Button>

                <Button
                  onClick={() => setExtendModal({ isOpen: true, data: {} })}
                  className="w-full"
                  variant="outline"
                >
                  Extend Trial
                </Button>

                {subscription?.status === "SUSPENDED" ? (
                  <Button
                    onClick={() => {
                      setConfirmModal({
                        isOpen: true,
                        config: {
                          title: "Reactivate License",
                          message:
                            "Are you sure you want to reactivate this organization's license?",
                          confirmText: "Reactivate",
                          requiresTyping: false,
                          onConfirm: () => {
                            const reason = prompt(
                              "Enter reason for reactivation:",
                            );
                            if (reason) {
                              suspendLicenseMutation.mutate({
                                suspend: false,
                                reason,
                              });
                            }
                          },
                        },
                      });
                    }}
                    className="w-full bg-green-500 hover:bg-green-600"
                  >
                    Reactivate License
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setConfirmModal({
                        isOpen: true,
                        config: {
                          title: "Suspend License",
                          message:
                            "This will immediately block access for all users in this organization. This action requires confirmation.",
                          confirmText: "Suspend",
                          requiresTyping: true,
                          isDestructive: true,
                          onConfirm: () => {
                            const reason = prompt(
                              "Enter reason for suspension:",
                            );
                            if (reason) {
                              suspendLicenseMutation.mutate({
                                suspend: true,
                                reason,
                              });
                            }
                          },
                        },
                      });
                    }}
                    className="w-full bg-red-500 hover:bg-red-600"
                  >
                    Suspend License
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Right Panel - Detailed Information */}
          <Card className="p-4 lg:col-span-2">
            <Tabs defaultValue="license" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="license">License & Usage</TabsTrigger>
                <TabsTrigger value="users">Users</TabsTrigger>
                <TabsTrigger value="features">Features</TabsTrigger>
                <TabsTrigger value="audit">Audit Log</TabsTrigger>
              </TabsList>

              {/* License & Usage Tab */}
              <TabsContent value="license" className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-blue-50 rounded-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">
                        Billing Cycle
                      </span>
                    </div>
                    <p className="text-lg font-bold text-blue-900">
                      {subscription?.billing_cycle || "NONE"}
                    </p>
                  </div>

                  <div className="p-4 bg-green-50 rounded-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-900">
                        Available Seats
                      </span>
                    </div>
                    <p className="text-lg font-bold text-green-900">
                      {(subscription?.seats_purchased || 0) -
                        (subscription?.seats_used || 0)}
                    </p>
                  </div>
                </div>

                {usageStats.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Feature Usage</h4>
                    <div className="space-y-2">
                      {usageStats.map((stat, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                        >
                          <span className="text-sm">{stat.feature_code}</span>
                          <span className="text-sm font-medium">
                            {stat.usage_count} / {stat.usage_limit || "∞"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Users Tab */}
              <TabsContent value="users" className="space-y-2">
                {users.map((user) => (
                  <div key={user._id} className="p-3 border rounded-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded-md">
                          {Array.isArray(user.role)
                            ? user.role.join(", ")
                            : user.role}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">
                          {user.status}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </TabsContent>

              {/* Features Tab */}
              <TabsContent value="features" className="space-y-2">
                <p className="text-sm text-gray-500 mb-3">
                  Override specific features for this organization
                </p>
                <Button
                  onClick={() => setFeatureModal({ isOpen: true, data: {} })}
                  variant="outline"
                  className="w-full"
                >
                  Add Feature Override
                </Button>

                {subscription?.feature_overrides?.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {subscription.feature_overrides.map((override, index) => (
                      <div key={index} className="p-3 border rounded-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {override.feature_code}
                            </p>
                            <p className="text-xs text-gray-500">
                              {override.reason}
                            </p>
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded ${override.enabled ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                          >
                            {override.enabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Audit Log Tab */}
              <TabsContent value="audit" className="space-y-2">
                {auditLogs?.data?.map((log) => (
                  <div key={log._id} className="p-3 border rounded-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium">
                        {log.action.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                    {log.actor_id && (
                      <p className="text-xs text-gray-600">
                        By: {log.actor_id.firstName} {log.actor_id.lastName} (
                        {log.actor_id.email})
                      </p>
                    )}
                    {log.change_summary && (
                      <p className="text-xs text-gray-600 mt-1">
                        Summary: {log.change_summary}
                      </p>
                    )}
                    {log.changes && (
                      <p className="text-xs text-gray-600 mt-1">
                        Details: {JSON.stringify(log.changes)}
                      </p>
                    )}
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      )}

      {/* Modals */}
      {overrideModal.isOpen && (
        <Dialog
          open={overrideModal.isOpen}
          onOpenChange={() => setOverrideModal({ isOpen: false, data: null })}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Override License</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                overrideLicenseMutation.mutate({
                  license_code: formData.get("license_code"),
                  billing_cycle: formData.get("billing_cycle"),
                  seats: parseInt(formData.get("seats")),
                  reason: formData.get("reason"),
                });
              }}
            >
              <div className="space-y-3 py-4">
                <div>
                  <label className="text-sm font-medium">License Plan</label>
                  <Input
                    name="license_code"
                    placeholder="e.g., EXECUTE, OPTIMIZE"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Billing Cycle</label>
                  <select
                    name="billing_cycle"
                    className="w-full border rounded-md px-3 h-9"
                    required
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Seats</label>
                  <Input
                    name="seats"
                    type="number"
                    min="1"
                    defaultValue="10"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Reason</label>
                  <textarea
                    name="reason"
                    className="w-full border rounded-md px-3 py-2"
                    rows="3"
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setOverrideModal({ isOpen: false, data: null })
                  }
                >
                  Cancel
                </Button>
                <Button type="submit">Override License</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {extendModal.isOpen && (
        <Dialog
          open={extendModal.isOpen}
          onOpenChange={() => setExtendModal({ isOpen: false, data: null })}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Extend Trial Period</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                extendTrialMutation.mutate({
                  days: parseInt(formData.get("days")),
                  reason: formData.get("reason"),
                });
              }}
            >
              <div className="space-y-3 py-4">
                <div>
                  <label className="text-sm font-medium">
                    Extend by (days)
                  </label>
                  <select
                    name="days"
                    className="w-full border rounded-md px-3 h-9"
                    required
                  >
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                    <option value="30">30 days</option>
                    <option value="60">60 days</option>
                    <option value="90">90 days</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Reason</label>
                  <textarea
                    name="reason"
                    className="w-full border rounded-md px-3 py-2"
                    rows="3"
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setExtendModal({ isOpen: false, data: null })}
                >
                  Cancel
                </Button>
                <Button type="submit">Extend Trial</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {featureModal.isOpen && (
        <Dialog
          open={featureModal.isOpen}
          onOpenChange={() => setFeatureModal({ isOpen: false, data: null })}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Override Feature Flag</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                overrideFeatureMutation.mutate({
                  feature_code: formData.get("feature_code"),
                  enabled: formData.get("enabled") === "true",
                  reason: formData.get("reason"),
                });
              }}
            >
              <div className="space-y-3 py-4">
                <div>
                  <label className="text-sm font-medium">Feature Code</label>
                  <Input
                    name="feature_code"
                    placeholder="e.g., CUSTOM_FORMS, RECURRING_TASKS"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <select
                    name="enabled"
                    className="w-full border rounded-md px-3 h-9"
                    required
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Reason</label>
                  <textarea
                    name="reason"
                    className="w-full border rounded-md px-3 py-2"
                    rows="3"
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFeatureModal({ isOpen: false, data: null })}
                >
                  Cancel
                </Button>
                <Button type="submit">Update Feature</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {confirmModal.isOpen && confirmModal.config && (
        <ConfirmationModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal({ isOpen: false, config: null })}
          onConfirm={() => {
            confirmModal.config.onConfirm();
            setConfirmModal({ isOpen: false, config: null });
          }}
          {...confirmModal.config}
        />
      )}
    </div>
  );
};
