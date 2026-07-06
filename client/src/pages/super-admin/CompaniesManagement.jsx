import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Users,
  FolderOpen,
  FileText,
  MoreVertical,
  Eye,
  Settings,
  Ban,
  CheckCircle,
  Search,
  Filter,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";

export default function CompaniesManagement() {
  const {
    data: companies = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["/api/super-admin/companies"],
    retry: false,
  });
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Debug logging
  console.log("=== COMPANIES MANAGEMENT DEBUG ===");
  console.log("Companies data:", companies);
  console.log("Companies length:", companies?.length);
  console.log("Loading state:", isLoading);
  console.log("Error state:", error);
  console.log("Auth token exists:", !!localStorage.getItem("token"));

  const handleStatusChange = async (companyId, isActive) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      // ✅ Convert boolean → status string safely
      const status = isActive === true ? "active" : "inactive";

      console.log(
        `CompaniesManagement: Updating company ${companyId} status to ${status}`,
      );

      const response = await axios.patch(
        `/api/super-admin/companies/${companyId}/status`,
        { status },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      console.log(
        "CompaniesManagement: Status update successful:",
        response.data,
      );

      // ✅ Optimistic UI update OR refetch
      await refetch();

      toast({
        title: "Success",
        description: `Company status updated to ${status}`,
      });
    } catch (error) {
      console.error("CompaniesManagement: Error updating status:", error);

      let errorMessage = "Failed to update company status";

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          errorMessage = "Authentication failed. Please login again.";
        } else if (error.response?.status === 403) {
          errorMessage = "You do not have permission to update company status.";
        } else if (error.response?.status === 404) {
          errorMessage = "Company not found.";
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const filteredCompanies =
    companies?.filter((company) => {
      const matchesSearch =
        company.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.slug?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && company.status === "active") ||
        (statusFilter === "inactive" && company.status !== "active");
      return matchesSearch && matchesStatus;
    }) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-7">
        <div className="animate-pulse space-y-3">
          <div className="space-y-3">
            <div className="h-10 bg-gradient-to-r from-gray-200 to-gray-300 rounded-xl w-1/3"></div>
            <div className="h-6 bg-gradient-to-r from-gray-100 to-gray-200 rounded-sm w-1/2"></div>
          </div>
          <div className="h-96 bg-white/60 backdrop-blur-sm rounded-sm shadow-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 bg-blue-50 rounded-sm border border-blue-200">
            <Building2 className="h-7 w-7 text-blue-600" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              Companies Management
            </h1>
            <p className="text-base text-gray-600 mt-1">
              View and manage all companies on the platform
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-sm border border-gray-200 p-3 mb-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search companies by name or slug..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-9 pl-10 pr-4 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 pl-10 pr-4 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white transition-all cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-gray-600">
            Showing{" "}
            <span className="font-semibold text-blue-600">
              {filteredCompanies.length}
            </span>{" "}
            of <span className="font-semibold">{companies.length}</span>{" "}
            companies
          </p>
        </div>
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredCompanies.map((company) => (
          <div
            key={company._id}
            className="group bg-white rounded-xl border border-gray-200 hover:shadow-lg hover:border-gray-300 transition-all duration-300 overflow-hidden"
          >
            <div className="p-5 flex flex-col h-full">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex gap-3">
                  <div className="w-11 h-11 bg-blue-50 rounded-sm flex items-center justify-center border border-blue-200">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-gray-900 leading-tight">
                      {company.name}
                    </h3>
                    <p className="text-xs text-gray-500">@{company.slug}</p>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                    company.status === "active"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {company.status === "active" ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Stats */}
              <div className="flex justify-between gap-2 mb-3">
                {[
                  {
                    label: "Users",
                    value: company.userCount || company.stats?.users || 0,
                  },
                  { label: "Licenses", value: company.totalLicenses || 0 },
                  {
                    label: "Tasks",
                    value: company.taskCount || company.stats?.tasks || 0,
                  },
                  {
                    label: "Forms",
                    value: company.formCount || company.stats?.forms || 0,
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex-1 bg-gray-50 rounded-sm border border-gray-200 px-2 py-2 text-center"
                  >
                    <p className="text-[11px] text-gray-500">{label}</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="mt-auto pt-3 border-t border-gray-200 flex gap-2">
                <button
                  onClick={() =>
                    (window.location.href = `/super-admin/companies/${company._id}`)
                  }
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                >
                  <Eye className="h-4 w-4" />
                  View
                </button>

                <button
                  onClick={() =>
                    handleStatusChange(company._id, company.status !== "active")
                  }
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-md text-white transition ${
                    company.status === "active"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {company.status === "active" ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredCompanies.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No companies found
          </h3>
          <p className="text-gray-600">
            {companies.length === 0
              ? "No companies have been registered yet."
              : "No companies match your current filters."}
          </p>
          {companies.length === 0 && (
            <div className="mt-4 text-sm text-gray-500">
              Companies will appear here once organizations register on the
              platform.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
