import { useState } from "react";
import {
  CreditCard,
  TrendingUp,
  Building2,
  Users,
  IndianRupee,
  Activity,
  Settings,
  Plus,
  Edit,
  Eye,
  Search,
  Filter,
  Download,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import OrganizationSubscriptionModal from "../../components/super-admin/OrganizationSubscriptionModal";
import SubscriptionAnalytics from "../../components/super-admin/SubscriptionAnalytics";
import PlanManagementModal from "../../components/super-admin/PlanManagementModal";

const SubscriptionManagement = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(false);

  // Function to convert technical feature codes to user-friendly names
  const getFeatureDisplayName = (featureName) => {
    const featureMap = {
      API_ACCESS: "API Access",
      FORM_CREATE: "Form Creation",
      NOTIF_ADV: "Advanced Notifications",
      NOTIF_BASIC: "Basic Notifications",
      REPORT_BASIC: "Basic Reports",
      REPORT_TASK_STATUS: "Task Status Report",
      REPORT_OVERDUE: "Overdue Tasks Report",
      REPORT_PRODUCTIVITY: "Productivity Report",
      REPORT_WORKLOAD: "Workload Report",
      REPORT_MILESTONE: "Milestone Report",
      REPORT_RECURRING: "Recurring Adherence Report",
      REPORT_QUICK_CONVERSION: "Quick Task Conversion",
      REPORT_ACTIVITY: "Activity Report",
      TASK_BASIC: "Basic Task Management",
      DED_SUPPORT: "Dedicated Support",
      USER_MANAGEMENT: "User Management",
      ANALYTICS: "Analytics Dashboard",
      CUSTOM_BRANDING: "Custom Branding",
      INTEGRATIONS: "Third-party Integrations",
      WORKFLOW_AUTOMATION: "Workflow Automation",
      DATA_EXPORT: "Data Export",
      BACKUP_RESTORE: "Backup & Restore",
      PRIORITY_SUPPORT: "Priority Support",
    };
    return featureMap[featureName] || featureName;
  };

  // Fetch subscription overview data
  const { data: subscriptionStats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/super-admin/subscription-stats"],
    queryFn: async () => {
      const response = await fetch("/api/super-admin/subscription-stats", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.ok) throw new Error("Failed to fetch subscription stats");
      return response.json();
    },
  });

  // Fetch organization subscriptions
  const {
    data: orgSubscriptions,
    isLoading: orgsLoading,
    refetch: refetchOrgs,
  } = useQuery({
    queryKey: [
      "/api/super-admin/organization-subscriptions",
      searchTerm,
      filterStatus,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (filterStatus !== "all") params.append("status", filterStatus);

      const response = await fetch(
        `/api/super-admin/organization-subscriptions?${params}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      if (!response.ok)
        throw new Error("Failed to fetch organization subscriptions");
      return response.json();
    },
  });

  // Fetch license plans
  const { data: licensePlans, isLoading: plansLoading } = useQuery({
    queryKey: ["/api/super-admin/license-plans"],
    queryFn: async () => {
      const response = await fetch("/api/super-admin/license-plans", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.ok) throw new Error("Failed to fetch license plans");
      return response.json();
    },
  });

  const tabs = [
    { id: "overview", label: "Overview", icon: Activity },
    {
      id: "organizations",
      label: "Organization Subscriptions",
      icon: Building2,
    },
    { id: "plans", label: "License Plans", icon: CreditCard },
    { id: "analytics", label: "Antics", icon: TrendingUp },
  ];

  const renderOverview = () => (
    <div className="space-y-3">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-sm shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-sm">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                Total Organizations
              </p>
              <p className="text-2xl font-semibold text-gray-900">
                {subscriptionStats?.totalOrganizations || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-sm shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-sm">
              <CreditCard className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                Active Subscriptions
              </p>
              <p className="text-2xl font-semibold text-gray-900">
                {subscriptionStats?.activeSubscriptions || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-sm shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-sm">
              <IndianRupee className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                Monthly Revenue
              </p>
              <p className="text-2xl font-semibold text-gray-900">
                ₹{subscriptionStats?.monthlyRevenue || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-sm shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-sm">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                Trial Organizations
              </p>
              <p className="text-2xl font-semibold text-gray-900">
                {subscriptionStats?.trialOrganizations || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Distribution Chart */}
      <div className="bg-white rounded-sm shadow p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-3">
          Plan Distribution
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {subscriptionStats?.planDistribution?.map((plan) => (
            <div key={plan.planName} className="text-center">
              <div className="text-2xl font-semibold text-gray-900">
                {plan.count}
              </div>
              <div className="text-sm text-gray-600">{plan.planName}</div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${plan.percentage}%` }}
                ></div>
              </div>
            </div>
          )) || []}
        </div>
      </div>

      {/* Recent Subscription Activity */}
      <div className="bg-white rounded-sm shadow p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-3">
          Recent Subscription Activity
        </h3>
        <div className="space-y-3">
          {subscriptionStats?.recentActivity?.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center justify-between py-2"
            >
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {activity.organizationName}
                  </p>
                  <p className="text-xs text-gray-600">{activity.action}</p>
                </div>
              </div>
              <div className="text-xs text-gray-500">{activity.timestamp}</div>
            </div>
          )) || []}
        </div>
      </div>
    </div>
  );

  const renderOrganizations = () => (
    <div className="space-y-3">
      {/* Filters and Search */}
      <div className="bg-white rounded-sm shadow p-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-3 md:space-y-0">
          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search organizations..."
                className="pl-10 pr-4 h-9 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="px-4 h-9 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => refetchOrgs()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="gradient">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Organizations Table */}
      <div className="bg-white rounded-sm shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Organization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Users
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orgSubscriptions?.organizations?.map((org) => (
                <tr key={org.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {org.name}
                      </div>
                      <div className="text-sm text-gray-500">{org.domain}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {org.currentPlan}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        org.status === "active"
                          ? "bg-green-100 text-green-800"
                          : org.status === "trial"
                            ? "bg-yellow-100 text-yellow-800"
                            : org.status === "expired"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {org.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {org.userCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {org.expiresAt
                      ? new Date(org.expiresAt).toLocaleDateString()
                      : "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₹{org.monthlyRevenue}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedOrganization(org);
                          setShowSubscriptionModal(true);
                        }}
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )) || []}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderPlans = () => (
    <div className="space-y-3">
      {/* Plans Header */}
      <div className="bg-white rounded-sm shadow p-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            License Plans Management
          </h3>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {licensePlans?.plans?.map((plan) => (
          <div
            key={plan.license_code}
            className="bg-white rounded-sm shadow p-4"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="text-lg font-medium text-gray-900">
                  {plan.license_name}
                </h4>
                <p className="text-sm text-gray-600">{plan.license_code}</p>
              </div>
              <div className="flex space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSelectedPlan(plan);
                    setShowPlanModal(true);
                  }}
                  title="Edit Plan"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" title="Plan Settings">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Monthly Price:</span>
                <span className="text-sm font-medium text-gray-900">
                  ₹{plan.monthly_price || "0"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Annual Price:</span>
                <span className="text-sm font-medium text-gray-900">
                  ₹{plan.annual_price || "0"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">
                  Active Organizations:
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {plan.organizationCount || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Status:</span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    plan.is_active
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {plan.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <h5 className="text-sm font-medium text-gray-900 mb-2">
                Features:
              </h5>
              <div className="space-y-1">
                {plan.features?.slice(0, 3).map((feature) => (
                  <div
                    key={feature.feature_code}
                    className="text-xs text-gray-600"
                  >
                    • {getFeatureDisplayName(feature.feature_name)}:{" "}
                    {feature.usage_limit === -1
                      ? "Unlimited"
                      : feature.usage_limit}
                  </div>
                ))}
                {plan.features?.length > 3 && (
                  <div className="text-xs text-blue-600">
                    +{plan.features.length - 3} more features
                  </div>
                )}
              </div>
            </div>
          </div>
        )) || []}
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-3">
      <SubscriptionAnalytics subscriptionStats={subscriptionStats} />
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-white rounded-sm shadow p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Subscription Management
            </h1>
            <p className="text-gray-600 mt-1">
              Manage organization subscriptions, plans, and billing
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-500">
              Last updated: {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-sm shadow">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-3 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.id}
                  variant="ghost"
                  onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap py-4 px-1 rounded-none border-b-2 font-medium text-sm flex items-center ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </Button>
              );
            })}
          </nav>
        </div>

        <div className="p-4">
          {activeTab === "overview" && renderOverview()}
          {activeTab === "organizations" && renderOrganizations()}
          {activeTab === "plans" && renderPlans()}
          {activeTab === "analytics" && renderAnalytics()}
        </div>
      </div>

      {/* Subscription Modal */}
      <OrganizationSubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => {
          setShowSubscriptionModal(false);
          setSelectedOrganization(null);
        }}
        organization={selectedOrganization}
      />

      {/* Plan Management Modal */}
      <PlanManagementModal
        isOpen={showPlanModal}
        onClose={() => {
          setShowPlanModal(false);
          setSelectedPlan(null);
        }}
        plan={selectedPlan}
      />
    </div>
  );
};

export default SubscriptionManagement;
