import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, Eye, EyeOff, Loader2, XCircle } from "lucide-react";
import { useShowToast } from "@/utils/ToastMessage";
import {
  getPasswordRequirements,
  validatePassword,
} from "../utils/passwordUtils";

export function SimpleAcceptInvite() {
  const [, setLocation] = useLocation();
  const { showSuccessToast, showErrorToast } = useShowToast();

  // Get token from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  const [formData, setFormData] = useState({
    // firstName: "",
    // lastName: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isResending, setIsResending] = useState(false);

  // Password requirement checks
  const passwordRequirements = getPasswordRequirements(formData.password);

  // Derived validity: enable submit only when rules pass and passwords match
  const { valid: isPasswordValid } = validatePassword(formData.password);
  const isConfirmMatch =
    formData.confirmPassword.length > 0 &&
    formData.password === formData.confirmPassword;
  const isFormValid = isPasswordValid && isConfirmMatch;

  // Validate invitation token
  const {
    data: inviteData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/auth/validate-invite", token],
    queryFn: async () => {
      const response = await fetch(`/api/auth/validate-invite?token=${token}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Invalid invitation");
      }
      return response.json();
    },
    enabled: !!token,
    retry: false,
  });

  const handleResendVerification = async () => {
    try {
      setIsResending(true);
      const res = await fetch("/api/auth/resend-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Failed to resend invite");
      }
      showSuccessToast(
        "Invite sent. We emailed you a fresh invite link. Please check your inbox (and spam).",
      );
    } catch (e) {
      showErrorToast(e.message || "Unable to resend");
    } finally {
      setIsResending(false);
      setLocation("/login");
    }
  };

  // Complete invitation mutation
  const completeInviteMutation = useMutation({
    mutationFn: async (userData) => {
      const response = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          ...userData,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to complete invitation");
      }

      return response.json();
    },
    onSuccess: async (data, variables) => {
      showSuccessToast("Account created");

      // If backend returns token/user, store and go to app
      if (data?.token) {
        localStorage.setItem("token", data.token);
        if (data?.user) localStorage.setItem("user", JSON.stringify(data.user));
        setLocation("/dashboard");
        return;
      }

      // Fallback: try to login with invite email + chosen password
      try {
        const loginRes = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: inviteData?.email,
            password: variables?.password,
          }),
        });
        const loginData = await loginRes.json().catch(() => ({}));
        if (loginRes.ok && loginData?.token) {
          localStorage.setItem("token", loginData.token);
          if (loginData?.user)
            localStorage.setItem("user", JSON.stringify(loginData.user));
          showSuccessToast("Signed in");
          setLocation("/dashboard");
          return;
        }
      } catch {
        // ignore and fall through
      }

      // Could not auto sign-in; fallback to login
      setLocation("/login");
    },
    onError: (error) => {
      showErrorToast(error.message || "Registration failed");
    },
  });

  // Add a small helper to validate the whole form (for submit)
  const validateForm = (data) => {
    const next = {};

    const { valid } = validatePassword(data.password);
    if (!data.password) next.password = "Password is required.";
    else if (!valid) next.password = "Password does not meet requirements.";
    if (!data.confirmPassword)
      next.confirmPassword = "Please confirm your password.";
    else if (data.password !== data.confirmPassword)
      next.confirmPassword = "Passwords do not match.";
    return next;
  };

  // Real-time validation for password changes
  const handlePasswordChange = (field, value) => {
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

  const handleSubmit = (e) => {
    e.preventDefault();
    const nextErrors = validateForm(formData);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    completeInviteMutation.mutate(formData);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Invalid Invitation</CardTitle>
            <CardDescription>No invitation token provided</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/login")} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (error || !inviteData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Invalid Invitation</CardTitle>
            <CardDescription>
              {error?.message || "Invalid invitation link"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleResendVerification}
              disabled={isResending}
              className="w-full mt-4 mb-2 bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all duration-200"
            >
              {isResending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Request New Invite"
              )}
            </Button>
            <Button onClick={() => setLocation("/login")} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  console.log("Invite Data:", inviteData.role);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 py-8 px-4">
      <div className="max-w-lg w-full">
        <Card className="shadow-xl border-0">
          {/* Header Section */}
          <CardHeader className="space-y-3 pb-6 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
            <div className="text-center">
              <CardTitle className="text-2xl font-bold">
                Complete Registration
              </CardTitle>
              <CardDescription className="text-blue-100 mt-2">
                You've been invited to join{" "}
                <span className="font-semibold text-white">
                  {inviteData.organizationName}
                </span>
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-3">
            {/* Invitation Details - Compact */}
            <div className="bg-blue-50 rounded-sm p-4 space-y-2.5 border border-blue-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Email
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {inviteData.email}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Role
                </span>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {(
                    inviteData.role ||
                    (inviteData.role ? [inviteData.role] : [])
                  ).map((r, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-600 text-white capitalize"
                    >
                      {r && r?.replace("_", " ")}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Registration Form - Compact */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Password */}
              <div>
                <Label
                  htmlFor="password"
                  className="text-sm font-medium text-gray-700"
                >
                  Password
                </Label>
                <div className="relative mt-1.5">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) =>
                      handlePasswordChange("password", e.target.value)
                    }
                    placeholder="Create a secure password"
                    className={`pr-10 ${
                      errors.password
                        ? "border-red-500 focus-visible:ring-red-500"
                        : ""
                    }`}
                    aria-invalid={!!errors.password}
                    aria-describedby={
                      errors.password ? "password-error" : undefined
                    }
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p
                    id="password-error"
                    className="mt-1.5 text-xs text-red-600 flex items-center"
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    {errors.password}
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <Label
                  htmlFor="confirmPassword"
                  className="text-sm font-medium text-gray-700"
                >
                  Confirm Password
                </Label>
                <div className="relative mt-1.5">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      handlePasswordChange("confirmPassword", e.target.value)
                    }
                    placeholder="Confirm your password"
                    className={`pr-10 ${
                      errors.confirmPassword
                        ? "border-red-500 focus-visible:ring-red-500"
                        : isConfirmMatch
                          ? "border-green-500 focus-visible:ring-green-500"
                          : ""
                    }`}
                    aria-invalid={!!errors.confirmPassword}
                    aria-describedby={
                      errors.confirmPassword
                        ? "confirmPassword-error"
                        : undefined
                    }
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {errors.confirmPassword && (
                  <p
                    id="confirmPassword-error"
                    className="mt-1.5 text-xs text-red-600 flex items-center"
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    {errors.confirmPassword}
                  </p>
                )}
                {isConfirmMatch && (
                  <p className="mt-1.5 text-xs text-green-600 flex items-center">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Passwords match
                  </p>
                )}

                {/* Password Requirements - Compact */}
                <div className="bg-gray-50 rounded-md p-3 mt-2 border border-gray-200">
                  <ul className="grid grid-cols-2 gap-1.5 text-xs">
                    {passwordRequirements.map((req) => (
                      <li key={req.id} className="flex items-center">
                        {req.ok ? (
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-green-600 flex-shrink-0" />
                        ) : (
                          <div className="h-3.5 w-3.5 mr-1.5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                        )}
                        <span
                          className={
                            req.ok
                              ? "text-green-700 font-medium"
                              : "text-gray-600"
                          }
                        >
                          {req.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full text-white bg-blue-600 hover:bg-blue-700 font-medium py-5 text-base shadow-md hover:shadow-lg transition-all duration-200 mt-6"
                disabled={completeInviteMutation.isPending || !isFormValid}
              >
                {completeInviteMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Complete Registration"
                )}
              </Button>
            </form>

            {/* Footer */}
            <div className="text-center text-xs text-gray-500 border-t pt-4">
              By registering, you agree to TaskSetu's Terms of Service and
              Privacy Policy
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default SimpleAcceptInvite;
