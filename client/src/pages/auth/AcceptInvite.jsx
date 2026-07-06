import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import {
  UserPlus,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Building,
  Users,
  CheckSquare,
} from "lucide-react";
import { useShowToast } from "@/utils/ToastMessage";
import { Button } from "@/components/ui/button";
import {
  getPasswordRequirements,
  validatePassword,
} from "../../utils/passwordUtils";

export default function AcceptInvite() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [inviteData, setInviteData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [errors, setErrors] = useState({});
  const { showSuccessToast, showErrorToast } = useShowToast();
  const passwordRequirements = getPasswordRequirements(formData.password);

  // Get token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  // Validate invitation token on component mount
  useEffect(() => {
    if (!token) {
      showErrorToast("Invalid invitation. No invitation token provided");
      setLocation("/login");
      return;
    }

    validateInviteToken();
  }, [token]);

  const validateInviteToken = async () => {
    try {
      setIsValidating(true);
      const response = await fetch(`/api/auth/validate-invite-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Invalid or expired invitation");
      }

      const data = await response.json();
      setInviteData(data);
    } catch (error) {
      showErrorToast(error.message || "Invalid or expired invitation");
      setLocation("/login");
    } finally {
      setIsValidating(false);
      setIsLoading(false);
    }
  };

  // Accept invitation mutation
  const acceptInviteMutation = useMutation({
    mutationFn: async (userData) => {
      const response = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          firstName: userData.firstName,
          lastName: userData.lastName,
          password: userData.password,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to accept invitation");
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Store authentication token
      localStorage.setItem("token", data.token);

      showSuccessToast("Account created");

      // Redirect to dashboard
      setLocation("/login");
    },
    onError: (error) => {
      showErrorToast(error.message || "Unable to create account");
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { valid, failed } = validatePassword(formData.password);
    if (!valid) {
      showErrorToast(
        failed.join(", ") || "Password does not meet requirements",
      );
      return;
    }
    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      showErrorToast("Password and confirm password does not match");
      return;
    }

    // Validate password strength
    if (formData.password.length < 8) {
      showErrorToast(
        "Password too short. Password must be at least 8 characters long",
      );
      return;
    }

    await acceptInviteMutation.mutateAsync(formData);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Real-time validation for password mismatch
    const newErrors = { ...errors };

    if (name === "password" && formData.confirmPassword) {
      if (value !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      } else {
        delete newErrors.confirmPassword;
      }
    } else if (name === "confirmPassword") {
      if (value && value !== formData.password) {
        newErrors.confirmPassword = "Passwords do not match";
      } else {
        delete newErrors.confirmPassword;
      }
    }

    // Clear password error if user starts typing
    if (name === "password" && value) {
      delete newErrors.password;
    }

    setErrors(newErrors);
  };

  if (isLoading || isValidating) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-3">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <h2 className="mt-6 text-xl text-gray-900">
              Validating invitation...
            </h2>
          </div>
        </div>
      </div>
    );
  }

  if (!inviteData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-3">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="mt-6 text-xl text-gray-900">Invalid Invitation</h2>
            <p className="mt-2 text-gray-600">
              This invitation link is invalid or has expired.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-3">
        <div>
          <div className="flex justify-center">
            <div className="flex items-center space-x-2">
              <CheckSquare className="h-8 w-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">TaskSetu</span>
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Complete Your Registration
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            You've been invited to join{" "}
            <span className="font-semibold text-blue-600">
              {inviteData.organizationName}
            </span>
          </p>
        </div>

        {/* Invitation Details */}
        <div className="bg-blue-50 border border-blue-200 rounded-sm p-4">
          <div className="flex items-start space-x-3">
            <UserPlus className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-800">
                Invitation Details
              </h3>
              <div className="mt-2 text-sm text-blue-700 space-y-1">
                <div className="flex items-center">
                  <Building className="h-4 w-4 mr-2" />
                  <span>Organization: {inviteData.organizationName}</span>
                </div>
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-2" />
                  <span>
                    Role:{" "}
                    {inviteData.role === "org_admin" ? "Admin" : "Employee"}
                  </span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  <span>Email: {inviteData.email}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <form className="mt-8 space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-medium text-gray-700"
                >
                  First Name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="mt-1 h-9 appearance-none relative block w-full px-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Enter first name"
                />
              </div>
              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium text-gray-700"
                >
                  Last Name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="mt-1 h-9 appearance-none relative block w-full px-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Enter last name"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="h-9 appearance-none relative block w-full px-3 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Create a password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700"
              >
                Confirm Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="h-9 appearance-none relative block w-full px-3 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-2">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <div className="bg-gray-50 rounded-sm p-4 my-1">
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                Password requirements
              </h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {passwordRequirements.map((req) => (
                  <li key={req.id} className="flex items-center">
                    <span
                      className={`w-2 h-2 rounded-full mr-2 ${req.ok ? "bg-green-500" : "bg-gray-300"}`}
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
          </div>

          <div>
            <Button
              type="submit"
              variant="primary"
              className="w-full h-9"
              disabled={acceptInviteMutation.isPending}
            >
              {acceptInviteMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating Account...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Accept Invitation & Create Account
                </>
              )}
            </Button>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              By creating an account, you agree to our Terms of Service and
              Privacy Policy
            </p>
          </div>
        </form>

        {/* What happens next */}
        <div className="bg-gray-50 rounded-sm p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            What happens next?
          </h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
              Your account will be activated immediately
            </li>
            <li className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
              You'll be redirected to your team's dashboard
            </li>
            <li className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
              Start collaborating with your team right away
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
