import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useShowToast } from "@/utils/ToastMessage";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Shield,
  PartyPopper,
} from "lucide-react";
import {
  getPasswordRequirements,
  validatePassword,
} from "../../utils/passwordUtils";

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(
        /[!@#$%^&*(),.?":{}|<>]/,
        "Password must contain at least one special character",
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export default function VerifyAndSetPassword() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState("");
  const [userInfo, setUserInfo] = useState(null);
  const [tokenType, setTokenType] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const { showErrorToast } = useShowToast();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm({
    resolver: zodResolver(passwordSchema),
    mode: "onChange",
  });

  const password = watch("password", "");
  const passwordRequirements = getPasswordRequirements(password);

  // Extract token from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get("token");

    if (tokenParam) {
      setToken(tokenParam);
      verifyToken(tokenParam);
    } else {
      setVerificationError(
        "Invalid verification link. Please check your email and try again.",
      );
      setIsLoading(false);
    }
  }, []);

  // Verify token and get user info
  const verifyToken = async (tokenValue) => {
    try {
      setIsLoading(true);
      setVerificationError("");

      const response = await apiRequest("POST", "/api/auth/verify-token", {
        token: tokenValue,
      });

      if (!response || !response.user) {
        throw new Error("Invalid response format - missing user data");
      }

      setUserInfo(response.user);
      setTokenType(response.tokenType);
      setIsLoading(false);
    } catch (error) {
      setVerificationError(
        error.message || "Invalid or expired verification link.",
      );
      setIsLoading(false);
    }
  };

  // Set password mutation
  const setPasswordMutation = useMutation({
    mutationFn: async (data) => {
      return await apiRequest("POST", "/api/auth/set-password", {
        token,
        password: data.password,
      });
    },
    onSuccess: () => {
      // Show success screen instead of immediate redirect
      setShowSuccessScreen(true);
    },
    onError: (error) => {
      setVerificationError(
        error.message || "Failed to set password. Please try again.",
      );
    },
  });

  const onSubmit = (data) => {
    const { valid, failed } = validatePassword(data.password);
    if (!valid) {
      showErrorToast(
        failed.join(", ") || "Password does not meet requirements",
      );
      return;
    }
    setPasswordMutation.mutate(data);
  };

  if (verificationError && !userInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-3">
              <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-red-600 dark:text-red-400">
              Verification Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{verificationError}</AlertDescription>
            </Alert>
            <Button
              onClick={() => setLocation("/login")}
              className="w-full mt-4 h-9"
              variant="outline"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-gray-600">Verifying your account...</p>
      </div>
    );
  }

  if (!userInfo) {
    console.log("Rendering no user info state - this should not happen");
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-gray-600">
              No user information available. Please try again.
            </p>
            <Button
              onClick={() => setLocation("/login")}
              className="w-full mt-4 h-9"
              variant="outline"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-3">
            <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle>
            {tokenType === "invitation"
              ? `Welcome to ${userInfo.organizationName}!`
              : `Welcome, ${userInfo.firstName}!`}
          </CardTitle>
          <CardDescription>
            {tokenType === "invitation"
              ? "Complete your account setup by creating a secure password to join your organization."
              : "Let's finish setting up your account by creating a secure password."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
                  className={`h-9 ${errors.password ? "border-red-500" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  {...register("confirmPassword")}
                  className={`h-9 ${errors.confirmPassword ? "border-red-500" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-red-600">
                  {errors.confirmPassword.message}
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

            {/* Error Display */}
            {verificationError && (
              <Alert variant="destructive">
                <AlertDescription>{verificationError}</AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              className="w-full h-9"
              disabled={!isValid || setPasswordMutation.isPending}
            >
              {setPasswordMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Setting Password...
                </>
              ) : (
                "Set Password & Complete Setup"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
