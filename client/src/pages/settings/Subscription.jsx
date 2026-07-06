import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  CreditCard,
  Users,
  CheckCircle,
  AlertCircle,
  Mail,
  Clock,
  XCircle,
  UserX,
  RotateCcw,
  Shield,
  TrendingUp,
  Calendar,
  BarChart3,
  Info,
  Check,
  X,
} from "lucide-react";
import { getInitials, cn } from "@/lib/utils";
import { PLAN_ORDER } from "@/utils/licenseConstants";

/**
 * License Differences Section - Shows detailed feature differences between plans
 */
function LicenseDifferencesSection({ plans, currentPlanCode }) {
  const orderedPlans = PLAN_ORDER.filter((key) => plans && plans[key]).map(
    (key) => ({ key, ...plans[key] }),
  );

  // Define feature categories with their limits per plan
  const featureCategories = [
    {
      category: "Usage Limits",
      icon: "📊",
      features: [
        {
          name: "Tasks",
          code: "TASK_BASIC",
          limits: { explore: 10, plan: 50, execute: 200, optimize: -1 },
        },
        {
          name: "Forms",
          code: "FORM_CREATE",
          limits: { explore: 2, plan: 10, execute: 50, optimize: -1 },
        },
        {
          name: "Processes",
          code: "PROC_CREATE",
          limits: { explore: 1, plan: 5, execute: 20, optimize: -1 },
        },
        {
          name: "Reports",
          code: "REPORT_BASIC",
          limits: { explore: 5, plan: 25, execute: 100, optimize: -1 },
        },
      ],
    },
    {
      category: "Core Features",
      icon: "⚡",
      features: [
        {
          name: "Task Management",
          limits: { explore: true, plan: true, execute: true, optimize: true },
        },
        {
          name: "Basic Reporting",
          limits: { explore: true, plan: true, execute: true, optimize: true },
        },
        {
          name: "Team Collaboration",
          limits: { explore: false, plan: true, execute: true, optimize: true },
        },
        {
          name: "File Attachments",
          limits: {
            explore: "5MB",
            plan: "25MB",
            execute: "100MB",
            optimize: "Unlimited",
          },
        },
      ],
    },
    {
      category: "Advanced Features",
      icon: "🚀",
      features: [
        {
          name: "Custom Forms",
          limits: { explore: false, plan: true, execute: true, optimize: true },
        },
        {
          name: "Workflow Automation",
          limits: {
            explore: false,
            plan: false,
            execute: true,
            optimize: true,
          },
        },
        {
          name: "Advanced Analytics",
          limits: {
            explore: false,
            plan: false,
            execute: true,
            optimize: true,
          },
        },
        {
          name: "API Access",
          limits: {
            explore: false,
            plan: false,
            execute: "Limited",
            optimize: "Full",
          },
        },
      ],
    },
    {
      category: "Premium Features",
      icon: "👑",
      features: [
        {
          name: "Priority Support",
          limits: {
            explore: false,
            plan: false,
            execute: false,
            optimize: true,
          },
        },
        {
          name: "Custom Integrations",
          limits: {
            explore: false,
            plan: false,
            execute: false,
            optimize: true,
          },
        },
        {
          name: "White Labeling",
          limits: {
            explore: false,
            plan: false,
            execute: false,
            optimize: true,
          },
        },
        {
          name: "Dedicated Account Manager",
          limits: {
            explore: false,
            plan: false,
            execute: false,
            optimize: true,
          },
        },
      ],
    },
    {
      category: "Support & Security",
      icon: "🔒",
      features: [
        {
          name: "Email Support",
          limits: { explore: true, plan: true, execute: true, optimize: true },
        },
        {
          name: "Chat Support",
          limits: { explore: false, plan: true, execute: true, optimize: true },
        },
        {
          name: "Phone Support",
          limits: {
            explore: false,
            plan: false,
            execute: true,
            optimize: true,
          },
        },
        {
          name: "SSO/SAML",
          limits: {
            explore: false,
            plan: false,
            execute: false,
            optimize: true,
          },
        },
      ],
    },
  ];

  const renderValue = (value, planKey) => {
    if (value === -1 || value === "Unlimited") {
      return <span className="text-green-600 font-semibold">Unlimited</span>;
    }
    if (value === true) {
      return <Check className="h-5 w-5 text-green-500 mx-auto" />;
    }
    if (value === false) {
      return <X className="h-5 w-5 text-gray-300 mx-auto" />;
    }
    if (typeof value === "number") {
      return <span className="font-medium text-gray-900">{value}</span>;
    }
    return <span className="text-gray-700 text-sm">{value}</span>;
  };

  if (!plans || Object.keys(plans).length === 0) {
    return (
      <Card className="shadow-sm border-gray-200">
        <CardContent className="p-7 text-center text-gray-500">
          Loading license comparison...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border-gray-200 overflow-hidden">
      {/* Header */}
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-sm">
            <BarChart3 className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-xl">License Differences</CardTitle>
            <CardDescription className="text-base text-gray-600 mt-1">
              Detailed comparison of features and limits across all plans
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {/* Sticky Header */}
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left p-4 font-semibold text-gray-700 min-w-[200px] border-b border-gray-200">
                  Feature
                </th>
                {orderedPlans.map((plan) => (
                  <th
                    key={plan.key}
                    className={cn(
                      "text-center p-4 font-semibold min-w-[120px] border-b border-gray-200",
                      currentPlanCode?.toLowerCase() === plan.key
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-700",
                    )}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span>{plan.name}</span>
                      {currentPlanCode?.toLowerCase() === plan.key && (
                        <Badge className="bg-blue-100 text-blue-700 text-[10px] px-2">
                          Current
                        </Badge>
                      )}
                      <span className="text-xs font-normal text-gray-500">
                        ₹{plan.price?.monthly || 0}/mo
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {featureCategories.map((category) => (
                <React.Fragment key={category.category}>
                  {/* Category Header Row */}
                  <tr className="bg-gray-100">
                    <td
                      colSpan={orderedPlans.length + 1}
                      className="p-3 font-semibold text-gray-800"
                    >
                      <div className="flex items-center gap-2">
                        <span>{category.icon}</span>
                        <span>{category.category}</span>
                      </div>
                    </td>
                  </tr>

                  {/* Feature Rows */}
                  {category.features.map((feature, idx) => (
                    <tr
                      key={feature.name}
                      className={cn(
                        "border-b border-gray-100 hover:bg-gray-50 transition-colors",
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/50",
                      )}
                    >
                      <td className="p-3 sm:p-4 text-gray-700 font-medium">
                        {feature.name}
                      </td>
                      {orderedPlans.map((plan) => (
                        <td
                          key={plan.key}
                          className={cn(
                            "p-3 sm:p-4 text-center",
                            currentPlanCode?.toLowerCase() === plan.key &&
                              "bg-blue-50/50",
                          )}
                        >
                          {renderValue(feature.limits[plan.key], plan.key)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer with upgrade prompt */}
        <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Info className="h-4 w-4 text-blue-500" />
              <span>
                Upgrade anytime to unlock more features and higher limits
              </span>
            </div>
            <Link to="admin/subscription">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white text-sm">
                <TrendingUp className="h-4 w-4 mr-2" />
                Upgrade Plan
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
export default function Subscription() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch organization users and license info
  const { data: userData, isLoading } = useQuery({
    queryKey: ["/api/users/organization"],
    enabled: true,
  });

  // Fetch license plans for comparison
  const { data: plansResponse, isLoading: plansLoading } = useQuery({
    queryKey: ["/api/license/licenses"],
    queryFn: async () => {
      const response = await fetch("/api/license/licenses", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch plans");
      return response.json();
    },
  });

  // Fetch current subscription
  const { data: subscriptionResponse } = useQuery({
    queryKey: ["/api/license/organization/subscription"],
    queryFn: async () => {
      const response = await fetch("/api/license/organization/subscription", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch subscription");
      return response.json();
    },
  });

  // Process plans data for display
  const plansData = plansResponse?.licenses || plansResponse?.data || [];
  const subscriptionData =
    subscriptionResponse?.subscription || subscriptionResponse?.data;

  const plans = plansData.reduce((acc, plan) => {
    const planKey = plan.license_code?.toLowerCase();
    if (planKey) {
      acc[planKey] = {
        name: plan.license_name,
        description: plan.description || `${plan.license_name} plan`,
        price: {
          monthly: plan.price_monthly || 0,
          yearly: plan.price_yearly || 0,
        },
        features: plan.features_summary || [],
        is_current: plan.license_code === subscriptionData?.current_license,
      };
    }
    return acc;
  }, {});

  const currentPlan = plansData.find(
    (plan) => plan.license_code === subscriptionData?.current_license,
  );

  // Deactivate user mutation
  const deactivateUserMutation = useMutation({
    mutationFn: (userId) =>
      apiRequest("PATCH", `/api/users/${userId}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/organization"] });
      toast({
        title: "Success",
        description: "User deactivated successfully",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to deactivate user",
        variant: "destructive",
      });
    },
  });

  // Resend invite mutation
  const resendInviteMutation = useMutation({
    mutationFn: (userId) =>
      apiRequest("POST", `/api/users/${userId}/resend-invite`),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Invitation resent successfully",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resend invitation",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: {
        variant: "default",
        icon: CheckCircle,
        color: "text-green-800 bg-green-100 border-green-300",
        label: "Active",
      },
      invited: {
        variant: "secondary",
        icon: Mail,
        color: "text-blue-800 bg-blue-100 border-blue-300",
        label: "Invited",
      },
      pending: {
        variant: "outline",
        icon: Clock,
        color: "text-slate-700 bg-slate-100 border-slate-300",
        label: "Pending",
      },
      inactive: {
        variant: "destructive",
        icon: XCircle,
        color: "text-red-800 bg-red-100 border-red-300",
        label: "Inactive",
      },
      suspended: {
        variant: "destructive",
        icon: AlertCircle,
        color: "text-gray-800 bg-gray-100 border-gray-300",
        label: "Suspended",
      },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-medium border ${config.color}`}
      >
        <Icon className="h-4 w-4" />
        {config.label}
      </div>
    );
  };

  const getRolesBadges = (roles) => {
    if (!Array.isArray(roles)) return null;

    const roleConfig = {
      admin: {
        color: "text-slate-800 bg-slate-200 border-slate-300",
        icon: Shield,
      },
      manager: {
        color: "text-gray-800 bg-gray-200 border-gray-300",
        icon: Users,
      },
      member: {
        color: "text-stone-800 bg-stone-200 border-stone-300",
        icon: Users,
      },
    };

    return (
      <div className="flex gap-2 flex-wrap">
        {roles.map((role, index) => {
          const config = roleConfig[role] || roleConfig.member;
          const Icon = config.icon;
          return (
            <div
              key={index}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium border ${config.color}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </div>
          );
        })}
      </div>
    );
  };

  const getDisplayName = (user) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.email.split("@")[0];
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const { users = [], licenseInfo = {} } = userData || {};

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-3">
      <div className="border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          Subscription & License Management
        </h1>
        <p className="text-lg text-gray-600 mt-2">
          Monitor your license usage and manage user access
        </p>
      </div>

      {/* License Summary */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-blue-100 rounded-sm">
              <CreditCard className="h-6 w-6 text-blue-600" />
            </div>
            License Summary
          </CardTitle>
          <CardDescription className="text-base text-gray-600 mt-2">
            Overview of your subscription and license allocation
          </CardDescription>
        </CardHeader>
        <CardContent className="p-7">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-slate-100 rounded-sm">
                  <TrendingUp className="h-5 w-5 text-slate-700" />
                </div>
                <span className="text-2xl font-bold text-slate-800">
                  {licenseInfo.totalLicenses || 10}
                </span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">
                Total Licenses
              </h4>
              <p className="text-sm text-gray-600">Purchased licenses</p>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-green-100 rounded-sm">
                  <CheckCircle className="h-5 w-5 text-green-700" />
                </div>
                <span className="text-2xl font-bold text-green-800">
                  {licenseInfo.usedLicenses || 0}
                </span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">
                Used Licenses
              </h4>
              <p className="text-sm text-gray-600">Currently active users</p>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-blue-100 rounded-sm">
                  <AlertCircle className="h-5 w-5 text-blue-700" />
                </div>
                <span className="text-2xl font-bold text-blue-800">
                  {licenseInfo.availableLicenses || 10}
                </span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">Available</h4>
              <p className="text-sm text-gray-600">Ready for new users</p>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-gray-100 rounded-sm">
                  <Shield className="h-5 w-5 text-gray-700" />
                </div>
                <span className="text-lg font-bold text-gray-800">
                  {licenseInfo.licenseType || "Professional"}
                </span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">License Type</h4>
              <p className="text-sm text-gray-600">Current subscription plan</p>
            </div>
          </div>

          {/* Usage Progress Bar */}
          <div className="mt-8 bg-white rounded-sm p-4 border border-gray-100">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-lg font-semibold text-gray-900">
                License Utilization
              </h4>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4" />
                Updated: {new Date().toLocaleDateString()}
              </div>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                Usage Progress
              </span>
              <span className="text-sm text-gray-600">
                {licenseInfo.usedLicenses || 0} of{" "}
                {licenseInfo.totalLicenses || 10} licenses used
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-slate-600 to-slate-700 h-3 rounded-full transition-all duration-500"
                style={{
                  width: `${licenseInfo.totalLicenses > 0 ? (licenseInfo.usedLicenses / licenseInfo.totalLicenses) * 100 : 0}%`,
                }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold text-gray-900">
                User License Management
              </CardTitle>
              <CardDescription className="mt-1">
                Manage user access and monitor license allocation
              </CardDescription>
            </div>
            <div className="text-sm text-gray-600">
              {users.length} {users.length === 1 ? "user" : "users"}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {users.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold text-gray-900">
                      User
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900">
                      Email
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900">
                      Role(s)
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900">
                      Status
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow
                      key={user._id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={user.profileImageUrl} />
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                              {getInitials(
                                user.firstName,
                                user.lastName,
                                user.email,
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div
                              className="font-semibold text-gray-900 truncate"
                              title={getDisplayName(user)}
                            >
                              {getDisplayName(user)}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {user._id.slice(-6)}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="text-gray-900">{user.email}</div>
                      </TableCell>
                      <TableCell className="py-4">
                        {getRolesBadges(user.roles)}
                      </TableCell>
                      <TableCell className="py-4">
                        {getStatusBadge(user.status)}
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {user.status === "invited" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                resendInviteMutation.mutate(user._id)
                              }
                              disabled={resendInviteMutation.isPending}
                              className="text-slate-700 border-slate-300 hover:text-slate-900 hover:bg-slate-100 font-medium"
                              title="Resend Invite"
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Resend
                            </Button>
                          )}
                          {user.status === "active" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                deactivateUserMutation.mutate(user._id)
                              }
                              disabled={deactivateUserMutation.isPending}
                              className="text-gray-700 border-gray-300 hover:text-gray-900 hover:bg-gray-100 font-medium"
                              title="Deactivate User"
                            >
                              <UserX className="h-4 w-4 mr-1" />
                              Deactivate
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <Users className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No users found
              </h3>
              <p className="text-gray-600 mb-3">
                Start by inviting team members to your organization.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* License Differences Section - Detailed feature comparison */}
      <LicenseDifferencesSection
        plans={plans}
        currentPlanCode={currentPlan?.license_code}
      />
    </div>
  );
}
