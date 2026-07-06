import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  MoreVertical,
  Users,
  Calendar,
  Package,
  ChevronDown,
  RefreshCw,
} from "lucide-react";

export default function CompanyStatus() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showActionMenu, setShowActionMenu] = useState(null);

  // Fetch companies
  const { data: companiesData, isLoading } = useQuery({
    queryKey: ["super-admin-companies"],
    queryFn: async () => {
      const response = await fetch("/api/super-admin/organizations", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch companies");
      return response.json();
    },
  });

  // Mock data structure for display - Empty initial state
  const companies = companiesData?.data || [];

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ companyId, newStatus, reason }) => {
      const response = await fetch(
        `/api/super-admin/organizations/${companyId}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ status: newStatus, reason }),
        },
      );
      if (!response.ok) throw new Error("Failed to update status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["super-admin-companies"]);
      setSelectedCompany(null);
      setShowActionMenu(null);
    },
  });

  const getStatusConfig = (status) => {
    const configs = {
      active: {
        label: "Active",
        icon: CheckCircle2,
        bgColor: "bg-green-50",
        textColor: "text-green-700",
        borderColor: "border-green-200",
        iconColor: "text-green-600",
      },
      pending: {
        label: "Pending",
        icon: Clock,
        bgColor: "bg-amber-50",
        textColor: "text-amber-700",
        borderColor: "border-amber-200",
        iconColor: "text-amber-600",
      },
      suspended: {
        label: "Suspended",
        icon: XCircle,
        bgColor: "bg-red-50",
        textColor: "text-red-700",
        borderColor: "border-red-200",
        iconColor: "text-red-600",
      },
      inactive: {
        label: "Inactive",
        icon: AlertTriangle,
        bgColor: "bg-gray-50",
        textColor: "text-gray-700",
        borderColor: "border-gray-200",
        iconColor: "text-gray-600",
      },
    };
    return configs[status] || configs.inactive;
  };

  // Filter companies
  const filteredCompanies = companies.filter((company) => {
    const matchesSearch =
      company.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.primaryContact?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || company.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: companies.length,
    active: companies.filter((c) => c.status === "active").length,
    pending: companies.filter((c) => c.status === "pending").length,
    suspended: companies.filter((c) => c.status === "suspended").length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
        <div className="p-2 bg-purple-100 rounded-sm">
          <Building2 className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Company Status
          </h1>
          <p className="text-sm text-gray-500">
            Manage company activation and suspension
          </p>
        </div>
      </div>

      {/* Status Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-sm p-4 text-center">
          <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500 mt-1">Total Companies</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-sm p-4 text-center">
          <p className="text-2xl font-semibold text-green-700">
            {stats.active}
          </p>
          <p className="text-xs text-green-600 mt-1">Active</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-sm p-4 text-center">
          <p className="text-2xl font-semibold text-amber-700">
            {stats.pending}
          </p>
          <p className="text-xs text-amber-600 mt-1">Pending</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-sm p-4 text-center">
          <p className="text-2xl font-semibold text-red-700">
            {stats.suspended}
          </p>
          <p className="text-xs text-red-600 mt-1">Suspended</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-10 pr-4 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none h-9 pl-10 pr-8 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Companies Table */}
      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Users
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                License Tier
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Activity
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredCompanies.map((company) => {
              const statusConfig = getStatusConfig(company.status);
              const StatusIcon = statusConfig.icon;
              return (
                <tr key={company._id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-sm flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {company.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {company.primaryContact}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor}`}
                    >
                      <StatusIcon
                        className={`h-3.5 w-3.5 ${statusConfig.iconColor}`}
                      />
                      {statusConfig.label}
                    </span>
                    {company.suspensionReason && (
                      <p className="text-xs text-red-500 mt-1">
                        {company.suspensionReason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-gray-700">
                      <Users className="h-4 w-4 text-gray-400" />
                      {company.users}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-gray-700">
                      <Package className="h-4 w-4 text-gray-400" />
                      {company.licenseTier}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {company.lastActivity}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="relative">
                      <button
                        onClick={() =>
                          setShowActionMenu(
                            showActionMenu === company._id ? null : company._id,
                          )
                        }
                        className="p-2 hover:bg-gray-100 rounded-sm"
                      >
                        <MoreVertical className="h-4 w-4 text-gray-500" />
                      </button>
                      {showActionMenu === company._id && (
                        <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-sm shadow-lg z-10">
                          {company.status !== "active" && (
                            <button
                              onClick={() => {
                                updateStatusMutation.mutate({
                                  companyId: company._id,
                                  newStatus: "active",
                                });
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-green-700 hover:bg-green-50 flex items-center gap-2"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Activate
                            </button>
                          )}
                          {company.status === "pending" && (
                            <button
                              onClick={() => {
                                updateStatusMutation.mutate({
                                  companyId: company._id,
                                  newStatus: "active",
                                });
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-blue-700 hover:bg-blue-50 flex items-center gap-2"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Approve
                            </button>
                          )}
                          {company.status === "active" && (
                            <button
                              onClick={() => {
                                setSelectedCompany(company);
                                setShowActionMenu(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50 flex items-center gap-2"
                            >
                              <XCircle className="h-4 w-4" />
                              Suspend
                            </button>
                          )}
                          {company.status === "suspended" && (
                            <button
                              onClick={() => {
                                updateStatusMutation.mutate({
                                  companyId: company._id,
                                  newStatus: "active",
                                  reason: "Reactivated by Super Admin",
                                });
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-green-700 hover:bg-green-50 flex items-center gap-2"
                            >
                              <RefreshCw className="h-4 w-4" />
                              Reactivate
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredCompanies.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-500">
            <Building2 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p>No companies found</p>
          </div>
        )}
      </div>

      {/* Suspension Modal */}
      {selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Suspend Company
              </h3>
              <p className="text-sm text-gray-500">
                Suspending <strong>{selectedCompany.name}</strong> will disable
                all user access
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                updateStatusMutation.mutate({
                  companyId: selectedCompany._id,
                  newStatus: "suspended",
                  reason: formData.get("reason"),
                });
              }}
              className="p-4 space-y-3"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Suspension Reason <span className="text-red-500">*</span>
                </label>
                <select
                  name="reason"
                  required
                  className="w-full h-9 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Select reason...</option>
                  <option value="Payment failure">Payment failure</option>
                  <option value="Terms of service violation">
                    Terms of service violation
                  </option>
                  <option value="Security concern">Security concern</option>
                  <option value="Customer request">Customer request</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Notes
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Enter additional details..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCompany(null)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-sm hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateStatusMutation.isLoading}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-sm hover:bg-red-700 disabled:opacity-50"
                >
                  {updateStatusMutation.isLoading
                    ? "Suspending..."
                    : "Suspend Company"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
