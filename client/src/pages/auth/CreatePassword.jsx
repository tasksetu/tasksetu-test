import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  PartyPopper,
} from "lucide-react";
import { useShowToast } from "@/utils/ToastMessage";
import { Button } from "@/components/ui/button";
import {
  getPasswordRequirements,
  validatePassword,
} from "../../utils/passwordUtils";

export default function CreatePassword() {
  const [, setLocation] = useLocation();
  const { showSuccessToast, showErrorToast } = useShowToast();
  const [email, setEmail] = useState("");
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const passwordRequirements = getPasswordRequirements(formData.password);

  useEffect(() => {
    // Get email from URL params or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get("email");
    const emailVerified = localStorage.getItem("emailVerified");
    const verifiedEmail = localStorage.getItem("verifiedEmail");

    if (
      emailParam &&
      emailVerified === "true" &&
      verifiedEmail === emailParam
    ) {
      setEmail(emailParam);
    } else if (verifiedEmail && emailVerified === "true") {
      setEmail(verifiedEmail);
    } else {
      // Email not verified or no email found, redirect to verification
      showErrorToast("Email verification required. Verify your email first.");
      setLocation("/login");
    }
  }, [setLocation, toast]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      // Real-time validation for password mismatch
      const newErrors = { ...errors };

      // Check if passwords match whenever either field changes
      if (updated.password && updated.confirmPassword) {
        if (updated.password !== updated.confirmPassword) {
          newErrors.confirmPassword = "Passwords do not match";
        } else {
          delete newErrors.confirmPassword;
        }
      } else if (updated.confirmPassword && !updated.password) {
        newErrors.confirmPassword = "Passwords do not match";
      } else {
        delete newErrors.confirmPassword;
      }

      // Clear password error if user starts typing
      if (field === "password" && value) {
        delete newErrors.password;
      }

      setErrors(newErrors);
      return updated;
    });
  };

  const handleCreatePassword = async (e) => {
    e.preventDefault();

    if (!email) {
      setErrors({ submit: "Email verification required" });
      return;
    }
    const { valid, failed } = validatePassword(formData.password);
    if (!valid) {
      showErrorToast(`Password requirements not met: ${failed.join(", ")}`);
      return;
    }

    const newErrors = {};

    if (!formData.password) {
      newErrors.password = "Password is required";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      // Try individual registration completion first
      let response = await fetch("/api/auth/complete-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          password: formData.password,
        }),
      });

      // If individual registration fails, try organization registration
      if (!response.ok) {
        response = await fetch("/api/auth/complete-organization-registration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email,
            password: formData.password,
          }),
        });
      }

      const result = await response.json();

      if (response.ok) {
        // Clean up verification data
        localStorage.removeItem("verificationEmail");
        localStorage.removeItem("emailVerified");
        localStorage.removeItem("verifiedEmail");

        // Show success screen instead of auto-login
        setShowSuccessScreen(true);
      } else {
        setErrors({ submit: result.message || "Failed to create password" });
        showErrorToast(result.message || "Registration failed");
      }
    } catch (error) {
      setErrors({ submit: "Network error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl border border-gray-200 p-7 shadow-lg">
          <div className="text-center mb-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Lock className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Create Your Password
            </h2>
            <p className="text-gray-600 mt-2">Complete your account setup</p>
          </div>

          {email && (
            <div className="bg-green-50 border border-green-200 rounded-sm p-4 mb-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-green-800">
                    <span className="font-medium">Email verified:</span> {email}
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleCreatePassword} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) =>
                    handleInputChange("password", e.target.value)
                  }
                  className={`w-full h-9 px-3 pr-10 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.password ? "border-red-300" : "border-gray-300"
                  }`}
                  placeholder="Create a strong password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    handleInputChange("confirmPassword", e.target.value)
                  }
                  className={`w-full h-9 px-3 pr-10 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.confirmPassword
                      ? "border-red-300"
                      : "border-gray-300"
                  }`}
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <div className="bg-gray-50 rounded-sm p-4">
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

            {errors.submit && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-sm text-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {errors.submit}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full h-9"
              disabled={isLoading || !email}
            >
              {isLoading ? "Creating account..." : "Complete Setup"}
            </Button>
          </form>

          <div className="text-center mt-6 pt-6 border-t border-gray-200">
            <p className="text-gray-600 text-sm">
              Need to verify your email again?{" "}
              <Link
                href="/verify-email"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Verify Email
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
