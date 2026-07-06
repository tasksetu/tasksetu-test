import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useShowToast } from "@/utils/ToastMessage";
import {
  User,
  Camera,
  Save,
  ArrowLeft,
  X,
  Shield,
  Clock,
  Key,
  Settings,
  Bell,
  Globe,
  EyeOff,
  Eye,
  Loader,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useAuthStore } from "../stores/useAuthStore";
import { getPasswordRequirements } from "../utils/passwordUtils";
import {
  getTimezoneOptions,
  detectBrowserTimezone,
} from "../utils/timezoneList";

export default function EditProfile() {
  const [, setLocation] = useLocation();
  const { showSuccessToast, showErrorToast } = useShowToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const timezoneOptions = getTimezoneOptions();
  const timezoneValues = new Set(timezoneOptions.map((tz) => tz.value));

  const normalizeTimezone = (timezone) => {
    if (!timezone) return "Asia/Kolkata";
    if (timezone === "UTC") return "Etc/UTC";
    return timezoneValues.has(timezone) ? timezone : "Asia/Kolkata";
  };

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    department: "",
    manager: "no-manager",
    organizationName: "",
    timeZone: normalizeTimezone(detectBrowserTimezone()),
    emailNotifications: true,
    inAppNotifications: false,
    pushNotifications: false,
  });
  const [originalData, setOriginalData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    department: "",
    manager: "no-manager",
    organizationName: "",
    timeZone: normalizeTimezone(detectBrowserTimezone()),
    emailNotifications: true,
    inAppNotifications: false,
    pushNotifications: false,
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [errors, setErrors] = useState({
    phoneNumber: "",
    firstName: "",
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const firstPasswordFieldRef = useRef(null);
  // Inline errors for password form
  const [passwordErrors, setPasswordErrors] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  // Inline server error for password update
  const [passwordFormError, setPasswordFormError] = useState("");
  const passwordRequirements = getPasswordRequirements(
    passwordData.newPassword,
  );

  // Fetch current user profile - try auth/verify first as fallback
  const { data: authUser } = useQuery({
    queryKey: ["/api/auth/verify"],
    retry: false,
  });

  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/profile"],
    queryFn: async () => {
      // Try to get updated user data from the database using the auth user ID
      if (authUser?.id) {
        const response = await fetch(`/api/users/${authUser.id}`);
        if (response.ok) {
          const userData = await response.json();
          console.log("Fetched user data directly:", userData);
          return userData;
        }
      }
      return null;
    },

    enabled: !!authUser?.id,
  });
  // Fetch organization details once
  const { data: organization } = useQuery({
    queryKey: ["/api/organization/details"],
    enabled: !!localStorage.getItem("token"), // Only call if token exists
    queryFn: async () => {
      const token = localStorage.getItem("token");
      if (!token) return null;

      const res = await fetch("/api/organization/details", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (res.status === 401 || res.status === 403) {
        // Token invalid or expired
        localStorage.removeItem("token");
        return null;
      }

      if (res.status === 400) {
        // Individual user is not associated with any organization - this is normal
        return null;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    },
    retry: false,
    staleTime: Infinity, // Keep cached forever
    cacheTime: Infinity,
  });

  // Fetch license data from /api/license/current
  const { data: licenseData } = useQuery({
    queryKey: ["/api/license/current"],
    enabled: !!localStorage.getItem("token"),
    queryFn: async () => {
      const token = localStorage.getItem("token");
      if (!token) return null;

      const res = await fetch("/api/license/current", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) return null;
      return await res.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch notification settings from /api/notification-settings
  const { data: notificationSettings } = useQuery({
    queryKey: ["/api/notification-settings"],
    enabled: !!localStorage.getItem("token"),
    queryFn: async () => {
      const token = localStorage.getItem("token");
      if (!token) return null;

      const res = await fetch("/api/notification-settings", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) return null;
      return await res.json();
    },
    retry: false,
  });

  // Use profile data primarily, fallback to auth data
  const currentUser = user || authUser;
  // Helper to validate password fields and return errors
  function validatePasswordFields({
    currentPassword,
    newPassword,
    confirmPassword,
  }) {
    const errors = {};

    // Required checks
    if (!currentPassword?.trim()) {
      errors.currentPassword = "Current password is required";
    }
    if (!newPassword?.trim()) {
      errors.newPassword = "New password is required";
    }
    if (!confirmPassword?.trim()) {
      errors.confirmPassword = "Confirm password is required";
    }

    // Only run further checks when newPassword provided
    if (newPassword?.trim()) {
      // Check requirements using helper
      const reqs = getPasswordRequirements(newPassword);
      const failed = reqs.filter((r) => !r.ok);
      if (failed.length > 0) {
        errors.newPassword = "Password does not meet all requirements";
      }

      // New password must differ from current
      if (currentPassword && newPassword === currentPassword) {
        errors.newPassword =
          "New password must be different from current password";
      }
    }

    // Confirm must match
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      errors.confirmPassword = "Password and confirm password does not match";
    }

    return { isValid: Object.keys(errors).length === 0, errors };
  }

  // Update form data when user data is loaded
  useEffect(() => {
    if (currentUser) {
      // Get notification settings from the API response
      const notifChannels = notificationSettings?.data?.channels || {};

      const userData = {
        firstName: currentUser.firstName || "",
        lastName: currentUser.lastName || "",
        // Backend uses `phone`, keep UI field phoneNumber for now
        phoneNumber: currentUser.phone || "",
        department: currentUser.department || "",
        manager: currentUser.manager || "no-manager",
        organizationName: organization?.name,
        timeZone: normalizeTimezone(notificationSettings?.data?.timezone),
        // Use notification settings API data, default in_app to false
        emailNotifications: notifChannels.email?.enabled === true,
        inAppNotifications: notifChannels.in_app?.enabled === true,
        pushNotifications: notifChannels.push?.enabled === true,
      };
      setFormData(userData);
      setOriginalData(userData);

      // Validate phone number on load
      if (
        userData.phoneNumber &&
        userData.phoneNumber.trim() !== "" &&
        !validatePhoneNumber(userData.phoneNumber)
      ) {
        setErrors((prev) => ({
          ...prev,
          phoneNumber: "Please enter a valid phone number (10-15 digits)",
        }));
      } else {
        setErrors((prev) => ({
          ...prev,
          phoneNumber: "",
        }));
      }
    }
  }, [currentUser, organization, notificationSettings]);

  useEffect(() => {
    if (showPasswordModal && firstPasswordFieldRef.current) {
      setTimeout(() => firstPasswordFieldRef.current?.focus(), 50);
    }
  }, [showPasswordModal]);
  // Check for changes
  useEffect(() => {
    const hasFormChanges =
      Object.keys(formData).some(
        (key) => formData[key] !== originalData[key],
      ) || selectedFile !== null;
    setHasChanges(hasFormChanges);
  }, [formData, originalData, selectedFile]);

  // Update profile mutation
  const updateProfile = useMutation({
    mutationFn: async (data) => {
      // Use direct user update API instead of authenticated profile endpoint
      // Try to get user ID from the fetched user data first, then fall back to authUser
      const userId = user?.id || user?._id || authUser?.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const formDataToSend = new FormData();

      // Add text fields
      Object.keys(data).forEach((key) => {
        if (data[key] !== undefined && data[key] !== null) {
          formDataToSend.append(key, data[key]);
        }
      });

      // Add image file if selected
      if (selectedFile) {
        formDataToSend.append("profileImage", selectedFile);
      }

      console.log("Updating profile for user ID:", userId);
      console.log("Update data:", data);

      const response = await fetch(`/api/users/${userId}/profile`, {
        method: "PUT",
        body: formDataToSend,
      });

      console.log("Update response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Update failed:", errorText);
        throw new Error(errorText || "Failed to update profile");
      }

      const result = await response.json();
      console.log("Update successful:", result);
      return result;
    },
    onSuccess: async (data) => {
      console.log("🔄 Profile update onSuccess - Starting cache update");

      showSuccessToast("Profile updated");

      const updatedUserData = {
        ...data.user,
        id: data.user.id || data.user._id,
        _id: data.user._id || data.user.id,
      };

      console.log(
        "📝 Prepared updated user data with firstName:",
        updatedUserData.firstName,
      );

      // STEP 1: Invalidate the auth/verify query to mark cache as stale
      queryClient.invalidateQueries({
        queryKey: ["/api/auth/verify"],
        exact: true,
      });

      // STEP 2: Immediately set the fresh data in cache
      // This ensures components get the data synchronously
      console.log("💾 Setting fresh data in React Query cache");
      queryClient.setQueryData(["/api/auth/verify"], updatedUserData);
      queryClient.setQueryData(["/api/profile"], updatedUserData);

      if (data.user?.id) {
        queryClient.setQueryData(["/api/users", data.user.id], updatedUserData);
      }

      // STEP 3: Trigger refetch from server to ensure backend consistency
      console.log("⏳ Awaiting refetch to validate with server");

      try {
        const refetchResult = await queryClient.refetchQueries({
          queryKey: ["/api/auth/verify"],
          exact: true,
        });

        console.log("✅ Server refetch completed:", refetchResult);
      } catch (error) {
        console.error("⚠️ Server refetch failed (using cached data):", error);
      }

      // STEP 4: Reset local state
      setSelectedFile(null);
      setImagePreview(null);

      // STEP 5: Navigate to dashboard
      // Cache is guaranteed to have fresh data (from setQueryData)
      // Server has validated the change (from refetch)
      console.log("🎯 Redirecting to /dashboard with fresh user data");
      setLocation("/dashboard");
    },
    onError: (error) => {
      setFormData({
        ...formData,
        organizationName: originalData.organizationName,
      });

      let errorMessage = error.message || "Failed to update profile";
      try {
        // Try to parse as JSON if it looks like JSON
        if (errorMessage.startsWith("{")) {
          errorMessage = JSON.parse(errorMessage).message || errorMessage;
        }
      } catch {
        // If JSON parse fails, use the error message as-is
      }

      showErrorToast(errorMessage);
    },
  });

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let newValue = type === "checkbox" ? checked : value;

    // For phone number, only allow digits and limit to 10
    if (name === "phoneNumber") {
      newValue = value.replace(/\D/g, "").slice(0, 10);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));

    if (name === "firstName") {
      setErrors((prev) => ({
        ...prev,
        firstName: newValue.trim() ? "" : "This field is required",
      }));
    }

    if (name === "phoneNumber") {
      if (newValue.trim() === "") {
        setErrors((prev) => ({ ...prev, phoneNumber: "" }));
      } else if (newValue.length !== 10) {
        setErrors((prev) => ({
          ...prev,
          phoneNumber: "Please enter exactly 10 digits",
        }));
      } else {
        setErrors((prev) => ({ ...prev, phoneNumber: "" }));
      }
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    const next = { ...passwordData, [name]: value };
    setPasswordData(next);

    // Re-validate on each change to show inline errors
    const { errors: nextErrors } = validatePasswordFields(next);
    setPasswordErrors(nextErrors);
    // Clear any previous server error as user edits
    setPasswordFormError("");
  };
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    // Inline validation
    const { isValid, errors: nextErrors } =
      validatePasswordFields(passwordData);
    setPasswordErrors(nextErrors);
    setPasswordFormError("");
    if (!isValid) return;

    try {
      setPasswordSubmitting(true);
      // Use POST method and include auth token header
      const token = localStorage.getItem("token");
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(passwordData),
      });

      if (response.ok) {
        showSuccessToast("Password changed");
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        setPasswordErrors({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        setPasswordFormError("");
        setShowPasswordModal(false);
      } else {
        // Try to parse JSON error and map to fields when possible
        let serverMessage = "";
        try {
          const data = await response.json();
          serverMessage = data?.message || data?.error || "";
        } catch (_) {
          serverMessage = await response.text();
        }

        const msg = (serverMessage || "").toString();
        const lower = msg.toLowerCase();
        const fieldErrs = { ...passwordErrors };
        let applied = false;

        // Map common backend messages to field-level errors
        if (
          lower.includes("current password") &&
          (lower.includes("incorrect") || lower.includes("invalid"))
        ) {
          fieldErrs.currentPassword = msg || "Current password is incorrect";
          applied = true;
        } else if (
          lower.includes("new and confirm") &&
          lower.includes("match")
        ) {
          fieldErrs.confirmPassword = "Passwords do not match";
          applied = true;
        } else if (
          lower.includes("must be different") ||
          lower.includes("same as current")
        ) {
          fieldErrs.newPassword =
            msg || "New password must be different from current";
          applied = true;
        } else if (
          lower.includes("weak") ||
          lower.includes("requirements") ||
          lower.includes("at least") ||
          lower.includes("uppercase") ||
          lower.includes("lowercase") ||
          lower.includes("special")
        ) {
          fieldErrs.newPassword = msg || "Password does not meet requirements";
          applied = true;
        }

        if (applied) {
          setPasswordErrors(fieldErrs);
          setPasswordFormError("");
        } else {
          // Fallback to top-level form error
          setPasswordFormError(msg || "Failed to change password");
        }
      }
    } catch (error) {
      setPasswordFormError(error.message || "Failed to change password");
    } finally {
      setPasswordSubmitting(false);
    }
  };
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      showErrorToast("Invalid file type. Use .jpg, .jpeg, .png, or .webp");
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      showErrorToast("File too large. Select an image smaller than 2MB");
      return;
    }

    // Clean up previous preview URL to prevent memory leaks
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setSelectedFile(file);
    // Create immediate preview using object URL for better performance
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    console.log("Image selected for preview:", previewUrl);
  };

  const handleRemoveImage = () => {
    // Clean up preview URL to prevent memory leaks
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setSelectedFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  const handlePasswordModalOpenChange = (open) => {
    setShowPasswordModal(open);
    if (open) {
      // Reset errors when opening
      setPasswordErrors({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordFormError("");
    }
  };
  const handleCancelPasschange = () => {
    setShowPasswordModal(false);
    setPasswordData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setPasswordErrors({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setPasswordFormError("");
    setShowPasswords({ current: false, new: false, confirm: false });
  };
  // Cleanup effect for object URLs
  useEffect(() => {
    return () => {
      // Clean up any remaining object URLs when component unmounts
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (errors.phoneNumber) {
      newErrors.phoneNumber =
        "Please fix the phone number error before submitting";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...newErrors }));
      return;
    }

    setErrors((prev) => ({
      ...prev,
      firstName: "",
    }));

    // Map UI field names to backend expectations
    const dataToSend = { ...formData };
    if (dataToSend.phoneNumber !== undefined) {
      dataToSend.phone = dataToSend.phoneNumber;
      delete dataToSend.phoneNumber;
    }
    if (isAdminWithReadOnlyOrg()) delete dataToSend.organizationName;
    if (dataToSend.manager === "no-manager") dataToSend.manager = "";

    // Remove notification fields from profile update (handled separately)
    delete dataToSend.emailNotifications;
    delete dataToSend.inAppNotifications;
    delete dataToSend.pushNotifications;

    // Update profile
    updateProfile.mutateAsync(dataToSend);

    // Update notification settings separately
    updateNotificationSettings();
  };

  // Function to update notification settings via API
  const updateNotificationSettings = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        showErrorToast("No authentication token found");
        return;
      }

      const currentSettings = notificationSettings?.data || {};

      // Build the update payload matching the API structure
      const updatePayload = {
        channels: {
          email: {
            ...currentSettings.channels?.email,
            enabled: formData.emailNotifications,
          },
          in_app: {
            ...currentSettings.channels?.in_app,
            enabled: formData.inAppNotifications,
          },
          push: {
            ...currentSettings.channels?.push,
            enabled: formData.pushNotifications,
          },
        },
        timezone: formData.timeZone,
      };

      console.log("📧 Updating notification settings:", updatePayload);

      const res = await fetch("/api/notification-settings", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatePayload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        console.log("✅ Notification settings updated successfully:", data);
        // showSuccessToast("Settings updated");
        // Invalidate the notification settings cache to refresh
        queryClient.invalidateQueries(["/api/notification-settings"]);
        return data;
      } else {
        console.error("Failed to update notification settings:", data);
        showErrorToast(
          data?.message || "Failed to update notification settings",
        );
      }
    } catch (error) {
      console.error("Error updating notification settings:", error);
      showErrorToast(error.message || "Error updating notification settings");
    }
  };

  // Helper function to update a single notification channel setting
  const updateSingleNotificationSetting = async (
    channel,
    enabled,
    channelLabel,
  ) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        showErrorToast("No authentication token found");
        return false;
      }

      const currentSettings = notificationSettings?.data || {};

      // Get current form values
      const emailEnabled =
        channel === "email" ? enabled : formData.emailNotifications;
      const inAppEnabled =
        channel === "in_app" ? enabled : formData.inAppNotifications;
      const pushEnabled =
        channel === "push" ? enabled : formData.pushNotifications;

      const updatePayload = {
        channels: {
          email: {
            ...currentSettings.channels?.email,
            enabled: emailEnabled,
          },
          in_app: {
            ...currentSettings.channels?.in_app,
            enabled: inAppEnabled,
          },
          push: {
            ...currentSettings.channels?.push,
            enabled: pushEnabled,
          },
        },
        timezone: formData.timeZone,
      };

      console.log(`📧 Updating ${channelLabel} setting:`, { channel, enabled });

      const res = await fetch("/api/notification-settings", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatePayload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        console.log(`✅ ${channelLabel} updated successfully`);
        const action = enabled ? "enabled" : "disabled";
        showSuccessToast(`${channelLabel} ${action}`);
        queryClient.invalidateQueries(["/api/notification-settings"]);
        return true;
      } else {
        console.error(`Failed to update ${channelLabel}:`, data);
        showErrorToast(data?.message || `Failed to update ${channelLabel}`);
        return false;
      }
    } catch (error) {
      console.error(`Error updating ${channelLabel}:`, error);
      showErrorToast(`Error updating ${channelLabel}`);
      return false;
    }
  };

  // Validation functions
  const validatePhoneNumber = (phone) => {
    const phoneRegex = /^[0-9]{10}$/;
    return phoneRegex.test(phone.replace(/\s/g, ""));
  };

  const validatePasswordStrength = (password) => {
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password)
    );
  };

  // Derived validity for enabling the password submit button
  const isPasswordFormValid = (() => {
    const { isValid } = validatePasswordFields(passwordData);
    return isValid;
  })();
  // Helper functions
  const isOrgUser = () => {
    return currentUser?.role !== "individual" && currentUser?.organizationId;
  };

  // Check if user is admin and should have read-only organization info
  const isAdminWithReadOnlyOrg = () => {
    const adminRoles = ["admin", "company_admin", "owner", "super_admin"];
    return adminRoles.includes(currentUser?.role[0]?.toLowerCase());
  };

  // Check if organization section should be shown
  const shouldShowOrgSection = () => {
    return isOrgUser() || isAdminWithReadOnlyOrg();
  };

  const getRoleBadgeVariant = (role) => {
    const variants = {
      org_admin: "secondary",
      admin: "secondary",
      manager: "outline",
      employee: "destructive",
      individual: "success",
    };
    return variants[role] || "default";
  };

  const getRoleDisplayName = (role) => {
    const names = {
      org_admin: "Organization Admin",
      admin: "Company Admin",
      manager: "Manager",
      employee: "Employee",
      individual: "Individual",
    };
    return names[role] || role;
  };

  const getLicenseDisplayName = (license) => {
    if (!license) return "Not available";
    const names = {
      explore_free: "Explore Free",
      explore: "Explore",
      EXPLORE: "Explore",
      plan: "Plan",
      PLAN: "Plan",
      execute: "Execute",
      EXECUTE: "Execute",
      optimize: "Optimize",
      OPTIMIZE: "Optimize",
    };
    return names[license] || license;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Not available";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getCurrentProfileImage = () => {
    if (imagePreview) return imagePreview;
    if (currentUser?.profileImageUrl) return currentUser.profileImageUrl;
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-lg text-gray-600">Loading task details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="quicktasks-square px-6 py-3 flex flex-1 flex-col min-h-0 bg-gray-50">
      {/* Header */}
      <div className="shrink-0 flex flex-col lg:flex-row lg:items-center lg:justify-between mb-2">
        <div>
          <h1 className="text-2xl font-normal m-0" style={{ color: "#676a6c" }}>
            Edit Profile Settings
          </h1>
          <p className="mt-0 text-sm text-blue-600">
            Manage your personal information, security settings, and preferences
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Profile Image Card */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-purple-100 rounded-sm">
                <User className="h-6 w-6 text-purple-600" />
              </div>
              Profile Picture
            </CardTitle>
            <CardDescription className="text-base text-gray-600 mt-2">
              Update your profile photo and personal visibility settings
            </CardDescription>
          </CardHeader>
          <CardContent className="p-7">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <UserAvatar
                  user={{
                    ...currentUser,
                    profileImageUrl:
                      imagePreview || currentUser?.profileImageUrl,
                  }}
                  size="xl"
                  className="edit-profile-avatar h-24 w-24"
                />
                {imagePreview && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={handleRemoveImage}
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="flex flex-col items-center space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2"
                >
                  <Camera className="h-4 w-4" />
                  {getCurrentProfileImage() ? "Change Photo" : "Upload Photo"}
                </Button>
                <p className="text-sm text-gray-500 text-center">
                  Accepted formats: .jpg, .jpeg, .png, .webp
                  <br />
                  Maximum size: 2MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Basic Information Card */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-blue-100 rounded-sm">
                <User className="h-6 w-6 text-blue-600" />
              </div>
              Basic Information
            </CardTitle>
            <CardDescription className="text-base text-gray-600 mt-2">
              Update your personal details and contact information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-7">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* First Name */}
              <div className="w-full">
                <Label htmlFor="firstName">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  onBlur={(e) =>
                    setErrors((p) => ({
                      ...p,
                      firstName: e.target.value.trim()
                        ? ""
                        : "First name is required",
                    }))
                  }
                  placeholder="First name"
                  data-testid="input-first-name"
                  className={`w-full  p-2  ${
                    errors.firstName ? "border-red-500" : ""
                  }`}
                />
                {errors.firstName && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.firstName}
                  </p>
                )}
              </div>

              <div className="w-full">
                <Label htmlFor="lastName">Last Name </Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="Last name"
                  data-testid="input-last-name"
                  className={`w-full  p-2  `}
                />
              </div>
              {/* Email */}
              <div className="w-full">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  value={currentUser?.email || ""}
                  disabled={true}
                  readOnly={shouldShowOrgSection()}
                  className={`w-full ${
                    shouldShowOrgSection()
                      ? "bg-gray-100 cursor-not-allowed"
                      : ""
                  }`}
                  data-testid="input-email"
                />
                {shouldShowOrgSection() && (
                  <p className="text-xs text-gray-500 mt-1">
                    Email changes are managed by your organization admin
                  </p>
                )}
              </div>

              {/* Phone Number */}
              <div className="w-full">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  inputMode="numeric"
                  maxLength="10"
                  pattern="^[0-9]{0,10}$"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  placeholder="10 digits"
                  data-testid="input-phone"
                  className={`w-full ${
                    errors.phoneNumber
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                      : ""
                  }`}
                />
                {errors.phoneNumber ? (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.phoneNumber}
                  </p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        {shouldShowOrgSection() && (
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-green-100 rounded-sm">
                  <Shield className="h-6 w-6 text-green-600" />
                </div>
                Organization Information
              </CardTitle>
              <CardDescription className="text-base text-gray-600 mt-2">
                Configure your organization details and team structure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-7">
              {isAdminWithReadOnlyOrg() && (
                <div className="bg-blue-50 border border-blue-200 rounded-none p-3 mb-3">
                  <p className="text-sm text-blue-700">
                    <strong>Note:</strong> Organization information is read-only
                    for administrators to maintain data integrity.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <Label htmlFor="organizationName">Organization Name</Label>
                  <Input
                    id="organizationName"
                    name="organizationName"
                    value={formData.organizationName}
                    onChange={handleInputChange}
                    disabled={!user.isPrimaryAdmin}
                    className={
                      !user.isPrimaryAdmin
                        ? "bg-gray-100 cursor-not-allowed"
                        : ""
                    }
                    placeholder={
                      !user.isPrimaryAdmin ? "Enter organization name" : ""
                    }
                    data-testid="input-organization"
                  />
                  {/* {isAdminWithReadOnlyOrg() && (
                          <p className="text-xs text-gray-500 mt-1">
                            Organization information is read-only for
                            administrators
                          </p>
                        )} */}
                  {!user.isPrimaryAdmin && (
                    <p className="text-xs text-gray-500 mt-1">
                      Organization name is managed by administrators
                    </p>
                  )}
                </div>
                {/* <div>
                        <Label htmlFor="department">Department/Team</Label>
                        <Input
                          id="department"
                          name="department"
                          value={formData.department}
                          onChange={handleInputChange}
                          placeholder="e.g., Engineering, Marketing"
                          data-testid="input-department"
                        />
                      </div>
                      {shouldShowOrgSection() && (
                        <div>
                          <Label htmlFor="manager">Manager/Supervisor</Label>
                          <Select
                            name="manager"
                            value={formData.manager}
                            onValueChange={(value) =>
                              setFormData((prev) => ({
                                ...prev,
                                manager: value,
                              }))
                            }
                          >
                            <SelectTrigger data-testid="select-manager">
                              <SelectValue placeholder="Select manager" />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                              <SelectItem value="no-manager">
                                No manager assigned
                              </SelectItem>
                              <SelectItem value="john-doe">John Doe</SelectItem>
                              <SelectItem value="jane-smith">
                                Jane Smith
                              </SelectItem>
                              <SelectItem value="mike-wilson">
                                Mike Wilson
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )} */}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Access & Roles Card */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-amber-100 rounded-sm">
                <Key className="h-6 w-6 text-amber-600" />
              </div>
              Access & Roles
            </CardTitle>
            <CardDescription className="text-base text-gray-600 mt-2">
              View your role permissions and license information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-7">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <Label>Assigned Role</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Array.isArray(currentUser?.role) ? (
                    currentUser.role.map((role) => (
                      <Badge
                        key={role}
                        data-testid={`badge-role-${role}`}
                        variant="outline"
                      >
                        {getRoleDisplayName(role)}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline" data-testid="badge-role">
                      {getRoleDisplayName(currentUser?.role)}
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <Label>License Tier</Label>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline" data-testid="badge-license">
                    {licenseData?.licenseName ||
                      getLicenseDisplayName(
                        currentUser?.license || "explore_free",
                      )}
                  </Badge>
                  {licenseData?.status && (
                    <Badge
                      variant={
                        licenseData.status === "TRIAL" ? "secondary" : "outline"
                      }
                      className={
                        licenseData.status === "TRIAL"
                          ? "bg-yellow-100 text-yellow-800"
                          : ""
                      }
                    >
                      {licenseData.status}
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <Label>Designation</Label>
                <div className="mt-2">
                  {currentUser?.designation || "Not specified"}
                </div>
              </div>
              <div>
                <Label>Department</Label>
                <div className="mt-2">
                  {currentUser?.department || "Not specified"}
                </div>
              </div>
              <div>
                <Label>Date of Joining</Label>
                <p
                  className="text-sm text-gray-600 mt-2"
                  data-testid="text-join-date"
                >
                  {formatDate(currentUser?.createdAt)}
                </p>
              </div>
              {/* {currentUser?.licenseExpiresAt && ( */}
              <div>
                <Label>License Expiring On</Label>
                <p
                  className={`text-sm mt-2 ${licenseData?.isExpired ? "text-red-600 font-medium" : "text-gray-600"}`}
                  data-testid="text-license-expiry"
                >
                  {formatDate(
                    licenseData?.expiry ||
                      licenseData?.licenseDetails?.renewal_date ||
                      currentUser?.licenseExpiresAt,
                  )}
                </p>
              </div>
              {/* // )} */}
            </div>
          </CardContent>
        </Card>

        {/* Security Card */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gradient-to-r from-red-50 to-pink-50 border-b border-red-100">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-red-100 rounded-sm">
                <Shield className="h-6 w-6 text-red-600" />
              </div>
              Security
            </CardTitle>
            <CardDescription className="text-base text-gray-600 mt-2">
              Manage your password and security settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-7">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <Label>Last Login</Label>
                <p
                  className="text-sm text-gray-600 mt-2"
                  data-testid="text-last-login"
                >
                  {formatDate(currentUser?.lastLoginAt) || "Not available"}
                </p>
              </div>
              <div>
                <Label>Password</Label>
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPasswordModal(true)}
                    data-testid="button-change-password"
                  >
                    Change Password
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preferences Card */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gradient-to-r from-cyan-50 to-blue-50 border-b border-cyan-100">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-cyan-100 rounded-sm">
                <Settings className="h-6 w-6 text-cyan-600" />
              </div>
              Preferences
            </CardTitle>
            <CardDescription className="text-base text-gray-600 mt-2">
              Configure your notification settings and timezone preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-7">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-center gap-3">
              {/* Time Zone */}
              <div className="flex flex-col">
                <Label htmlFor="timeZone" className="text-sm font-medium mb-1">
                  Time Zone
                </Label>
                <Select
                  name="timeZone"
                  value={formData.timeZone}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, timeZone: value }))
                  }
                >
                  <SelectTrigger className="w-56" data-testid="select-timezone">
                    <SelectValue placeholder="Select time zone" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {timezoneOptions.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Email Notifications */}
              <div className="flex flex-col items-start px-2 py-1">
                <Label
                  htmlFor="emailNotifications"
                  className="text-sm font-medium mb-1 whitespace-nowrap"
                >
                  Email Notifications
                </Label>
                <Switch
                  id="emailNotifications"
                  checked={formData.emailNotifications}
                  className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-blue-200"
                  onCheckedChange={async (checked) => {
                    setFormData((prev) => ({
                      ...prev,
                      emailNotifications: checked,
                    }));
                    // Update API immediately
                    const success = await updateSingleNotificationSetting(
                      "email",
                      checked,
                      "Email Notifications",
                    );
                    if (!success) {
                      setFormData((prev) => ({
                        ...prev,
                        emailNotifications: !checked,
                      }));
                    }
                  }}
                />
              </div>

              {/* In-App Notifications */}
              <div className="flex flex-col items-start px-2 py-1">
                <Label
                  htmlFor="inAppNotifications"
                  className="text-sm font-medium mb-1 whitespace-nowrap"
                >
                  In-App Notifications
                </Label>
                <Switch
                  id="inAppNotifications"
                  checked={formData.inAppNotifications}
                  className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-blue-200"
                  onCheckedChange={async (checked) => {
                    setFormData((prev) => ({
                      ...prev,
                      inAppNotifications: checked,
                    }));
                    // Update API immediately
                    const success = await updateSingleNotificationSetting(
                      "in_app",
                      checked,
                      "In-App Notifications",
                    );
                    if (!success) {
                      setFormData((prev) => ({
                        ...prev,
                        inAppNotifications: !checked,
                      }));
                    }
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-between space-x-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setFormData({ ...originalData });
              setImagePreview(null);
              setHasChanges(false);
            }}
            className="cursor-pointer text-xs sm:text-sm px-3 py-2 sm:px-4 sm:py-2"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={
              updateProfile.isPending ||
              !hasChanges ||
              !!errors.phoneNumber ||
              !!errors.firstName ||
              !formData.firstName?.trim() ||
              (formData.phoneNumber?.trim() &&
                !validatePhoneNumber(formData.phoneNumber))
            }
            className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer text-xs sm:text-sm px-3 py-2 sm:px-4 sm:py-2"
          >
            {updateProfile.isPending ? (
              <>
                <div className="animate-spin rounded-none h-3 w-3 sm:h-3.5 sm:w-3.5 border-b-2 border-white mr-1"></div>
                <span className="hidden xs:inline">Updating...</span>
                <span className="xs:hidden">Save</span>
              </>
            ) : (
              <>
                <Save className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
                <span className="hidden xs:inline">Save Changes</span>
                <span className="xs:hidden">Save</span>
              </>
            )}
          </Button>
        </div>
      </form>
      {/* Password Change Section */}
      <Dialog
        open={showPasswordModal}
        onOpenChange={handlePasswordModalOpenChange}
      >
        <DialogContent
          className="sm:max-w-md !rounded-none [&_*]:!rounded-none"
          data-testid="dialog-change-password"
        >
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Update your account password. Make sure to use a strong one.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handlePasswordSubmit}
            className="space-y-3"
            data-testid="form-change-password"
          >
            {passwordFormError ? (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-none p-2">
                {passwordFormError}
              </div>
            ) : null}
            <div>
              <Label htmlFor="currentPassword">Current Password *</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type={showPasswords.current ? "text" : "password"}
                  ref={firstPasswordFieldRef}
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  data-testid="input-current-password"
                  placeholder="Enter Current Password"
                  className="h-8 rounded-none"
                />
                <span
                  type="button"
                  onClick={() =>
                    setShowPasswords((prev) => ({
                      ...prev,
                      current: !prev.current,
                    }))
                  }
                  className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700"
                >
                  {showPasswords.current ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </span>
              </div>
              {passwordErrors.currentPassword ? (
                <p className="text-xs text-red-600 mt-1">
                  {passwordErrors.currentPassword}
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="newPassword">New Password *</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type={showPasswords.new ? "text" : "password"}
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                data-testid="input-new-password"
                placeholder="Enter new Password"
                className="h-8 rounded-none"
                endAdornment={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setShowPasswords((prev) => ({
                        ...prev,
                        new: !prev.new,
                      }))
                    }
                    className="h-8 w-8 text-gray-500 hover:text-gray-700"
                  >
                    {showPasswords.new ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                }
              />
              {passwordErrors.newPassword && (
                <p className="text-xs text-red-600 mt-1">
                  {passwordErrors.newPassword}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm New Password *</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showPasswords.confirm ? "text" : "password"}
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                data-testid="input-confirm-password"
                placeholder="Enter Confirm Password"
                className="h-8 rounded-none"
                endAdornment={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setShowPasswords((prev) => ({
                        ...prev,
                        confirm: !prev.confirm,
                      }))
                    }
                    className="h-8 w-8 text-gray-500 hover:text-gray-700"
                  >
                    {showPasswords.confirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                }
              />
              {passwordErrors.confirmPassword && (
                <p className="text-xs text-red-600 mt-1">
                  {passwordErrors.confirmPassword}
                </p>
              )}
            </div>

            <div className="bg-gray-50 rounded-none p-4 mt-2">
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                Password requirements
              </h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {passwordRequirements.map((req) => (
                  <li key={req.id} className="flex items-center">
                    <span
                      className={`w-2 h-2 rounded-none mr-2 ${
                        req.ok ? "bg-green-500" : "bg-gray-300"
                      }`}
                    />
                    <span
                      className={req.ok ? "text-green-700" : "text-gray-600"}
                    >
                      {req.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <DialogFooter>
              <div className="flex w-full justify-between gap-2">
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={passwordSubmitting}
                    onClick={handleCancelPasschange}
                    className="w-full h-8 rounded-none"
                    data-testid="button-cancel-password"
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  className="w-full h-8 rounded-none bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={passwordSubmitting || !isPasswordFormValid}
                  data-testid="button-save-password"
                >
                  {passwordSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-none h-3 w-3 border-b-2 border-white" />
                      Updating...
                    </div>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
