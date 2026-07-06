import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import MultiSelect from "@/components/ui/MultiSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Edit3, Loader2, Info, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "../utils/auth";

export function EditUserModal({ isOpen, onClose, user, onUserUpdated }) {
  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    role: [],
    licenseId: "",
    department: "",
    designation: "",
    location: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [licenseValidation, setLicenseValidation] = useState(null);
  const [isValidatingLicense, setIsValidatingLicense] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user info for permission checks
  const { user: currentUser } = useUserRole();
  const isCurrentUserPrimaryAdmin = currentUser?.isPrimaryAdmin === true;
  const isCurrentUserOrgAdmin = currentUser?.role?.includes("org_admin");
  const isSecondaryAdmin = isCurrentUserOrgAdmin && !isCurrentUserPrimaryAdmin;

  // Detect if target user is primary admin
  const isPrimaryAdmin = user?.isPrimaryAdmin;

  // Check if current user is editing themselves
  const isSelf =
    currentUser?.email?.toLowerCase() === user?.email?.toLowerCase();

  const roleOptions = [
    { value: "employee", label: "Employee" },
    { value: "manager", label: "Manager" },
    { value: "org_admin", label: "Company Admin" },
  ];

  // ✅ NEW: Fetch license pool using new user-level license API
  const { data: licensePoolData, isLoading: licensePoolLoading } = useQuery({
    queryKey: ["/api/license/organization/pool"],
    queryFn: async () => {
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
        console.log("📦 License Pool API (new) response:", result);
        if (result.pool && Array.isArray(result.pool)) {
          return result.pool.map((sub) => ({
            license_code: sub.license_code,
            license_name: sub.license_name,
            total: sub.total || 0,
            used: sub.used || 0,
            available: sub.available || 0,
          }));
        }
      }

      // Fallback to legacy API
      response = await fetch("/api/organization/multi-subscriptions", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch license pool");
      const result = await response.json();
      console.log("📦 Multi-subscriptions API (legacy) response:", result);
      if (result.data && Array.isArray(result.data)) {
        return result.data.map((sub) => ({
          license_code: sub.license_code,
          license_name: sub.license_name,
          total: sub.seats_purchased || 0,
          used: sub.seats_used || 0,
          available: sub.seats_available || 0,
        }));
      }
      return [];
    },
    enabled: isOpen,
  });

  // ✅ NEW: License assignment mutation using new API
  const assignLicenseMutation = useMutation({
    mutationFn: async ({ targetUserId, licenseCode }) => {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/license/assign", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ targetUserId, licenseCode }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to assign license");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/license/organization/pool"],
      });
      queryClient.invalidateQueries({ queryKey: ["license-pool"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  // ✅ NEW: License unassignment mutation
  const unassignLicenseMutation = useMutation({
    mutationFn: async ({ targetUserId }) => {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/license/unassign", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to unassign license");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/license/organization/pool"],
      });
      queryClient.invalidateQueries({ queryKey: ["license-pool"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  // Available licenses from pool - filter only those with available seats
  // Always include user's current license even if no more available
  const availableLicenses = Array.isArray(licensePoolData)
    ? licensePoolData.filter((license) => license.available > 0)
    : [];
  const currentUserLicense = user?.license_code;

  // Make sure user's current license is in the list even if pool is empty for that type
  const currentLicenseInPool = licensePoolData?.find(
    (l) => l.license_code === currentUserLicense,
  );

  // 🆕 PRIMARY ADMIN SPECIAL HANDLING:
  // Primary admin can see and select ALL license types regardless of pool availability
  const allAvailableLicenseTypes = [
    {
      license_code: "EXPLORE",
      license_name: "Explore (Trial)",
      available: 999,
    },
    { license_code: "PLAN", license_name: "Plan", available: 0 },
    { license_code: "EXECUTE", license_name: "Execute", available: 0 },
    { license_code: "OPTIMIZE", license_name: "Optimize", available: 0 },
  ];

  // For primary admin: show all license types with pool counts where available
  const primaryAdminLicenseOptions = allAvailableLicenseTypes.map((lt) => {
    const poolLicense = licensePoolData?.find(
      (l) => l.license_code === lt.license_code,
    );
    return {
      license_code: lt.license_code,
      license_name: lt.license_name,
      available:
        poolLicense?.available ?? (lt.license_code === "EXPLORE" ? 999 : 0),
      isPrimaryAdminOption: true,
    };
  });

  // For regular users: only show licenses with available seats (or their current license)
  const allLicenseOptions = isCurrentUserPrimaryAdmin
    ? primaryAdminLicenseOptions
    : currentUserLicense &&
        !availableLicenses.find((l) => l.license_code === currentUserLicense) &&
        currentLicenseInPool
      ? [...availableLicenses, { ...currentLicenseInPool, available: 0 }]
      : availableLicenses;

  // ✅ NEW: Check if secondary admin can change this user's license
  const canChangeLicense = () => {
    // Primary admin can change anyone's license
    if (isCurrentUserPrimaryAdmin) return true;

    // Secondary admin restrictions
    if (isSecondaryAdmin) {
      // Cannot change own license
      if (isSelf) return false;
      // Cannot change primary admin's license
      if (isPrimaryAdmin) return false;
      // Can change other users' licenses
      return true;
    }

    return false;
  };

  useEffect(() => {
    if (isOpen && user) {
      setFormData({
        firstname: user.firstName || "",
        lastname: user.lastName || "",
        role: Array.isArray(user.role)
          ? user.role
          : [user.role].filter(Boolean),
        licenseId: user.license_code || user.license || "",
        department: user.department || "",
        designation: user.designation || "",
        location: user.location || "",
      });
      setErrors({});
      setIsSubmitting(false);
      setLicenseValidation(null);
    }
  }, [isOpen, user]);

  /**
   * ✅ NEW: Validate license change before submission
   */
  const validateLicenseChange = async (targetLicenseCode) => {
    if (!user?._id && !user?.id) return null;
    if (targetLicenseCode === currentUserLicense) {
      setLicenseValidation(null);
      return null;
    }

    try {
      setIsValidatingLicense(true);
      const token = localStorage.getItem("token");
      const response = await fetch("/api/license/validate-change", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetUserId: user._id || user.id,
          targetLicenseCode: targetLicenseCode,
        }),
      });

      const data = await response.json();
      console.log("📋 License validation result:", data);

      setLicenseValidation(data);
      return data;
    } catch (error) {
      console.error("❌ License validation failed:", error);
      return null;
    } finally {
      setIsValidatingLicense(false);
    }
  };

  const validateField = (fieldName, value) => {
    if (value && value.length > 50) {
      return `${
        fieldName.charAt(0).toUpperCase() + fieldName.slice(1)
      } must be less than 50 characters`;
    }
    return null;
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }

    // ✅ NEW: Validate license change when license is selected
    if (field === "licenseId" && value !== currentUserLicense) {
      validateLicenseChange(value);
    } else if (field === "licenseId") {
      setLicenseValidation(null);
    }
  };

  // New: handle roles change inline, prevent removing last role
  const handleRolesChange = (newRoles) => {
    if (!Array.isArray(newRoles)) newRoles = [newRoles].filter(Boolean);
    if (newRoles.length === 0) {
      setErrors((prev) => ({ ...prev, role: "At least one role is required" }));
      return; // keep previous roles
    }
    setFormData((prev) => ({ ...prev, role: newRoles }));
    if (errors.role) {
      setErrors((prev) => ({ ...prev, role: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const newErrors = {};
    if (!formData.firstname.trim())
      newErrors.firstname = "First name is required";
    else if (formData.firstname.length > 50)
      newErrors.firstname = "First name must be less than 50 characters";
    if (formData.lastname && formData.lastname.length > 50)
      newErrors.lastname = "Last name must be less than 50 characters";

    // changed: validate role using unified key and array
    if (!Array.isArray(formData.role) || formData.role.length === 0)
      newErrors.role = "At least one role is required";

    // License is now optional
    // if (!formData.licenseId || formData.licenseId.length === 0)
    //   newErrors.licenseId = "License is required";

    ["department", "designation", "location"].forEach((f) => {
      const err = validateField(f, formData[f]);
      if (err) newErrors[f] = err;
    });

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      setIsSubmitting(false);
      return;
    }

    try {
      // ✅ NEW: Handle license change via new API if license changed
      const licenseChanged = formData.licenseId !== (currentUserLicense || "");

      if (licenseChanged && canChangeLicense()) {
        console.log(
          "📝 License changed from",
          currentUserLicense,
          "to",
          formData.licenseId,
        );

        // ✅ NEW: Check if downgrade is blocked
        if (licenseValidation?.isDowngrade && !licenseValidation?.allowed) {
          toast({
            title: "Downgrade Not Allowed",
            description:
              "Current usage exceeds target license limits. Please reduce usage first.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }

        // If changing to empty OR EXPLORE (unassigning), call unassign
        if (
          (!formData.licenseId || formData.licenseId === "EXPLORE") &&
          currentUserLicense &&
          currentUserLicense !== "EXPLORE"
        ) {
          await unassignLicenseMutation.mutateAsync({
            targetUserId: user._id || user.id,
          });
          toast({
            title: "License Updated",
            description: `User license changed to Explore (Trial)`,
          });
        }
        // If assigning a new license
        else if (formData.licenseId && formData.licenseId !== "EXPLORE") {
          await assignLicenseMutation.mutateAsync({
            targetUserId: user._id || user.id,
            licenseCode: formData.licenseId,
          });
          const isUpgrade = licenseValidation?.isUpgrade;
          toast({
            title: isUpgrade ? "License Upgraded" : "License Updated",
            description: `User assigned ${formData.licenseId} license successfully${isUpgrade ? ". Usage carried forward." : ""}`,
          });
        }
      } else if (licenseChanged && !canChangeLicense()) {
        // Show warning if they tried to change but don't have permission
        console.log("⚠️ User tried to change license but lacks permission");
      }

      const updatedUser = {
        firstName: formData.firstname,
        lastName: formData.lastname,
        role: formData.role, // already an array
        license_code: formData.licenseId, // Include license for assignment
        designation: formData.designation,
        department: formData.department,
        location: formData.location,
      };

      if (onUserUpdated) onUserUpdated(updatedUser);

      setIsSubmitting(false);
      onClose();
    } catch (error) {
      console.error("Error updating user:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto z-50">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-xl font-semibold">
              <Edit3 className="h-5 w-5 text-blue-600" />
              <span>Edit User Details</span>
            </DialogTitle>
            <DialogDescription>
              Update user information.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* First Name */}
              <div>
                <Label htmlFor="firstname">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="firstname"
                  type="text"
                  placeholder="Enter first name"
                  value={formData.firstname}
                  onChange={(e) =>
                    handleInputChange("firstname", e.target.value)
                  }
                  maxLength={50}
                  className={`h-9 ${
                    errors.firstname
                      ? "border-red-300 focus:border-red-500"
                      : ""
                  }`}
                />
                {errors.firstname && (
                  <p className="mt-2 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.firstname}
                  </p>
                )}
              </div>

              {/* Last Name */}
              <div>
                <Label htmlFor="lastname">Last Name</Label>
                <Input
                  id="lastname"
                  type="text"
                  placeholder="Enter last name"
                  value={formData.lastname}
                  onChange={(e) =>
                    handleInputChange("lastname", e.target.value)
                  }
                  maxLength={50}
                  className={`h-9 ${errors.lastname ? "border-red-300 focus:border-red-500" : ""}`}
                />
                {errors.lastname && (
                  <p className="mt-2 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.lastname}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="h-9 bg-gray-50 text-gray-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Email ID cannot be edited
                </p>
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
                  value={
                    Array.isArray(formData.role)
                      ? formData.role
                      : [formData.role].filter(Boolean)
                  }
                  onChange={handleRolesChange}
                  placeholder="Select role(s)"
                  disabled={isPrimaryAdmin} // 👈 pass this prop to control interactivity
                  className={
                    isPrimaryAdmin
                      ? "opacity-60 cursor-not-allowed flex justify-start items-center"
                      : ""
                  }
                />

                {isPrimaryAdmin && (
                  <p className="mt-1 text-xs text-gray-500">
                    Primary admin role cannot be changed
                  </p>
                )}

                {errors.role && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.role}
                  </p>
                )}
              </div>

              {/* Other fields */}
              <div>
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  type="text"
                  placeholder="Enter department"
                  value={formData.department}
                  onChange={(e) =>
                    handleInputChange("department", e.target.value)
                  }
                  className="h-9"
                />
              </div>

              <div>
                <Label htmlFor="designation">Designation</Label>
                <Input
                  id="designation"
                  type="text"
                  placeholder="Enter designation"
                  value={formData.designation}
                  onChange={(e) =>
                    handleInputChange("designation", e.target.value)
                  }
                  className="h-9"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  type="text"
                  placeholder="Enter location"
                  value={formData.location}
                  onChange={(e) =>
                    handleInputChange("location", e.target.value)
                  }
                  className="h-9"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
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
                disabled={
                  isSubmitting ||
                  isValidatingLicense ||
                  (licenseValidation?.isDowngrade &&
                    !licenseValidation?.allowed)
                }
                className="h-9 bg-blue-600 text-white hover:bg-blue-700"
              >
                {isSubmitting
                  ? "Updating..."
                  : isValidatingLicense
                    ? "Validating..."
                    : licenseValidation?.isDowngrade &&
                        !licenseValidation?.allowed
                      ? "Downgrade Blocked"
                      : "Update User"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
