import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  ArrowLeft,
  Mail,
  User,
  Shield,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Package,
  Key,
  Database,
  FolderKanban,
  ListTodo,
  HardDrive,
  Users,
  Building2,
  BadgeCheck,
  Armchair,
  CalendarClock,
  Activity,
} from "lucide-react";

export default function UserDetail() {
  const [, params] = useRoute("/super-admin/users/:id");
  const id = params?.id;

  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["super-admin-user", id],
    enabled: !!id,
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await axios.get(`/api/super-admin/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    },
  });

  if (!id) {
    return (
      <div className="p-4 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-sm p-4 text-red-700">
          Invalid user ID
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-sm p-4 text-red-700 flex items-center gap-2">
          <XCircle className="h-5 w-5" />
          Failed to load user details
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4">
        <div className="bg-amber-50 border border-amber-200 rounded-sm p-4 text-amber-700 flex items-center gap-2">
          <XCircle className="h-5 w-5" />
          User not found
        </div>
      </div>
    );
  }

  const getRoleBadgeColor = (role) => {
    const colors = {
      super_admin: "bg-red-50 text-red-700 border-red-200",
      org_admin: "bg-blue-50 text-blue-700 border-blue-200",
      manager: "bg-purple-50 text-purple-700 border-purple-200",
      employee: "bg-green-50 text-green-700 border-green-200",
      individual: "bg-gray-50 text-gray-700 border-gray-200",
    };
    return colors[role] || colors.individual;
  };

  const getStatusConfig = (status, isActive) => {
    if (status === "active" && isActive) {
      return {
        color: "bg-green-50 text-green-700 border-green-200",
        icon: CheckCircle2,
      };
    } else if (status === "inactive" || !isActive) {
      return { color: "bg-red-50 text-red-700 border-red-200", icon: XCircle };
    } else if (status === "pending") {
      return {
        color: "bg-amber-50 text-amber-700 border-amber-200",
        icon: Clock,
      };
    }
    return {
      color: "bg-gray-50 text-gray-700 border-gray-200",
      icon: Activity,
    };
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateOnly = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const statusConfig = getStatusConfig(user.status, user.isActive);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className=" space-y-3">
        {/* User Profile Header */}
        <div className="bg-white rounded-sm border border-gray-200 p-4">
          <div className="flex items-start gap-3">
            <div className="w-20 h-20 bg-blue-100 rounded-sm flex items-center justify-center border border-blue-200">
              {user?.profileImageUrl && (
                <img
                  src={user.profileImageUrl}
                  alt="Profile"
                  className="h-20 w-20 rounded-sm"
                />
              )}
              {!user?.profileImageUrl && (
                <User className="h-10 w-10 text-blue-600" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {user.firstName} {user.lastName}
                  </h1>
                  <p className="text-gray-500 flex items-center gap-2 mt-1">
                    <Mail className="h-4 w-4" />
                    {user.email}
                  </p>
                </div>
                <div className="text-right text-xs text-gray-400">
                  <p>ID: {user._id}</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {/* Roles */}
                {user.role?.map((r, idx) => (
                  <span
                    key={idx}
                    className={`px-3 py-1 rounded-md text-xs font-medium border ${getRoleBadgeColor(r)}`}
                  >
                    {r.replace("_", " ").toUpperCase()}
                  </span>
                ))}
                {/* Status */}
                <span
                  className={`px-3 py-1 rounded-md text-xs font-medium border flex items-center gap-1 ${statusConfig.color}`}
                >
                  <StatusIcon className="h-3 w-3" />
                  {user.status?.charAt(0).toUpperCase() + user.status?.slice(1)}
                </span>
                {/* Primary Admin Badge */}
                {user.isPrimaryAdmin && (
                  <span className="px-3 py-1 rounded-md text-xs font-medium border bg-purple-50 text-purple-700 border-purple-200 flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Primary Admin
                  </span>
                )}
                {/* Email Verified */}
                <span
                  className={`px-3 py-1 rounded-md text-xs font-medium border flex items-center gap-1 ${
                    user.emailVerified
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  {user.emailVerified ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  {user.emailVerified ? "Email Verified" : "Email Not Verified"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Account & License Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Account Information */}
          <div className="bg-white rounded-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-medium text-gray-900">
                Account Information
              </h2>
            </div>
            <div className="p-4 space-y-3">
              <InfoRow
                icon={Building2}
                label="Account Type"
                value={
                  user.account_type?.charAt(0).toUpperCase() +
                    user.account_type?.slice(1) || "N/A"
                }
              />
              <InfoRow
                icon={Calendar}
                label="Created At"
                value={formatDate(user.createdAt)}
              />
              <InfoRow
                icon={CalendarClock}
                label="Last Updated"
                value={formatDate(user.updatedAt)}
              />
              <InfoRow
                icon={Clock}
                label="Last Login"
                value={
                  user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"
                }
              />
              <InfoRow
                icon={Activity}
                label="Is Active"
                value={
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      user.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {user.isActive ? "Yes" : "No"}
                  </span>
                }
              />
              <InfoRow
                icon={Users}
                label="Google Calendar"
                value={
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      user.googleCalendarConnected
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {user.googleCalendarConnected
                      ? "Connected"
                      : "Not Connected"}
                  </span>
                }
              />
            </div>
          </div>

          {/* License Information */}
          <div className="bg-white rounded-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
              <Key className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-medium text-gray-900">
                License Information
              </h2>
            </div>
            <div className="p-4 space-y-3">
              <InfoRow
                icon={Package}
                label="License Code"
                value={
                  <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 font-medium">
                    {user.license_code || "N/A"}
                  </span>
                }
              />
              <InfoRow
                icon={Calendar}
                label="License Expiry"
                value={formatDateOnly(user.license_expiry)}
              />
              <InfoRow
                icon={Key}
                label="License ID"
                value={user.license_id || "Not Assigned"}
              />
              <InfoRow
                icon={Key}
                label="License Instance ID"
                value={user.license_instance_id || "Not Assigned"}
              />
              <InfoRow
                icon={Armchair}
                label="Seat Assigned"
                value={
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      user.seat_assigned
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {user.seat_assigned
                      ? `Yes (#${user.seat_number || "N/A"})`
                      : "No"}
                  </span>
                }
              />
              {user.seat_assigned_at && (
                <InfoRow
                  icon={Calendar}
                  label="Seat Assigned At"
                  value={formatDate(user.seat_assigned_at)}
                />
              )}
              {user.seat_released_at && (
                <InfoRow
                  icon={Calendar}
                  label="Seat Released At"
                  value={formatDate(user.seat_released_at)}
                />
              )}
            </div>
          </div>
        </div>

        {/* License Limits & Usage Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* License Limits */}
          <div className="bg-white rounded-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
              <Shield className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-medium text-gray-900">
                License Limits
              </h2>
            </div>
            <div className="p-4 space-y-3">
              <InfoRow
                icon={FolderKanban}
                label="Max Projects"
                value={
                  user.license_limits?.max_projects_per_user || "Unlimited"
                }
              />
              <InfoRow
                icon={ListTodo}
                label="Max Tasks"
                value={user.license_limits?.max_tasks_per_user || "Unlimited"}
              />
              <InfoRow
                icon={HardDrive}
                label="Max Storage"
                value={
                  user.license_limits?.max_storage_per_user_mb
                    ? `${user.license_limits.max_storage_per_user_mb} MB`
                    : "Unlimited"
                }
              />
              <InfoRow
                icon={Users}
                label="Max Collaborators"
                value={
                  user.license_limits?.max_collaborators_per_user || "Unlimited"
                }
              />
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Features Enabled:</p>
                {user.license_limits?.features_enabled?.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {user.license_limits.features_enabled.map(
                      (feature, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200"
                        >
                          {feature}
                        </span>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">
                    No specific features enabled
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Usage Stats */}
          <div className="bg-white rounded-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
              <Database className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-medium text-gray-900">
                Usage Statistics
              </h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-blue-50 border border-blue-200 rounded-sm p-4 text-center">
                  <FolderKanban className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-semibold text-blue-700">
                    {user.usage_stats?.projects_created || 0}
                  </p>
                  <p className="text-xs text-blue-600">Projects Created</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-sm p-4 text-center">
                  <ListTodo className="h-6 w-6 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-semibold text-green-700">
                    {user.usage_stats?.tasks_created || 0}
                  </p>
                  <p className="text-xs text-green-600">Tasks Created</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-purple-50 border border-purple-200 rounded-sm p-4 text-center">
                  <HardDrive className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                  <p className="text-2xl font-semibold text-purple-700">
                    {user.usage_stats?.storage_used_mb || 0} MB
                  </p>
                  <p className="text-xs text-purple-600">Storage Used</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-sm p-4 text-center">
                  <ListTodo className="h-6 w-6 text-amber-600 mx-auto mb-2" />
                  <p className="text-2xl font-semibold text-amber-700">
                    {user.assignedTasks || 0} / {user.completedTasks || 0}
                  </p>
                  <p className="text-xs text-amber-600">Assigned / Completed</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Team & Manager Info */}
        {/* <div className="bg-white rounded-sm border border-gray-200">
                    <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <h2 className="text-sm font-medium text-gray-900">Team Information</h2>
                    </div>
                    <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <InfoRow
                                icon={User}
                                label="Manager ID"
                                value={user.managerId || "No Manager Assigned"}
                            />
                            <InfoRow
                                icon={Users}
                                label="Subordinates"
                                value={
                                    user.subordinates?.length > 0
                                        ? `${user.subordinates.length} subordinates`
                                        : "No Subordinates"
                                }
                            />
                        </div>
                        {user.permissions?.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <p className="text-xs text-gray-500 mb-2">Permissions:</p>
                                <div className="flex flex-wrap gap-1">
                                    {user.permissions.map((permission, idx) => (
                                        <span
                                            key={idx}
                                            className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
                                        >
                                            {permission}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {user.roles?.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <p className="text-xs text-gray-500 mb-2">Additional Roles:</p>
                                <div className="flex flex-wrap gap-1">
                                    {user.roles.map((role, idx) => (
                                        <span
                                            key={idx}
                                            className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700"
                                        >
                                            {typeof role === "string" ? role : role.name || role._id}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div> */}
      </div>
    </div>
  );
}

// Helper component for info rows
function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <div
          className="text-sm text-gray-900 font-medium truncate"
          title={
            typeof value === "string" || typeof value === "number"
              ? String(value)
              : undefined
          }
        >
          {typeof value === "string" || typeof value === "number"
            ? value
            : value}
        </div>
      </div>
    </div>
  );
}
