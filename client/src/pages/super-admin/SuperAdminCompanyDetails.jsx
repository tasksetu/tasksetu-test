import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  Building2,
  ArrowLeft,
  Users,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Zap,
  BarChart3,
  Crown,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";

export default function SuperAdminCompanyDetails() {
  // ✅ WOUTER WAY
  const [, params] = useRoute("/super-admin/companies/:id");
  const id = params?.id;

  console.log("Company ID from URL:", id);

  const {
    data: company,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["super-admin-company", id],
    enabled: !!id,
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await axios.get(`/api/super-admin/companies/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    },
  });

  // Extract primary admin from company data if available
  const primaryAdmin = company?.primaryAdmin;

  // ✅ SAFETY CHECKS
  if (!id) return <div className="p-4">Invalid company ID</div>;
  if (isLoading)
    return (
      <div className="p-4 text-center">
        <div className="animate-spin text-blue-600 text-3xl">⚙️</div>
        <p className="mt-2 text-gray-600">Loading company details...</p>
      </div>
    );
  if (error)
    return (
      <div className="p-4 text-red-600 bg-red-50 rounded-sm">
        ❌ Failed to load company
      </div>
    );
  if (!company)
    return (
      <div className="p-4 text-orange-600 bg-orange-50 rounded-sm">
        ⚠️ Company not found
      </div>
    );

  const stats = company.stats || {};
  const tasksByStatus = stats.tasksByStatus || {};
  const tasksByType = stats.tasksByType || {};
  const usersByRole = stats.usersByRole || {};
  const licenses = company.licenses || {};

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-3">
        {/* Company Header Card */}
        <div className="bg-white rounded-sm border border-gray-200 p-4">
          <div className="grid grid-cols-12 gap-3 items-start">
            {/* LEFT SECTION */}
            <div className="col-span-12 md:col-span-8 flex gap-3">
              <div className="bg-blue-50 p-3 rounded-sm border border-blue-200 h-fit">
                <Building2 className="h-8 w-8 text-blue-600" />
              </div>

              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {company.name}
                </h1>

                <p className="text-gray-500 mt-1 text-sm">@{company.slug}</p>

                {company.description && (
                  <p className="text-gray-600 mt-3 max-w-2xl">
                    {company.description}
                  </p>
                )}
              </div>
            </div>

            {/* RIGHT SECTION */}
            <div className="col-span-12 md:col-span-4 flex md:justify-end">
              <div className="flex flex-wrap gap-3 md:justify-end text-sm">
                {company.industry && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium border border-blue-200">
                    {company.industry}
                  </span>
                )}

                {company.userCount !== undefined && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-md text-xs font-medium border border-green-200">
                    {company.userCount < 50
                      ? "Small Company"
                      : company.userCount < 200
                        ? "Medium Company"
                        : "Large Company"}
                  </span>
                )}

                <span
                  className={`px-3 py-1 rounded-md text-white font-medium text-xs
            ${
              company.status === "active"
                ? "bg-green-600"
                : company.status === "inactive"
                  ? "bg-red-600"
                  : "bg-yellow-600"
            }`}
                >
                  {company.status?.charAt(0).toUpperCase() +
                    company.status?.slice(1)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Primary Admin Section */}
        {primaryAdmin && (
          <div className="bg-white rounded-sm border border-gray-200 p-4">
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-yellow-100 rounded-sm border border-yellow-200">
                <Crown className="h-5 w-5 text-yellow-700" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                Primary Administrator
              </h2>
            </div>

            {/* CONTENT GRID */}
            <div className="grid grid-cols-12 gap-3">
              {/* LEFT COLUMN */}
              <div className="col-span-12 md:col-span-8 flex gap-3">
                {/* Avatar */}
                <div className="w-20 h-20 bg-blue-100 rounded-sm flex items-center justify-center border border-blue-200 flex-shrink-0">
                  {primaryAdmin.profileImageUrl ? (
                    <img
                      src={primaryAdmin.profileImageUrl}
                      alt={primaryAdmin.firstName}
                      className="w-full h-full rounded-sm object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-blue-700">
                      {primaryAdmin.firstName?.[0]}
                      {primaryAdmin.lastName?.[0]}
                    </span>
                  )}
                </div>

                {/* Basic Info */}
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {primaryAdmin.firstName} {primaryAdmin.lastName}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {primaryAdmin.designation || "Administrator"}
                  </p>

                  {primaryAdmin.department && (
                    <div className="mt-3 pt-3 border-t border-gray-200 max-w-md">
                      <p className="text-xs text-gray-600">Department</p>
                      <p className="text-sm font-medium text-gray-900">
                        {primaryAdmin.department}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="col-span-12 md:col-span-4 flex md:justify-end">
                <div className="space-y-3 w-full md:max-w-sm">
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-md text-xs font-medium border border-yellow-200 flex items-center gap-1">
                      <Crown className="h-3 w-3" /> Primary Admin
                    </span>

                    <span
                      className={`px-3 py-1 rounded-md text-xs font-medium border
                ${
                  primaryAdmin.status === "active"
                    ? "bg-green-100 text-green-700 border-green-200"
                    : "bg-red-100 text-red-700 border-red-200"
                }`}
                    >
                      {primaryAdmin.status?.charAt(0).toUpperCase() +
                        primaryAdmin.status?.slice(1)}
                    </span>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-2">
                      <Mail className="h-4 w-4 text-gray-400 mt-1" />
                      <div>
                        <p className="text-gray-600">Email</p>
                        <p className="font-medium text-gray-900 break-all">
                          {primaryAdmin.email}
                        </p>
                      </div>
                    </div>

                    {primaryAdmin.phone && (
                      <div className="flex items-start gap-2">
                        <Phone className="h-4 w-4 text-gray-400 mt-1" />
                        <div>
                          <p className="text-gray-600">Phone</p>
                          <p className="font-medium text-gray-900">
                            {primaryAdmin.phone}
                          </p>
                        </div>
                      </div>
                    )}

                    {primaryAdmin.location && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-gray-400 mt-1" />
                        <div>
                          <p className="text-gray-600">Location</p>
                          <p className="font-medium text-gray-900">
                            {primaryAdmin.location}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-sm border border-gray-200 p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {company.userCount || 0}
              </p>
              <p className="text-sm text-gray-600 mt-1">Total Users</p>
            </div>
          </div>
          <div className="bg-white rounded-sm border border-gray-200 p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {stats.tasks || 0}
              </p>
              <p className="text-sm text-gray-600 mt-1">Total Tasks</p>
            </div>
          </div>
          <div className="bg-white rounded-sm border border-gray-200 p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {company.totalLicenses || 0}
              </p>
              <p className="text-sm text-gray-600 mt-1">Total Licenses</p>
            </div>
          </div>
          <div className="bg-white rounded-sm border border-gray-200 p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {company.assignedLicenses || 0}
              </p>
              <p className="text-sm text-gray-600 mt-1">Used Licenses</p>
              <p className="text-xs text-gray-500 mt-1">
                {company.availableLicenses || 0} available
              </p>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* License Details */}
          <div className="bg-white rounded-sm border border-gray-200 p-4">
            <h2 className="text-lg font-bold text-gray-900 mb-3">
              License Details
            </h2>
            {Object.keys(licenses).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(licenses).map(([licenseType, data]) => (
                  <div
                    key={licenseType}
                    className="p-4 bg-white rounded-sm border border-gray-200"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-gray-900">{licenseType}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          License Type
                        </p>
                      </div>
                      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                        {data.total} total
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-gray-600">Assigned</p>
                        <p className="text-lg font-bold text-blue-600">
                          {data.assigned}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Available</p>
                        <p className="text-lg font-bold text-green-600">
                          {data.available}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Expired</p>
                        <p className="text-lg font-bold text-red-600">
                          {data.expired}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No license data available
              </p>
            )}
          </div>

          {/* User Roles Breakdown */}
          <div className="bg-white rounded-sm border border-gray-200 p-4">
            <h2 className="text-lg font-bold text-gray-900 mb-3">User Roles</h2>
            {Object.keys(usersByRole).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(usersByRole).map(([role, count]) => (
                  <div
                    key={role}
                    className="flex items-center justify-between p-3 bg-white rounded-sm border border-gray-200"
                  >
                    <span className="font-medium text-gray-900 capitalize">
                      {role.replace("_", " ")}
                    </span>
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No user role data
              </p>
            )}
          </div>
        </div>

        {/* Tasks by Status and Type */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Task Status */}
          <div className="bg-white rounded-sm border border-gray-200 p-4">
            <h2 className="text-lg font-bold text-gray-900 mb-3">
              Tasks by Status
            </h2>
            <div className="space-y-3">
              <StatusBar
                label="Completed"
                count={tasksByStatus.DONE || 0}
                color="bg-green-500"
                icon={<CheckCircle className="h-5 w-5" />}
              />
              <StatusBar
                label="In Progress"
                count={tasksByStatus.INPROGRESS || 0}
                color="bg-blue-500"
                icon={<Clock className="h-5 w-5" />}
              />
              <StatusBar
                label="Open"
                count={tasksByStatus.OPEN || 0}
                color="bg-purple-500"
                icon={<FileText className="h-5 w-5" />}
              />
              <StatusBar
                label="On Hold"
                count={tasksByStatus.ONHOLD || 0}
                color="bg-yellow-500"
                icon={<AlertCircle className="h-5 w-5" />}
              />
              <StatusBar
                label="Cancelled"
                count={tasksByStatus.CANCELLED || 0}
                color="bg-red-500"
                icon={<AlertCircle className="h-5 w-5" />}
              />
            </div>
          </div>

          {/* Task Types */}
          <div className="bg-white rounded-sm border border-gray-200 p-4">
            <h2 className="text-lg font-bold text-gray-900 mb-3">
              Tasks by Type
            </h2>
            <div className="space-y-3">
              {[
                { type: "regular", label: "Regular Tasks" },
                { type: "recurring", label: "Recurring Tasks" },
                { type: "milestone", label: "Milestone Tasks" },
                { type: "approval", label: "Approval Tasks" },
              ].map(({ type, label }) => (
                <div
                  key={type}
                  className="p-3 bg-white rounded-sm border border-gray-200 flex justify-between items-center"
                >
                  <span className="font-medium text-gray-900">{label}</span>
                  <span className="bg-gray-200 text-gray-800 px-3 py-1 rounded-md text-sm font-medium">
                    {tasksByType[type] || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {(company.numberOfEmployees || company.industry || company.website) && (
          <div className="bg-white rounded-sm border border-gray-200 p-4">
            <h2 className="text-lg font-bold text-gray-900 mb-3">
              Additional Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {company.numberOfEmployees && (
                <div>
                  <p className="text-gray-600 text-sm">Employees</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {company.numberOfEmployees}
                  </p>
                </div>
              )}
              {company.industry && (
                <div>
                  <p className="text-gray-600 text-sm">Industry</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {company.industry}
                  </p>
                </div>
              )}
              {company.maxUsers && (
                <div>
                  <p className="text-gray-600 text-sm">Max Users</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {company.maxUsers}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper Component for Status Bars
function StatusBar({ label, count, color, icon }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`${color} text-white p-2 rounded-sm`}>{icon}</div>
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <span className="font-medium text-gray-900">{label}</span>
          <span className="text-sm font-bold text-gray-700">{count}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`${color} h-2 rounded-full transition-all duration-300`}
            style={{
              width:
                count === 0 ? "0%" : `${Math.max(5, (count / 100) * 100)}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
