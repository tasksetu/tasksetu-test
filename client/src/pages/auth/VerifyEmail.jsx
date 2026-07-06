import { useState, useEffect } from "react";
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
import { useShowToast } from "@/utils/ToastMessage";
import { Eye, EyeOff, CheckCircle, XCircle, Loader2 } from "lucide-react";
import {
  getPasswordRequirements,
  validatePassword,
} from "../../utils/passwordUtils";
import { url } from "zod/v4";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const { showSuccessToast, showErrorToast } = useShowToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationToken, setVerificationToken] = useState("");
  const [errors, setErrors] = useState({});
  const [email, setemail] = useState("");
  const [org, setorg] = useState("");
  const [userName, setUserName] = useState("");
  const [isTokenValid, setIsTokenValid] = useState(null); // null = loading, true = valid, false = invalid
  const passwordRequirements = getPasswordRequirements(password);
  const [isResending, setIsResending] = useState(false); // added

  // Derived validity: enable submit only when rules pass and passwords match
  const { valid: isPasswordValid } = validatePassword(password);
  const isConfirmMatch =
    confirmPassword.length > 0 && password === confirmPassword;
  const isFormValid = isPasswordValid && isConfirmMatch;

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    const name = urlParams.get("name");
    const email = urlParams.get("email");
    const org = urlParams.get("org");

    if (!token) {
      setIsTokenValid(false);
      return;
    }

    setVerificationToken(token);
    if (name) setUserName(name);
    if (email) setemail(email);
    if (org) setorg(org);
    // 🔹 Check token validity with backend
    const checkToken = async () => {
      try {
        const res = await fetch("/api/auth/verify-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: token }),
        });
        const data = await res.json();
        if (data.token) {
          setIsTokenValid(true);
        } else {
          setIsTokenValid(false);
        }
      } catch {
        setIsTokenValid(false);
      }
    };

    checkToken();
  }, []);

  const validateForm = () => {
    const newErrors = {};

    if (!password) {
      newErrors.password = "Password is required";
    } else {
      const { valid, failed } = validatePassword(password);
      if (!valid) {
        newErrors.password = `Password requirements not met: ${failed.join(
          ", ",
        )}`;
      }
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Real-time validation handler
  const handlePasswordChange = (field, value) => {
    if (field === "password") {
      setPassword(value);
    } else {
      setConfirmPassword(value);
    }

    // Real-time validation for password mismatch
    const newErrors = { ...errors };

    if (field === "password" && confirmPassword) {
      if (value !== confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      } else {
        delete newErrors.confirmPassword;
      }
    } else if (field === "confirmPassword") {
      if (value && value !== password) {
        newErrors.confirmPassword = "Passwords do not match";
      } else {
        delete newErrors.confirmPassword;
      }
    }

    // Clear password error if user starts typing
    if (field === "password" && value) {
      delete newErrors.password;
    }

    setErrors(newErrors);
  };

  const handleVerification = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const response = await fetch("/api/auth/verify-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: verificationToken,
          password: password,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        // 1) Prefer token/user from verify response
        if (result?.token) {
          localStorage.setItem("token", result.token);
          if (result?.user)
            localStorage.setItem("user", JSON.stringify(result.user));
          showSuccessToast("Email verified");
          setLocation("/dashboard");
          return;
        }

        // 2) Fallback: try login using email + chosen password
        if (email) {
          try {
            const loginRes = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
            });
            const loginData = await loginRes.json().catch(() => ({}));
            if (loginRes.ok && loginData?.token) {
              localStorage.setItem("token", loginData.token);
              if (loginData.user)
                localStorage.setItem("user", JSON.stringify(loginData.user));
              showSuccessToast("Email verified");
              setLocation("/dashboard");
              return;
            }
          } catch {
            // ignore and fall through to manual sign-in
          }
        }

        // 3) Could not auto sign-in: fall back
        showSuccessToast("Email verified");
        setLocation("/login");
      } else {
        setErrors({ submit: result.message || "Verification failed" });
        showErrorToast(result.message || "Verification failed");
      }
    } catch {
      setErrors({ submit: "Network error. Please check your connection." });
      showErrorToast("Connection error. Check your internet connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      showErrorToast(
        "Cannot resend link. Missing email. Log in and request a new link.",
      );
      setLocation("/login");
      return;
    }
    setIsResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }), // org will be resolved on server
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showSuccessToast("Verification link sent. Check your email");
      } else {
        showErrorToast(data.message || "Unable to resend");
      }
    } catch {
      showErrorToast("Connection error. Check your internet connection.");
    } finally {
      setIsResending(false);
      setLocation("/login");
    }
  };

  // 🔹 Loader while checking token
  if (isTokenValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  // 🔹 Invalid or expired token message
  if (isTokenValid === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full text-center p-7 shadow-lg border border-gray-200 bg-white">
          <div className="flex flex-col items-center space-y-3">
            <div className="bg-red-50 rounded-full p-4">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>

            <h2 className="text-2xl font-semibold text-gray-900">
              Verification Link Expired
            </h2>

            <p className="text-gray-600 text-sm leading-relaxed max-w-xs">
              This verification link is invalid or has expired. Please request a
              new one to activate your account.
            </p>

            <Button
              onClick={handleResendVerification}
              disabled={isResending}
              className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all duration-200"
            >
              {isResending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Request New Link"
              )}
            </Button>

            <Button
              variant="link"
              onClick={() => setLocation("/")}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Back to Home
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // 🔹 Show password form if token valid
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md bg-white border shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
            <CheckCircle className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">
            Verify Your Email
          </CardTitle>
          <CardDescription className="text-slate-600">
            Welcome
            {userName ? `, ${userName}` : ""}! Let’s finish setting up your
            account.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleVerification} className="space-y-3">
            <div className="">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) =>
                    handlePasswordChange("password", e.target.value)
                  }
                  placeholder="Enter your password"
                  className={errors.password ? "border-red-500" : ""}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-slate-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-500" />
                  )}
                </Button>
              </div>

              {errors.password && (
                <p className="text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            <div className="">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) =>
                    handlePasswordChange("confirmPassword", e.target.value)
                  }
                  placeholder="Confirm your password"
                  className={errors.confirmPassword ? "border-red-500" : ""}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-slate-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-500" />
                  )}
                </Button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-red-600">{errors.confirmPassword}</p>
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
                      className={`w-2 h-2 rounded-full mr-2 ${
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

            {errors.submit && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center">
                  <XCircle className="w-4 h-4 text-red-600 mr-2" />
                  <p className="text-sm text-red-600">{errors.submit}</p>
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading || !isFormValid}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Email & Set Password"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button
              variant="link"
              onClick={() => setLocation("/login")}
              className="text-slate-600 hover:text-slate-900"
            >
              Back to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
