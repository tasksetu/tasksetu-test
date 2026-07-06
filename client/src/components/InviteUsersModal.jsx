import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MultiSelect from "@/components/ui/MultiSelect";
import {
  Mail,
  UserPlus,
  AlertCircle,
  User,
  Building2,
  MapPin,
  Phone,
  Briefcase,
  Plus,
  Trash2,
  Users,
  Loader2,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "../stores/useAuthStore";

export function AddUserModal({ isOpen, onClose, onUserAdded }) {
  const [users, setUsers] = useState([
    {
      id: 1,
      name: "",
      email: "",
      role: [], // Changed from role to roles array
      licenseId: "",
      department: "",
      designation: "",
      location: "",
      phone: "",
      sendInvitationEmail: true,
    },
  ]);
  const [errors, setErrors] = useState({});
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // Get organization license info
  const { data: licenseInfo } = useQuery({
    queryKey: ["/api/organization/license"],
    enabled: isOpen,
  });

  // ── Free user quota ────────────────────────────────────────────────────
  const {
    data: freeQuotaData,
    isLoading: freeQuotaLoading,
    refetch: refetchFreeQuota,
  } = useQuery({
    queryKey: ["/api/organization/free-user-quota"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/organization/free-user-quota", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) throw new Error("Failed to fetch free user quota");
      const result = await response.json();
      return result.data || null;
    },
    enabled: isOpen,
    refetchOnMount: true,
    staleTime: 0,
  });

  // Count how many users in the current form are "free" (EXPLORE or no license)
  const freeUsersInBatch = users.filter(
    (u) => !u.licenseId || u.licenseId === "EXPLORE"
  ).length;

  const freeQuotaExceeded =
    freeQuotaData &&
    freeUsersInBatch > 0 &&
    freeQuotaData.used + freeUsersInBatch > freeQuotaData.entitled;

  const freeUsersRemaining = freeQuotaData
    ? Math.max(0, freeQuotaData.entitled - freeQuotaData.used)
    : null;
  // ─────────────────────────────────────────────────────────────────────

  // ✅ NEW: Fetch available licenses from new license pool API (with fallback)
  const {
    data: availableLicensesData,
    isLoading: licensePoolLoading,
    error: licensePoolError,
    refetch: refetchLicensePool,
  } = useQuery({
    queryKey: ["/api/license/organization/pool"],
    queryFn: async () => {
      console.log("🔄 STEP 1: Fetching license pool data... isOpen:", isOpen);
      const token = localStorage.getItem("token");

      // Try new API first
      let response = await fetch("/api/license/organization/pool", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      // If new API works, use it
      if (response.ok) {
        const result = await response.json();
        console.log(
          "📦 STEP 2: License Pool API (new) response:",
          JSON.stringify(result, null, 2),
        );
        if (result.pool && Array.isArray(result.pool)) {
          const transformed = result.pool.map((sub) => ({
            license_code: sub.license_code,
            license_name: sub.license_name,
            total: sub.total || 0,
            used: sub.used || 0,
            available: sub.available || 0,
          }));
          console.log(
            "✅ STEP 3: Transformed license data (new API):",
            JSON.stringify(transformed, null, 2),
          );
          return transformed;
        }
      }

      // Fallback to legacy multi-subscriptions API
      console.log("⚠️ Falling back to legacy multi-subscriptions API...");
      response = await fetch("/api/organization/multi-subscriptions", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        console.error("❌ STEP 1 ERROR: Response not OK", response.status);
        throw new Error("Failed to fetch license pool");
      }
      const result = await response.json();
      console.log(
        "📦 STEP 2: Multi-subscriptions API raw response:",
        JSON.stringify(result, null, 2),
      );

      // Handle both wrapped and unwrapped responses
      const dataArray = result.data || result;

      if (Array.isArray(dataArray)) {
        const transformed = dataArray.map((sub) => ({
          license_code: sub.license_code,
          license_name: sub.license_name,
          total: sub.seats_purchased || 0,
          used: sub.seats_used || 0,
          available: sub.seats_available || 0,
        }));
        console.log(
          "✅ STEP 3: Transformed license data:",
          JSON.stringify(transformed, null, 2),
        );
        return transformed;
      }
      console.log("⚠️ STEP 3: No valid array found in response");
      return [];
    },
    enabled: isOpen,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 0, // Always fetch fresh data
  });

  console.log(
    "🔍 STEP 4A: Query state - isOpen:",
    isOpen,
    "isLoading:",
    licensePoolLoading,
    "error:",
    licensePoolError,
  );
  console.log(
    "🔍 STEP 4B: availableLicensesData:",
    JSON.stringify(availableLicensesData, null, 2),
  );

  const availableLicenses = Array.isArray(availableLicensesData)
    ? availableLicensesData.filter((license) => {
        console.log(
          `📊 STEP 4C: Checking license ${license.license_code}: total=${license.total}, used=${license.used}, available=${license.available}`,
        );
        return license.available > 0;
      })
    : [];

  console.log(
    "✅ STEP 5: Final available licenses for dropdown:",
    JSON.stringify(availableLicenses, null, 2),
  );

  const roleOptions = [
    { value: "employee", label: "Employee" },
    { value: "manager", label: "Manager" },
    { value: "org_admin", label: "Company Admin" },
  ];
  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log(
        "🚀 STEP 0: Modal OPENED - Resetting form and will fetch fresh license data",
      );
      setUsers([
        {
          id: 1,
          name: "",
          email: "",
          role: [], // Initialize as empty array for MultiSelect
          licenseId: "",
          department: "",
          designation: "",
          location: "",
          phone: "",
          sendInvitationEmail: true,
        },
      ]);
      setErrors({});
      setIsSubmitting(false);
      setIsValidating(false);
      refetchFreeQuota();
    }
  }, [isOpen]);

  // Email validation function
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return "Email is required";
    if (!emailRegex.test(email)) return "Please enter a valid email address";
    return null;
  };

  // Check if email can be invited
  const checkEmailExists = async (email) => {
    try {
      const response = await fetch("/api/organization/check-invitation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      return data.exists;
    } catch (error) {
      console.error("Error checking email:", error);
      return false;
    }
  };

  // Add new user row
  const addUserRow = () => {
    const newId = Math.max(...users.map((u) => u.id)) + 1;
    setUsers([
      ...users,
      {
        id: newId,
        name: "",
        email: "",
        role: [], // Initialize as empty array for MultiSelect
        licenseId: "",
        department: "",
        designation: "",
        location: "",
        phone: "",
        sendInvitationEmail: true,
      },
    ]);
  };

  // Remove user row
  const removeUserRow = (id) => {
    if (users.length > 1) {
      setUsers(users.filter((user) => user.id !== id));
      // Clear errors for removed user
      const newErrors = { ...errors };
      Object.keys(newErrors).forEach((key) => {
        if (key.startsWith(`user_${id}_`)) {
          delete newErrors[key];
        }
      });
      setErrors(newErrors);
    }
  };

  // Handle user input changes
  const handleUserChange = (id, field, value) => {
    console.log("handleUserChange called:", { id, field, value }); // Debug log
    setUsers(
      users.map((user) =>
        user.id === id ? { ...user, [field]: value } : user,
      ),
    );

    // Clear error for this field
    const errorKey = `user_${id}_${field}`;
    if (errors[errorKey]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  // Invitation mutation
  const inviteUsersMutation = useMutation({
    mutationFn: async (inviteData) => {
      const response = await fetch("/api/organization/invite-users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ invites: inviteData, adminUser: user }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || result.error || "Failed to send invitations",
        );
      }

      return result;
    },
    onSuccess: (data) => {
      console.log(
        "✅ STEP 6: Invitation SUCCESS response:",
        JSON.stringify(data, null, 2),
      );
      const successCount = data.results?.success?.length || 0;
      const errorCount = data.results?.errors?.length || 0;
      console.log(
        `📊 STEP 7: Success count: ${successCount}, Error count: ${errorCount}`,
      );

      if (successCount > 0 && errorCount === 0) {
        toast({
          title: "Invitations Sent Successfully!",
          description: `${successCount} user${
            successCount > 1 ? "s have" : " has"
          } been invited to your organization.`,
          variant: "default",
          duration: 5000,
        });
      } else if (successCount > 0 && errorCount > 0) {
        toast({
          title: "Partial Success",
          description: `${successCount} invitation${
            successCount > 1 ? "s" : ""
          } sent successfully, ${errorCount} failed.`,
          variant: "default",
          duration: 8000,
        });
      } else if (successCount === 0 && errorCount > 0) {
        toast({
          title: "Failed to Send Invitations",
          description: `${errorCount} invitation${
            errorCount > 1 ? "s" : ""
          } failed.`,
          variant: "destructive",
          duration: 8000,
        });
      }

      // Refresh all queries BEFORE closing modal
      console.log("🔄 STEP 8: Invalidating all queries...");
      queryClient.invalidateQueries(["users"]);
      queryClient.invalidateQueries({ queryKey: ["/api/organization/users"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/organization/license"],
      });
      // Refresh license pool to show updated available counts (both new and legacy APIs)
      queryClient.invalidateQueries({
        queryKey: ["/api/license/organization/pool"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/organization/multi-subscriptions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["license-pool"],
      });
      // Refresh free user quota counter
      queryClient.invalidateQueries({
        queryKey: ["/api/organization/free-user-quota"],
      });
      console.log("✅ STEP 9: All queries invalidated");

      // Call parent callback if provided
      if (onUserAdded) {
        onUserAdded();
      }

      // Close modal after a short delay to allow refetch
      console.log("⏳ STEP 10: Closing modal in 100ms...");
      setTimeout(() => {
        console.log("🚪 STEP 11: Modal closing now");
        onClose();
      }, 100);
    },
    onError: (error) => {
      // Special handling for free user quota exceeded
      if (error.message && error.message.includes("free user limit")) {
        toast({
          title: "Free User Limit Reached",
          description: error.message,
          variant: "destructive",
          duration: 10000,
        });
        // Refresh quota after error
        refetchFreeQuota();
        return;
      }
      toast({
        title: "Failed to Send Invitations",
        description: error.message,
        variant: "destructive",
        duration: 8000,
      });
    },
  });

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let inviteData = [];
      const newErrors = {};

      // Validate multiple users
      for (const user of users) {
        const userPrefix = `user_${user.id}_`;

        if (!user.name.trim()) {
          newErrors[`${userPrefix}name`] = "Name is required";
        }

        if (!user.email.trim()) {
          newErrors[`${userPrefix}email`] = "Email is required";
        } else {
          const emailError = validateEmail(user.email);
          if (emailError) {
            newErrors[`${userPrefix}email`] = emailError;
          }
        }

        // Check if role is empty (could be empty array or falsy value)
        const hasRole = Array.isArray(user.role)
          ? user.role.length > 0
          : !!user.role;
        if (!hasRole) {
          newErrors[`${userPrefix}role`] = "Role is required";
        }

        // License is now optional - no validation required
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        setIsSubmitting(false);
        return;
      }

      // Check for duplicate emails within the form
      const emails = users.map((u) => u.email.toLowerCase().trim());
      const duplicates = emails.filter(
        (email, index) => emails.indexOf(email) !== index,
      );
      if (duplicates.length > 0) {
        toast({
          title: "Duplicate Emails",
          description: "Please remove duplicate email addresses.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Check existing emails
      for (const user of users) {
        const emailExists = await checkEmailExists(user.email);
        if (emailExists) {
          newErrors[`user_${user.id}_email`] =
            "This email already exists or has been invited";
        }
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        setIsSubmitting(false);
        return;
      }

      inviteData = users.map((user) => ({
        name: user.name.trim(),
        email: user.email.toLowerCase().trim(),
        role: user.role,
        licenseId: user.licenseId,
        department: user.department?.trim() || null,
        designation: user.designation?.trim() || null,
        location: user.location?.trim() || null,
        phone: user.phone?.trim() || null,
        sendEmail: user.sendInvitationEmail,
      }));

      // Client-side free quota guard (server also enforces this)
      const freeInBatch = inviteData.filter(
        (inv) => !inv.licenseId || inv.licenseId === "EXPLORE"
      ).length;

      if (
        freeQuotaData &&
        freeInBatch > 0 &&
        freeQuotaData.used + freeInBatch > freeQuotaData.entitled
      ) {
        const remaining = Math.max(0, freeQuotaData.entitled - freeQuotaData.used);
        toast({
          title: "Free User Limit Reached",
          description:
            remaining === 0
              ? `You have reached your free user limit (${freeQuotaData.used}/${freeQuotaData.entitled}). Upgrade your plan to invite more free users.`
              : `You can only invite ${remaining} more free user${remaining !== 1 ? "s" : ""}. You are trying to invite ${freeInBatch}. Please upgrade your plan.`,
          variant: "destructive",
          duration: 10000,
        });
        setIsSubmitting(false);
        return;
      }

      await inviteUsersMutation.mutateAsync(inviteData);
      setIsSubmitting(false);
    } catch (error) {
      console.error("Error inviting users:", error);
      setIsSubmitting(false);
    }
  };

  const renderUserRow = (user, index) => (
    <div
      key={user.id}
      className="p-4 border border-gray-200 rounded-sm space-y-3"
    >
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900">User {index + 1}</h4>
        {users.length > 1 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeUserRow(user.id)}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Name */}
        <div>
          <Label
            htmlFor={`name_${user.id}`}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id={`name_${user.id}`}
            type="text"
            placeholder="Enter name"
            value={user.name}
            onChange={(e) => handleUserChange(user.id, "name", e.target.value)}
            className={`h-9 ${errors[`user_${user.id}_name`] ? "border-red-300" : ""}`}
          />
          {errors[`user_${user.id}_name`] && (
            <p className="mt-1 text-sm text-red-600">
              {errors[`user_${user.id}_name`]}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <Label
            htmlFor={`email_${user.id}`}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email Address <span className="text-red-500">*</span>
          </Label>
          <Input
            id={`email_${user.id}`}
            type="email"
            placeholder="Enter email address"
            value={user.email}
            onChange={(e) => handleUserChange(user.id, "email", e.target.value)}
            className={`h-9 ${errors[`user_${user.id}_email`] ? "border-red-300" : ""}`}
          />
          {errors[`user_${user.id}_email`] && (
            <p className="mt-1 text-sm text-red-600">
              {errors[`user_${user.id}_email`]}
            </p>
          )}
        </div>

        {/* Role */}
        <div>
          <Label
            htmlFor={`role_${user.id}`}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Role <span className="text-red-500">*</span>
          </Label>

          <MultiSelect
            options={roleOptions}
            value={user.role || []} // expecting array
            onChange={(newRoles) => {
              console.log("MultiSelect changed:", {
                userId: user.id,
                newRoles,
              });
              handleUserChange(user.id, "role", newRoles);
            }}
            className="flex justify-start items-center"
            placeholder="Select role(s)"
            dataTestId={`user_${user.id}_role`}
          />

          {errors[`user_${user.id}_role`] && (
            <p className="mt-1 text-sm text-red-600">
              {errors[`user_${user.id}_role`]}
            </p>
          )}
        </div>

        {/* License */}
        <div>
          <Label
            htmlFor={`license_${user.id}`}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            License Type
          </Label>
          <Select
            key={`license_${user.id}`}
            value={user.licenseId}
            onValueChange={(value) => {
              console.log("License onValueChange:", { userId: user.id, value });
              handleUserChange(user.id, "licenseId", value);
            }}
            disabled={licensePoolLoading}
          >
            <SelectTrigger
              className={
                errors[`user_${user.id}_licenseId`] ? "border-red-300" : ""
              }
            >
              <SelectValue
                placeholder={
                  licensePoolLoading ? "Loading..." : "Select license"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {licensePoolLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm text-gray-500">
                    Loading licenses...
                  </span>
                </div>
              ) : availableLicenses.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 text-center">
                  <p className="font-medium mb-1">No licenses available</p>
                  <p className="text-xs">Please purchase licenses first</p>
                </div>
              ) : (
                availableLicenses.map((license) => (
                  <SelectItem
                    key={license.license_code}
                    value={license.license_code}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>
                        {license.license_name || license.license_code}
                      </span>
                      <span className="ml-2 text-xs text-gray-500">
                        ({license.available} available)
                      </span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {errors[`user_${user.id}_licenseId`] && (
            <p className="mt-1 text-sm text-red-600">
              {errors[`user_${user.id}_licenseId`]}
            </p>
          )}
          {!licensePoolLoading && availableLicenses.length === 0 && (
            <p className="mt-1 text-xs text-gray-500">
              💡 No licenses available. Users will be created without a license.
            </p>
          )}
        </div>

        {/* Department */}
        <div>
          <Label
            htmlFor={`department_${user.id}`}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Department
          </Label>
          <Input
            id={`department_${user.id}`}
            type="text"
            placeholder="Enter department"
            value={user.department}
            onChange={(e) =>
              handleUserChange(user.id, "department", e.target.value)
            }
            className="h-9"
          />
        </div>

        {/* Designation */}
        <div>
          <Label
            htmlFor={`designation_${user.id}`}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Designation
          </Label>
          <Input
            id={`designation_${user.id}`}
            type="text"
            placeholder="Enter designation"
            value={user.designation}
            onChange={(e) =>
              handleUserChange(user.id, "designation", e.target.value)
            }
            className="h-9"
          />
        </div>

        {/* Location */}
        <div>
          <Label
            htmlFor={`location_${user.id}`}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Location
          </Label>
          <Input
            id={`location_${user.id}`}
            type="text"
            placeholder="Enter location"
            value={user.location}
            onChange={(e) =>
              handleUserChange(user.id, "location", e.target.value)
            }
            className="h-9"
          />
        </div>

        {/* Phone */}
        <div>
          <Label
            htmlFor={`phone_${user.id}`}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Phone Number
          </Label>
          <Input
            id={`phone_${user.id}`}
            type="tel"
            placeholder="Enter phone number"
            value={user.phone}
            onChange={(e) => handleUserChange(user.id, "phone", e.target.value)}
            className="h-9"
          />
        </div>
      </div>

      {/* Send Email Checkbox */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id={`sendEmail_${user.id}`}
          checked={user.sendInvitationEmail}
          onCheckedChange={(checked) =>
            handleUserChange(user.id, "sendInvitationEmail", checked)
          }
        />
        <Label
          htmlFor={`sendEmail_${user.id}`}
          className="text-sm font-medium text-gray-700"
        >
          Send Invitation Email
        </Label>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl font-semibold">
            <Users className="h-5 w-5 text-blue-600" />
            <span>Invite Users</span>
          </DialogTitle>
          <DialogDescription>
            Invite single or multiple users to your organization. Users will be
            created in Pending state until invitation is accepted.
          </DialogDescription>
        </DialogHeader>

        {/* ── Free User Quota Banner ──────────────────────────────────── */}
        {!freeQuotaLoading && freeQuotaData && (
          <div
            className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm ${
              freeQuotaExceeded
                ? "border-red-200 bg-red-50 text-red-800"
                : freeUsersRemaining === 0
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-blue-100 bg-blue-50 text-blue-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {freeQuotaExceeded ? (
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              ) : (
                <ShieldCheck className="h-4 w-4 shrink-0 text-blue-500" />
              )}
              <span>
                <strong>Free Users (Explore):</strong>{" "}
                {freeQuotaData.used} used &nbsp;/&nbsp; {freeQuotaData.entitled} allowed
                {/* {freeUsersInBatch > 0 && (
                  <span className="ml-2 font-medium">
                    ({freeUsersInBatch} in this batch)
                  </span>
                )} */}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {freeQuotaExceeded ? (
                <span className="font-semibold text-red-600">Limit exceeded</span>
              ) : (
                <span>
                  <strong>{freeUsersRemaining}</strong> remaining
                </span>
              )}
              <div className="flex gap-1">
                {Array.from({ length: freeQuotaData.entitled }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 w-2 rounded-full ${
                      i < freeQuotaData.used
                        ? "bg-blue-500"
                        : i < freeQuotaData.used + freeUsersInBatch
                        ? "bg-amber-400"
                        : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        )} 

        {/* Quota exceeded inline alert */}
        {freeQuotaExceeded && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <div>
              <p className="font-semibold">Free user limit reached</p>
              <p className="mt-0.5">
                Assign a paid license (PLAN / EXECUTE / OPTIMIZE) to
                the extra users, or{" "}
                <button
                  type="button"
                  className="font-semibold underline hover:no-underline"
                  onClick={onClose}
                >
                  upgrade your plan
                </button>.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-3">
            {users.map((user, index) => renderUserRow(user, index))}
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={addUserRow}
              className="w-30 border-dashed border-2 border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-700 py-3"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add More
            </Button>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              {users.length} user{users.length !== 1 ? "s" : ""} will be invited
            </div>
            <div className="flex space-x-3">
              <Button
                type="button"
                variant="outline"
                className="h-9"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || freeQuotaExceeded}
                className={`h-9 text-white ${
                  freeQuotaExceeded
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {isSubmitting
                  ? "Sending Invitations..."
                  : `Invite ${users.length} User${
                      users.length !== 1 ? "s" : ""
                    }`}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
