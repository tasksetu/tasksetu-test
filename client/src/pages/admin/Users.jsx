import { useState, useEffect } from "react";
import {
  UserPlus,
  Users as UsersIcon,
  Shield,
  Mail,
  MoreHorizontal,
  CheckCircle,
  Clock,
  UserX,
  Eye,
  Edit3,
  Trash2,
  RefreshCw,
  Crown,
  User,
  Download,
  Upload,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  Search,
  Send,
  Info,
  Key,
  Award,
  Loader, // ✅ NEW: License icon
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AddUserModal } from "@/components/InviteUsersModal";
import { EditUserModal } from "@/components/EditUserModal";
import { ViewUserActivityModal } from "@/components/ViewUserActivityModal";
import { BulkUploadUsersModal } from "@/components/BulkUploadUsersModal";
import { PasswordResetModal } from "@/components/PasswordResetModal";
import { LicenseAssignmentModal } from "@/components/LicenseAssignmentModal"; // ✅ NEW
import { useToast } from "@/hooks/use-toast";
import Pagination from "../../components/common/Pagination";
import { useUserRole } from "../../utils/auth";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { set } from "mongoose";
import { useShowToast } from "../../utils/ToastMessage";
import CommonLoader from "../../components/common/CommonLoader";
import { getStatusBadge } from "../../components/common/statusBadge";

export default function Users() {
  const queryClient = useQueryClient();
  const [users, setUsers] = useState([]);
  const [licensePool, setLicensePool] = useState([]);
  const [loadingLicensePool, setLoadingLicensePool] = useState(true);
  // Rename to avoid shadowing with "user" in the map() below
  const { user: currentUser, orgId } = useUserRole();
  const { showSuccessToast, showErrorToast } = useShowToast();
  const [, setLocation] = useLocation();

  // Fetch free user quota
  const [loadingFreeQuota, setLoadingFreeQuota] = useState(true);
  const [freeQuotaData, setFreeQuotaData] = useState(null);

  const fetchFreeQuota = async () => {
    try {
      setLoadingFreeQuota(true);
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch("/api/organization/free-user-quota", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          setFreeQuotaData(result.data);
        }
      }
    } catch (err) {
      console.error("❌ Error fetching free user quota:", err);
    } finally {
      setLoadingFreeQuota(false);
    }
  };

  // Function to fetch license pool data using new user-level license API
  const fetchLicensePool = async () => {
    try {
      console.log("🔍 Fetching license pool data...");
      setLoadingLicensePool(true);

      const token = localStorage.getItem("token");
      if (!token) {
        console.warn("⚠️ No auth token found");
        setLicensePool(getMockLicensePool());
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      // ✅ NEW: Try user-level license pool API first (works for secondary org_admin)
      let response;
      let useNewApi = true;

      try {
        response = await fetch("/api/license/organization/pool", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });
      } catch (e) {
        console.log(
          "📝 New license pool API not available, trying legacy API...",
        );
        useNewApi = false;
      }

      // If new API failed, fall back to multi-subscriptions API
      if (!response?.ok) {
        console.log("📝 Trying legacy multi-subscriptions API...");
        useNewApi = false;
        response = await fetch("/api/organization/multi-subscriptions", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });
      }

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn(`⚠️ API response not ok: ${response.status}`, errorData);
        throw new Error(
          errorData.message || `Server error: ${response.status}`,
        );
      }

      const result = await response.json();
      console.log(
        "✅ License pool data fetched:",
        result,
        "(new API:",
        useNewApi,
        ")",
      );

      // Handle new API format: { pool: [...], summary: {...} }
      if (
        useNewApi &&
        result.success &&
        result.pool &&
        Array.isArray(result.pool)
      ) {
        const transformedData = result.pool.map((sub) => ({
          license_code: sub.license_code,
          license_name: sub.license_name,
          total: sub.total || 0,
          assigned: sub.assigned || 0,
          available: sub.available || 0,
          expired: sub.expired || 0,
        }));
        setLicensePool(transformedData);
      }
      // Handle legacy API format: { success, data: [...] }
      else if (result.success && result.data && Array.isArray(result.data)) {
        const transformedData = result.data.map((sub) => ({
          license_code: sub.license_code,
          license_name: sub.license_name,
          total: sub.seats_purchased || 0,
          used: sub.seats_used || 0,
          available: sub.seats_available || 0,
          expired: sub.seats_expired || 0,
        }));
        setLicensePool(transformedData);
      } else {
        console.warn("⚠️ Invalid license pool data received");
        setLicensePool([]);
      }
    } catch (error) {
      console.error("❌ Error fetching license pool:", error);

      if (error.name === "AbortError") {
        console.log("⏱️ Request timeout - server may be down");
      }

      setLicensePool([]);

      toast({
        title: "License Pool",
        description:
          "Failed to fetch license pool data. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoadingLicensePool(false);
    }
  };

  // Load license pool data and free user quota from API on mount
  useEffect(() => {
    fetchLicensePool();
    fetchFreeQuota();
  }, []);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [statusAction, setStatusAction] = useState(null); // "deactivate" or "activate"

  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [isViewActivityModalOpen, setIsViewActivityModalOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false); // Invite dialog state
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false); // Bulk upload modal
  const [isPasswordResetModalOpen, setIsPasswordResetModalOpen] =
    useState(false); // Password reset modal
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false); // ✅ NEW: License modal

  const [selectedUser, setSelectedUser] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // change as needed
  // Pagination
  const startIndex = (currentPage - 1) * itemsPerPage;

  const { toast } = useToast();
  // Fetch users with react-query
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["users", orgId, currentPage, searchQuery],
    // Only run query if orgId is available
    enabled: !!orgId && orgId !== "undefined",
    queryFn: async () => {
      // Double-check orgId before making request
      if (!orgId || orgId === "undefined") {
        throw new Error("Organization ID not available");
      }
      const token = localStorage.getItem("token");
      const res = await fetch(
        `/api/organization/${orgId}/users?page=${currentPage}&search=${encodeURIComponent(
          searchQuery,
        )}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!res.ok) {
        throw new Error(`Error: ${res.status} ${res.statusText}`);
      }

      return res.json();
    },
    keepPreviousData: true,
    staleTime: 1000 * 60 * 5,
  });
  // Mutation for updating user
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, userData }) => {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/organization/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(userData),
      });
      if (!res.ok) {
        // Try to parse error message from server
        let errorMsg = "Update failed";
        try {
          const errData = await res.json();
          errorMsg = errData.message || errorMsg;
        } catch {}
        const error = new Error(errorMsg);
        error.status = res.status;
        throw error;
      }
      const data = await res.json();
      return data;
    },
    onSuccess: (data) => {
      // Refresh license pool and free quota after user update (in case role/license changed)
      fetchLicensePool();
      fetchFreeQuota();

      showSuccessToast("Updated");

      // Invalidate all users queries with any parameters
      queryClient.invalidateQueries({ queryKey: ["users"] });
      // Also invalidate org stats to update counters if needed
      queryClient.invalidateQueries({ queryKey: ["orgStats"] });
    },
    onError: (error) => {
      showErrorToast(error.message || "An unexpected error occurred");
    },
  });

  // Add this mutation after the updateUserStatusMutation
  const removeUserMutation = useMutation({
    mutationFn: async (userId) => {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/organization/users/${userId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        let errorMsg = "Failed to remove user";
        try {
          const errData = await res.json();
          errorMsg = errData.message || errorMsg;
        } catch {}
        const error = new Error(errorMsg);
        error.status = res.status;
        throw error;
      }
      return res.json();
    },
    onSuccess: (data) => {
      // Refresh license pool and free quota after removing user
      fetchLicensePool();
      fetchFreeQuota();

      showSuccessToast(data.message || "User removed");
      queryClient.invalidateQueries(["users"]);
      setIsRemoveDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error) => {
      showErrorToast(error.message || "An unexpected error occurred");
    },
  });

  // Add invite mutation
  const sendInviteMutation = useMutation({
    mutationFn: async (userId) => {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/organization/users/send-invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();

      if (!res.ok) {
        const error = new Error(data.message || "Failed to send invitation");
        error.status = res.status;
        error.data = data;
        throw error;
      }
      return data;
    },
    onSuccess: (data) => {
      if (data.emailSent === false) {
        showSuccessToast(
          "User invitation created successfully. Email service is not configured - user will need manual notification.",
        );
      } else {
        showSuccessToast(data.message || "Invitation sent");
      }
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setIsInviteDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error) => {
      console.error("Invite error:", error);
      showErrorToast(
        error.message || error.data?.error || "An unexpected error occurred",
      );
    },
  });

  // Add this query hook after your existing users query
  const { data: orgStats, isLoading: isOrgStatsLoading } = useQuery({
    queryKey: ["orgStats", orgId],
    // Only run query if orgId is available
    enabled: !!orgId && orgId !== "undefined",
    queryFn: async () => {
      // Double-check orgId before making request
      if (!orgId || orgId === "undefined") {
        throw new Error("Organization ID not available");
      }
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/organization/${orgId}/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`Error: ${res.status} ${res.statusText}`);
      }

      return res.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Helper for null/empty fields
  const safe = (val) =>
    val === null || val === undefined || val === "" ? "-" : val;
  const roleLabels = {
    org_admin: "Organization Admin",
    manager: "Manager",
    employee: "Employee",
  };

  const renderRoles = (roles) =>
    Array.isArray(roles) && roles.length > 0 ? (
      <div className="flex flex-col gap-1">
        {roles.map((role, index) => (
          <Badge
            key={role + index}
            variant="outline"
            className={`${
              role === "org_admin"
                ? "bg-purple-100 text-purple-800 border-purple-200"
                : role === "manager"
                  ? "bg-blue-100 text-blue-800 border-blue-200"
                  : "bg-gray-100 text-gray-800 border-gray-200"
            }`}
          >
            {roleLabels[role] || role}
          </Badge>
        ))}
      </div>
    ) : (
      <Badge variant="outline">-</Badge>
    );

  // Add new user
  const handleAddUser = () => {
    try {
      // Refresh queries after adding user
      fetchLicensePool();
      fetchFreeQuota();
      queryClient.invalidateQueries(["users"]);

      toast({
        title: "User Added Successfully!",
        description: `New users have been invited to your organization. License pool updated.`,
        variant: "default",
        duration: 5000,
      });
    } catch (error) {
      showErrorToast(error.message || "An unexpected error occurred");
    }
  };

  // Edit user
  const handleEditUser = (user) => {
    setSelectedUser({
      ...user,
      name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
    });
    setIsEditUserModalOpen(true);
  };

  const handleUpdateUser = async (userId, userData) => {
    updateUserMutation.mutateAsync({ userId, userData });
  };

  // Deactivate/Reactivate user using UserDataManager
  const toggleUserStatus = (user, action = "activate") => {
    const status = action === "deactivate" ? "inactive" : "active";
    updateUserStatusMutation.mutate({ userId: user._id, status });
  };
  const updateUserStatusMutation = useMutation({
    mutationFn: async ({ userId, status }) => {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/organization/users/update-status", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, status }),
      });
      if (!res.ok) {
        let errorMsg = "Status update failed";
        try {
          const errData = await res.json();
          errorMsg = errData.message || errorMsg;
        } catch {}
        const error = new Error(errorMsg);
        error.status = res.status;
        throw error;
      }
      return res.json();
    },
    onSuccess: (data) => {
      // Refresh license pool and free quota after status change
      fetchLicensePool();
      fetchFreeQuota();

      toast({
        title: "Success",
        description: data.message || "User status updated",
        status: "success",
      });
      queryClient.invalidateQueries(["users"]);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        status: "error",
      });
    },
  });
  // Remove user
  const handleRemoveUser = (user) => {
    setSelectedUser({
      ...user,
      name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
    });
    setIsRemoveDialogOpen(true);
  };

  // Update the confirmRemoveUser function
  const confirmRemoveUser = () => {
    if (selectedUser?._id) {
      removeUserMutation.mutate(selectedUser._id);
    }
  };

  // View user activity
  const handleViewActivity = (user) => {
    setSelectedUser({
      ...user,
      name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
    });
    setIsViewActivityModalOpen(true);
  };

  // Export user data
  const exportUserData = () => {
    if (!usersData || usersData.length === 0) {
      showErrorToast("No user data available to export");
      return;
    }

    const csvData = usersData.map((user) => ({
      Name:
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
        user.name ||
        user.email,
      Email: user.email,
      Role: Array.isArray(user.role) ? user.role.join(", ") : user.role,
      License: user.licenseId || user.license_code || "N/A",
      Department: user.department || "N/A",
      Designation: user.designation || "N/A",
      Status: user.status || "Active",
      "Joined Date": user.createdAt
        ? new Date(user.createdAt).toLocaleDateString()
        : "N/A",
      "Last Login": user.lastLogin
        ? new Date(user.lastLogin).toLocaleDateString()
        : "Never",
      "Tasks Assigned": user.assignedTasks || 0,
      "Tasks Completed": user.completedTasks || 0,
    }));

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [Object.keys(csvData[0]).join(",")]
        .concat(csvData.map((row) => Object.values(row).join(",")))
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "user_activity_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Successful!",
      description:
        "User activity data has been exported to CSV with completion rates.",
      variant: "default",
      duration: 3000,
    });
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case "Company Admin":
        return <Crown className="h-4 w-4 text-purple-600" />;
      case "Manager":
        return <Shield className="h-4 w-4 text-blue-600" />;
      default:
        return <User className="h-4 w-4 text-gray-600" />;
    }
  };

  const totalUsers = orgStats?.user_stats?.total || 0;
  const activeUsers = orgStats?.user_stats?.active || 0;
  const inactiveUsers = orgStats?.user_stats?.inactive || 0;
  const pendingUsers = orgStats?.user_stats?.pending || 0;

  const usersData = data?.users || [];

  return (
    <div className="users-page-container py-3 px-6 max-w-7xl mx-auto space-y-3 bg-gray-50 min-h-full">
      <style>{`
        .users-page-container [class*="rounded"]:not(.rounded-full):not([class*="avatar"]):not([class*="indicator"]) {
          border-radius: 4px !important;
        }
        .users-page-container input:not([type="checkbox"]):not([type="radio"]),
        .users-page-container select,
        .users-page-container textarea,
        .users-page-container button:not(.rounded-full) {
          border-radius: 4px !important;
        }
        [role="dialog"] [class*="rounded"]:not(.rounded-full):not([class*="avatar"]):not([class*="indicator"]),
        [role="dialog"] input:not([type="checkbox"]):not([type="radio"]),
        [role="dialog"] select,
        [role="dialog"] textarea,
        [role="dialog"] button:not(.rounded-full),
        [role="menu"] [class*="rounded"]:not(.rounded-full):not([class*="avatar"]):not([class*="indicator"]),
        [role="listbox"] [class*="rounded"]:not(.rounded-full):not([class*="avatar"]):not([class*="indicator"]),
        [data-radix-popper-content-wrapper] [class*="rounded"]:not(.rounded-full):not([class*="avatar"]):not([class*="indicator"]) {
          border-radius: 4px !important;
        }
      `}</style>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
        <h1 className="text-2xl font-normal m-0"
                style={{ color: "#676a6c" }}>
            {/* <UsersIcon className="h-8 w-8 text-blue-600" /> */}
            User Management
          </h1>
           <p className="mt-0 text-sm text-blue-600">
            Manage all users within your organization&apos;s Tasksetu account
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setIsBulkUploadModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Bulk Upload
          </Button>
          <Button
            onClick={() => setIsAddUserModalOpen(true)}
            className="bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
            disabled={licensePool.length === 0}
          >
            <UserPlus className="h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      {/* Free User Quota Banner */}
      {!loadingFreeQuota && freeQuotaData && (
        <div
          className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm mb-3 ${
            freeQuotaData.used > freeQuotaData.entitled
              ? "border-red-200 bg-red-50 text-red-800"
              : freeQuotaData.remaining === 0
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-blue-100 bg-blue-50 text-blue-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {freeQuotaData.used > freeQuotaData.entitled ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            ) : (
              <ShieldCheck className="h-4 w-4 shrink-0 text-blue-500" />
            )}
            <span>
              <strong>Free Users (Explore):</strong>{" "}
              {freeQuotaData.used} used &nbsp;/&nbsp; {freeQuotaData.entitled} allowed
              {freeQuotaData.used > freeQuotaData.entitled && (
                <span className="ml-2 font-medium text-red-600">
                  (Please deactivate {freeQuotaData.used - freeQuotaData.entitled} free user(s) below to restore access)
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {freeQuotaData.used > freeQuotaData.entitled ? (
              <span className="font-semibold text-red-600">Limit exceeded</span>
            ) : (
              <span>
                <strong>{freeQuotaData.remaining}</strong> remaining
              </span>
            )}
            <div className="flex gap-1">
              {Array.from({ length: freeQuotaData.entitled }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 w-2 rounded-full ${
                    i < freeQuotaData.used
                      ? "bg-blue-500"
                      : "bg-gray-200"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* License Pool Status */}
      <Card className="mb-3">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                License Pool Status
              </CardTitle>
              <CardDescription>
                Current license allocation and availability
              </CardDescription>
            </div>
            {/* <Button
              variant="outline"
              size="sm"
              onClick={fetchLicensePool}
              disabled={loadingLicensePool}
              className="flex items-center gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${loadingLicensePool ? "animate-spin" : ""}`}
              />
              Refresh
            </Button> */}
          </div>
        </CardHeader>
        <CardContent>
          {loadingLicensePool ? (
             <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <Loader className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-lg text-gray-600">Loading license pool...</p>
          </div>
        </div>
          ) : licensePool.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Shield className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p className="mb-2 font-medium">No Active Plan</p>
              <p className="text-sm">
                Your organization does not have any active license plans.
              </p>
              <Button
                onClick={fetchLicensePool}
                className="mt-4 text-sm"
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-3">
              {licensePool.map((license) => {
                const usagePercent =
                  license.total > 0
                    ? (license.assigned / license.total) * 100
                    : 0;

                return (
                  <>
                    {/* Total Licenses Card */}
                    <div className="p-4 rounded-md border-2 transition-all bg-blue-50 border-blue-200 hover:shadow-sm">
                      <div className="text-sm text-gray-600 mb-2">
                        Total Licenses
                      </div>
                      <div className="font-bold text-3xl text-blue-600">
                        {license.total}
                      </div>
                    </div>

                    {/* Assigned Licenses Card */}
                    <div className="p-4 rounded-md border-2 transition-all bg-orange-50 border-orange-200 hover:shadow-sm">
                      <div className="text-sm text-gray-600 mb-2">Assigned</div>
                      <div className="font-bold text-3xl text-orange-600">
                        {license.assigned}
                      </div>
                    </div>

                    {/* Available Licenses Card */}
                    <div className="p-4 rounded-md border-2 transition-all bg-green-50 border-green-200 hover:shadow-sm">
                      <div className="text-sm text-gray-600 mb-2">
                        Available
                      </div>
                      <div
                        className={`font-bold text-3xl ${
                          license.available > 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {license.available}
                      </div>
                    </div>

                    {/* Expired Licenses Card */}
                    <div className="p-4 rounded-md border-2 transition-all bg-red-50 border-red-200 hover:shadow-sm">
                      <div className="text-sm text-gray-600 mb-2">
                        Expired
                      </div>
                      <div
                        className={`font-bold text-3xl ${
                          license.expired > 0
                            ? "text-red-600"
                            : "text-gray-400"
                        }`}
                      >
                        {license.expired || 0}
                      </div>
                    </div>

                    {/* License Type Card */}
                    <div className="p-4 rounded-md border-2 transition-all bg-purple-50 border-purple-200 hover:shadow-sm">
                      <div className="text-sm text-gray-600 mb-2">
                        License Type
                      </div>
                      <div className="font-bold text-2xl text-purple-600">
                        {license.license_code}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {usagePercent.toFixed(0)}% used
                      </div>
                    </div>
                  </>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <UsersIcon className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {activeUsers}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Users</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {pendingUsers}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Inactive Users
            </CardTitle>
            <UserX className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {inactiveUsers}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <CardTitle>All Users</CardTitle>
            <CardDescription>
              Complete list of users in your organization with their details and
              status
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1); // reset to first page
              }}
              className="w-full h-9 pl-8 pr-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          </div>
        </CardHeader>

        <CardContent>
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>License</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Tasks</TableHead>
                <TableHead>Forms</TableHead>
                <TableHead>Active processes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Show loader first */}
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6">
                    <CommonLoader label="Loading users..." />
                  </TableCell>
                </TableRow>
              ) : usersData.length === 0 ? (
                // Show empty message if no users and not loading
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-6 text-gray-500"
                  >
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                // Otherwise, render all users
                usersData.map((user) => (
                  <TableRow key={user._id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        {/* Avatar Circle with Initials */}
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-md flex items-center justify-center text-sm font-medium">
                          {(() => {
                            const first =
                              user.firstName?.trim()?.charAt(0) || "";
                            const last = user.lastName?.trim()?.charAt(0) || "";
                            const emailInitial =
                              user.email?.charAt(0)?.toUpperCase() || "-";
                            return (first + last).toUpperCase() || emailInitial;
                          })()}
                        </div>

                        {/* Name + Email */}
                        <div>
                          <div className="font-medium">
                            {user.firstName + " " + user.lastName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {safe(user.email) || "-"}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap items-center space-x-1">
                        {user.isPrimaryAdmin ? (
                          <Badge className="bg-green-500 text-white mx-2">
                            Primary Admin
                          </Badge>
                        ) : (
                          renderRoles(user.role)
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      {(() => {
                        const licenseCode =
                          (user.license_code && user.license_code !== "No license" ? user.license_code : null) ||
                          (user.licenseId && user.licenseId !== "No license" ? user.licenseId : null) ||
                          "EXPLORE";
                        const licenseStyles = {
                          EXPLORE: "bg-gray-100 text-gray-700 border-gray-200",
                          PLAN: "bg-blue-100 text-blue-700 border-blue-200",
                          EXECUTE:
                            "bg-purple-100 text-purple-700 border-purple-200",
                          OPTIMIZE:
                            "bg-amber-100 text-amber-700 border-amber-200",
                        };
                        const style =
                          licenseStyles[licenseCode] || licenseStyles.EXPLORE;
                        return (
                          <Badge
                            variant="outline"
                            className={`font-medium text-xs ${style}`}
                          >
                            {licenseCode}
                          </Badge>
                        );
                      })()}
                    </TableCell>

                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {safe(user.department)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {safe(user.designation)}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>{getStatusBadge(user.status)}</TableCell>

                    <TableCell className="text-sm text-gray-500">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleDateString()
                        : "-"}
                    </TableCell>

                    <TableCell>
                      <div className="text-sm">
                        {safe(user.completedTasks)}/{safe(user.assignedTasks)}{" "}
                        completed
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-sm font-medium">
                        {safe(user.formsCreated || 0)}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-sm font-medium text-emerald-600">
                        {safe(user.activeProcesses || 0)}
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      {/* 3-dot actions */}

                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-white" align="end">
                          <DropdownMenuItem
                            onClick={() => handleViewActivity(user)}
                          >
                            <Eye className="h-4 w-4 mr-2" /> View Activity
                          </DropdownMenuItem>

                          {/* Allow Edit if:
                           - Current user is Primary Admin: can edit anyone including self
                           - Current user is Secondary Admin: can edit others but NOT themselves
                           - Target user is Primary Admin: only Primary Admin can edit themselves */}
                          {(() => {
                            const isCurrentUserPrimaryAdmin =
                              currentUser?.isPrimaryAdmin === true;
                            const isTargetUserPrimaryAdmin =
                              user.isPrimaryAdmin === true;
                            const isSelf =
                              currentUser?.email?.toLowerCase() ===
                              user?.email?.toLowerCase();

                            // Primary Admin can edit anyone
                            if (isCurrentUserPrimaryAdmin) {
                              return true;
                            }
                            // Secondary Admin cannot edit themselves
                            if (isSelf) {
                              return false;
                            }
                            // Secondary Admin cannot edit Primary Admin
                            if (isTargetUserPrimaryAdmin) {
                              return false;
                            }
                            // Secondary Admin can edit other non-primary users
                            return true;
                          })() && (
                            <DropdownMenuItem
                              onClick={() => handleEditUser(user)}
                            >
                              <Edit3 className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                          )}

                          {/* ✅ NEW: Manage License - Only shown if current user can manage licenses */}
                          {(() => {
                            const isCurrentUserPrimaryAdmin =
                              currentUser?.isPrimaryAdmin === true;
                            const isCurrentUserOrgAdmin =
                              currentUser?.role?.includes("org_admin");

                            // Primary Admin or Org Admin can manage licenses (including themselves)
                            return isCurrentUserPrimaryAdmin || isCurrentUserOrgAdmin;
                          })() && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser({
                                  ...user,
                                  name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
                                });
                                setIsLicenseModalOpen(true);
                              }}
                            >
                              <Award className="h-4 w-4 mr-2 text-blue-600" />{" "}
                              Manage License
                            </DropdownMenuItem>
                          )}

                          {/* Keep other actions hidden for primary admin */}
                          {!user.isPrimaryAdmin && (
                            <>

                              {/* Password Reset */}
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedUser({
                                    ...user,
                                    name: `${user.firstName || ""} ${
                                      user.lastName || ""
                                    }`.trim(),
                                  });
                                  setIsPasswordResetModalOpen(true);
                                }}
                              >
                                <Key className="h-4 w-4 mr-2 text-purple-600" />{" "}
                                Reset Password
                              </DropdownMenuItem>

                              {/* Deactivate/Reactivate */}
                              {user.status?.toLowerCase() === "active" && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setStatusAction("deactivate");
                                    setIsStatusDialogOpen(true);
                                  }}
                                >
                                  <UserX className="h-4 w-4 mr-2 text-red-600" />{" "}
                                  Deactivate
                                </DropdownMenuItem>
                              )}
                              {user.status?.toLowerCase() === "inactive" && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setStatusAction("activate");
                                    setIsStatusDialogOpen(true);
                                  }}
                                >
                                  <RefreshCw className="h-4 w-4 mr-2 text-green-600" />{" "}
                                  Reactivate
                                </DropdownMenuItem>
                              )}

                              {/* Invite */}
                              {(user.status?.toLowerCase() === "invited" ||
                                user.status?.toLowerCase() === "pending") && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedUser({
                                      ...user,
                                      name: `${user.firstName || ""} ${
                                        user.lastName || ""
                                      }`.trim(),
                                    });
                                    setIsInviteDialogOpen(true);
                                  }}
                                  disabled={licensePool.length === 0}
                                >
                                  <Send className="h-4 w-4 mr-2 text-green-600" />{" "}
                                  Invite User
                                </DropdownMenuItem>
                              )}

                              {/* Remove */}
                              <DropdownMenuItem
                                onClick={() => handleRemoveUser(user)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Remove
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={data?.pages || 1}
            itemsPerPage={itemsPerPage}
            totalItems={data?.total || usersData.length}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>

      {/* Add User Modal */}
      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        onUserAdded={handleAddUser}
      />

      {/* Edit User Modal */}
      {selectedUser && (
        <EditUserModal
          isOpen={isEditUserModalOpen}
          onClose={() => {
            setIsEditUserModalOpen(false);
            setSelectedUser(null);
          }}
          user={selectedUser}
          onUserUpdated={(userData) =>
            handleUpdateUser(selectedUser._id, userData)
          }
        />
      )}

      {/* View User Activity Modal */}
      {selectedUser && (
        <ViewUserActivityModal
          isOpen={isViewActivityModalOpen}
          onClose={() => {
            setIsViewActivityModalOpen(false);
            setSelectedUser(null);
          }}
          user={selectedUser}
        />
      )}

      {/* ✅ NEW: License Assignment Modal */}
      {selectedUser && (
        <LicenseAssignmentModal
          isOpen={isLicenseModalOpen}
          onClose={() => {
            setIsLicenseModalOpen(false);
            setSelectedUser(null);
          }}
          user={selectedUser}
          isSecondaryAdmin={!currentUser?.isPrimaryAdmin}
          onSuccess={() => {
            // Refresh license pool, free quota and users data
            fetchLicensePool();
            fetchFreeQuota();
            queryClient.invalidateQueries({ queryKey: ["users"] });
          }}
        />
      )}

      {/* Remove User Confirmation Dialog */}
      <AlertDialog
        open={isRemoveDialogOpen}
        onOpenChange={setIsRemoveDialogOpen}
      >
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Remove User
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedUser && (
                <>
                  Are you sure you want to permanently remove{" "}
                  <strong>{selectedUser.name}</strong> from your organization?
                  <br />
                  <br />
                  {selectedUser?.assignedTasks - selectedUser?.completedTasks >
                  0 ? (
                    <span className="text-red-600 font-medium">
                      ⚠️ This user has{" "}
                      {selectedUser?.assignedTasks -
                        selectedUser?.completedTasks}{" "}
                      active task. Please reassign these tasks before removing
                      the user.
                    </span>
                  ) : (
                    <>
                      This action cannot be undone. The user will be permanently
                      deleted and their license will be returned to the
                      available pool.
                    </>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-between">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveUser}
              disabled={
                selectedUser?.assignedTasks - selectedUser?.completedTasks > 0
              }
              className={"bg-red-600 text-white hover:bg-red-700"}
            >
              {removeUserMutation.isLoading ? "Removing..." : "Remove User"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivate/Activate Confirmation Dialog */}
      <AlertDialog
        open={isStatusDialogOpen}
        onOpenChange={setIsStatusDialogOpen}
      >
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {statusAction === "deactivate" ? (
                <>
                  <UserX className="h-5 w-5 text-red-500" />
                  Deactivate User
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5 text-green-500" />
                  Reactivate User
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedUser && (
                <>
                  Are you sure you want to{" "}
                  <strong>
                    {statusAction === "deactivate"
                      ? "deactivate"
                      : "reactivate"}
                  </strong>{" "}
                  <strong>{selectedUser.name}</strong>?
                  {statusAction === "deactivate" ? (
                    <span className="text-red-600 font-medium">
                      They will lose access to the system and all assigned tasks
                      will show "Owner Inactive".
                    </span>
                  ) : (
                    "They will regain access and can log in normally."
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <div className="flex justify-between w-full">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (selectedUser) {
                    toggleUserStatus(
                      selectedUser,
                      statusAction === "deactivate" ? "deactivate" : "activate",
                    ); // Pass action type
                  }
                  setIsStatusDialogOpen(false);
                }}
                className={
                  statusAction === "deactivate"
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-green-600 text-white hover:bg-green-700"
                }
              >
                {statusAction === "deactivate" ? "Deactivate" : "Reactivate"}
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Invite Confirmation Dialog */}
      <AlertDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
      >
        <AlertDialogContent className="bg-white max-w-fit  ">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-green-500" />
              Send Invitation
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedUser && (
                <>
                  <h2 className="text-lg font-semibold text-gray-900">
                    You are about to send an invitation to:
                  </h2>

                  <div className="mt-4 rounded-md border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 text-gray-800">
                      {/* Name */}
                      <div className="flex flex-col">
                        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                          Name
                        </span>
                        <span className="mt-1 text-sm font-semibold text-gray-900">
                          {selectedUser.name ||
                            `${selectedUser.firstName || ""} ${
                              selectedUser.lastName || ""
                            }`.trim() ||
                            "-"}
                        </span>
                      </div>

                      {/* Email */}
                      <div className="flex flex-col">
                        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                          Email
                        </span>
                        <span className="mt-1 text-sm font-semibold text-gray-900">
                          {selectedUser.email || "-"}
                        </span>
                      </div>

                      {/* Role */}
                      <div className="flex flex-col">
                        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                          Role
                        </span>
                        <span className="mt-1 w-fit text-sm font-semibold text-gray-900">
                          {renderRoles(selectedUser.role)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 text-blue-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16 12H8m8 0l-4 4m4-4l-4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    The user will receive an email with instructions to join.
                  </div>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-between">
            <AlertDialogCancel disabled={sendInviteMutation.isLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                selectedUser && sendInviteMutation.mutate(selectedUser._id)
              }
              disabled={sendInviteMutation.isLoading}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {sendInviteMutation.isLoading ? "Sending..." : "Send Invite"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Upload Modal */}
      <BulkUploadUsersModal
        isOpen={isBulkUploadModalOpen}
        onClose={() => setIsBulkUploadModalOpen(false)}
        onUploadSuccess={() => {
          fetchLicensePool();
          fetchFreeQuota();
          queryClient.invalidateQueries(["users"]);
          queryClient.invalidateQueries(["orgStats"]);
        }}
      />

      {/* Password Reset Modal */}
      {selectedUser && (
        <PasswordResetModal
          isOpen={isPasswordResetModalOpen}
          onClose={() => {
            setIsPasswordResetModalOpen(false);
            setSelectedUser(null);
          }}
          user={selectedUser}
        />
      )}
    </div>
  );
}
