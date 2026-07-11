import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  Mail,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ClipboardList,
  Users,
  Bell,
  BarChart3,
  ShieldCheck,
  Cloud,
  UserCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import LockoutModal from "@/components/LockoutModal";

export default function Login() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [successMessage, setSuccessMessage] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [showLockoutModal, setShowLockoutModal] = useState(false);
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(0);
  const [checkingLockout, setCheckingLockout] = useState(false);
  const [rememberMe, setRememberMe] = useState(false); // 🆕 NEW: Remember me state
  const [fieldValidation, setFieldValidation] = useState({
    email: { isValid: false, message: "", touched: false },
    password: { isValid: false, message: "", touched: false },
  });
  const [attemptCount, setAttemptCount] = useState(0);
  const [lastAttemptTime, setLastAttemptTime] = useState(0);
  const firstErrorFieldRef = useRef(null);
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const [loginSettings, setLoginSettings] = useState({
    backgroundColor: "#fbfdff",
    gradientFrom: "#ffffff",
    gradientTo: "#f5f8ff",
    useGradient: true,
    backgroundImage: "",
    overlayOpacity: 0.5,
  });

  // If already authenticated, redirect away from login
  const { data: verifiedUser } = useQuery({
    queryKey: ["/api/auth/verify"],
    // Don't aggressively refetch here; just read if available
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: !!localStorage.getItem("token"),
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    const cachedUser =
      verifiedUser ||
      (localStorage.getItem("user")
        ? JSON.parse(localStorage.getItem("user"))
        : null);
    if (token && cachedUser) {
      // Check for a saved returnUrl (e.g., from shared form link)
      const returnUrl = sessionStorage.getItem("returnUrl");
      if (returnUrl) {
        sessionStorage.removeItem("returnUrl");
        navigate(returnUrl);
        return;
      }
      // Determine destination based on role
      const roles = Array.isArray(cachedUser.role)
        ? cachedUser.role
        : cachedUser.role
          ? [cachedUser.role]
          : [];

      if (roles.includes("super_admin") || roles.includes("superadmin")) {
        navigate("/superadmin");
      } else {
        navigate("/dashboard");
      }
    }
  }, [verifiedUser, navigate]);

  // Fetch login settings on component mount
  useEffect(() => {
    const fetchLoginSettings = async () => {
      try {
        const response = await fetch("/api/public/login-settings");
        if (response.ok) {
          const settings = await response.json();
          setLoginSettings(settings);
        }
      } catch (error) {
        console.log("Using default login settings");
      }
    };

    fetchLoginSettings();
  }, []);

  // Detect browser autofill and sync state
  useEffect(() => {
    const checkAutofill = () => {
      // Check if browser has autofilled the inputs
      if (emailInputRef.current && passwordInputRef.current) {
        const emailValue = emailInputRef.current.value;
        const passwordValue = passwordInputRef.current.value;

        // If values exist but formData doesn't have them, sync
        if (emailValue && emailValue !== formData.email) {
          setFormData((prev) => ({ ...prev, email: emailValue }));
          // Also validate the autofilled value
          const validation = validateField("email", emailValue);
          setFieldValidation((prev) => ({
            ...prev,
            email: { ...validation, touched: true },
          }));
        }

        if (passwordValue && passwordValue !== formData.password) {
          setFormData((prev) => ({ ...prev, password: passwordValue }));
          // Also validate the autofilled value
          const validation = validateField("password", passwordValue);
          setFieldValidation((prev) => ({
            ...prev,
            password: { ...validation, touched: true },
          }));
        }
      }
    };

    // Check after a short delay to allow browser autofill to complete
    const timeoutId = setTimeout(checkAutofill, 100);

    // Also check on any user interaction with the form
    const handleInteraction = () => checkAutofill();
    document.addEventListener("click", handleInteraction, { once: true });
    document.addEventListener("keydown", handleInteraction, { once: true });

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
    };
  }, []);

  // Check for success message in URL params or sessionStorage
  useEffect(() => {
    // Check URL params
    const urlParams = new URLSearchParams(window.location.search);
    const message = urlParams.get("message");
    if (message) {
      setSuccessMessage(message);
      // Clean up URL without the message parameter
      window.history.replaceState({}, "", "/login");
    }

    // Check sessionStorage for inactivity logout message
    const logoutMessage = sessionStorage.getItem("logoutMessage");
    if (logoutMessage) {
      setSuccessMessage(logoutMessage);
      sessionStorage.removeItem("logoutMessage");
    }
  }, []);

  // Check lockout status when page loads or email changes
  useEffect(() => {
    const checkLockoutStatus = async () => {
      if (!formData.email || !validateEmail(formData.email)) return;

      setCheckingLockout(true);
      try {
        const response = await fetch("/api/auth/check-lockout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: formData.email }),
        });

        const result = await response.json();
        if (response.ok && result.success && result.locked) {
          setLockoutTimeLeft(result.timeLeft);
          setShowLockoutModal(true);
        }
      } catch (error) {
        console.error("Error checking lockout status:", error);
      } finally {
        setCheckingLockout(false);
      }
    };

    // Only check if email is valid and not currently loading
    if (formData.email && validateEmail(formData.email) && !isLoading) {
      const debounceTimer = setTimeout(checkLockoutStatus, 500); // Debounce
      return () => clearTimeout(debounceTimer);
    }
  }, [formData.email, isLoading]);

  const generateBackgroundStyle = () => {
    if (loginSettings.backgroundImage && !loginSettings.useGradient) {
      let imageUrl = loginSettings.backgroundImage;

      // If image is stored in database, use the API endpoint
      if (imageUrl === "db") {
        imageUrl = "/api/public/login-image";
      }

      // Handle different image URL formats
      if (imageUrl && !imageUrl.startsWith("http")) {
        // Relative path or API endpoint - prepend origin for absolute URL
        imageUrl = `${window.location.origin}${imageUrl}`;
      }

      return {
        backgroundImage: `linear-gradient(rgba(0,0,0,${loginSettings.overlayOpacity}), rgba(0,0,0,${loginSettings.overlayOpacity})), url(${imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        minHeight: "100vh",
      };
    } else if (loginSettings.useGradient) {
      return {
        background: `linear-gradient(135deg, ${loginSettings.gradientFrom}, ${loginSettings.gradientTo})`,
        minHeight: "100vh",
      };
    } else {
      return {
        backgroundColor: loginSettings.backgroundColor,
        minHeight: "100vh",
      };
    }
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Inline validation functions
  const validateField = (fieldName, value) => {
    let isValid = false;
    let message = "";

    switch (fieldName) {
      case "email":
        if (!value.trim()) {
          message = "Email address is required";
        } else if (!validateEmail(value)) {
          message =
            "Invalid format, please use something like name@company.com";
        } else {
          isValid = true;
          message = "";
        }
        break;
      case "password":
        if (!value.trim()) {
          message = "Password is required";
        } else if (value.length < 8) {
          message = "Must be at least 8 characters long";
        } else {
          isValid = true;
          message = "";
        }
        break;
    }

    return { isValid, message };
  };

  const handleFieldValidation = (fieldName, value) => {
    const validation = validateField(fieldName, value);
    setFieldValidation((prev) => ({
      ...prev,
      [fieldName]: {
        ...validation,
        touched: true,
      },
    }));
    return validation;
  };

  // Rate limiting check
  const checkRateLimit = () => {
    const now = Date.now();
    const timeDiff = now - lastAttemptTime;
    const oneMinute = 60 * 1000;

    if (timeDiff < oneMinute && attemptCount >= 10) {
      return {
        isBlocked: true,
        message: "Too many login attempts. Please try again in a few minutes.",
      };
    }

    if (timeDiff >= oneMinute) {
      setAttemptCount(0);
    }

    return { isBlocked: false, message: "" };
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear previous errors
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }

    // Real-time validation on typing (debounced)
    if (fieldValidation[field].touched) {
      const validation = validateField(field, value);
      setFieldValidation((prev) => ({
        ...prev,
        [field]: {
          ...validation,
          touched: true,
        },
      }));
    }
  };

  const handleFieldBlur = (field, value) => {
    handleFieldValidation(field, value);
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    // Check if user is currently locked out
    if (showLockoutModal) {
      return;
    }

    // Check rate limiting
    const rateLimitCheck = checkRateLimit();
    if (rateLimitCheck.isBlocked) {
      setErrors({ submit: rateLimitCheck.message });
      return;
    }

    // Validate all fields
    const emailValidation = handleFieldValidation("email", formData.email);
    const passwordValidation = handleFieldValidation(
      "password",
      formData.password,
    );

    const hasErrors = !emailValidation.isValid || !passwordValidation.isValid;

    if (hasErrors) {
      // Focus on first error field
      if (!emailValidation.isValid && emailInputRef.current) {
        emailInputRef.current.focus();
        firstErrorFieldRef.current = emailInputRef.current;
      } else if (!passwordValidation.isValid && passwordInputRef.current) {
        passwordInputRef.current.focus();
        firstErrorFieldRef.current = passwordInputRef.current;
      }

      // Announce error for screen readers
      if (firstErrorFieldRef.current) {
        firstErrorFieldRef.current.setAttribute(
          "aria-describedby",
          "form-error",
        );
        firstErrorFieldRef.current.setAttribute("aria-invalid", "true");
      }

      return;
    }

    // Update rate limiting counters
    setAttemptCount((prev) => prev + 1);
    setLastAttemptTime(Date.now());

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const result = await response.json();

      console.log("login user : ", result);
      if (response.ok) {
        // 🆕 FIXED: Use localStorage for persistent storage, sessionStorage otherwise
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem("token", result.token);
        storage.setItem("user", JSON.stringify(result.user));
        storage.setItem("role", JSON.stringify(result.user.role));

        // Also store in localStorage for non-Remember Me (for backward compatibility)
        if (!rememberMe) {
          localStorage.setItem("token", result.token);
          localStorage.setItem("user", JSON.stringify(result.user));
          localStorage.setItem("role", JSON.stringify(result.user.role));
        }

        // ✅ Store token expiry time (24 hours from now) for frontend expiry check
        const expiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        localStorage.setItem("tokenExpiry", expiryTime.toISOString());

        // 💡 Store expired-license warning for org admins (read by ExpiredLicenseAlert)
        if (result.expiredLicenseWarning) {
          sessionStorage.setItem(
            "expiredLicenseWarning",
            JSON.stringify(result.expiredLicenseWarning)
          );
        } else {
          sessionStorage.removeItem("expiredLicenseWarning");
        }

        // Set activeRole to the first role (or highest priority role)
        const userRoles = Array.isArray(result.user.role)
          ? result.user.role
          : [result.user.role];
        const roleOrder = [
          "employee",
          "individual",
          "manager",
          "org_admin",
          "super_admin",
          "superadmin",
        ];
        const highestRole = userRoles.sort((a, b) => {
          const indexA = roleOrder.indexOf(a?.toLowerCase());
          const indexB = roleOrder.indexOf(b?.toLowerCase());
          return indexB - indexA; // Descending - highest first
        })[0];
        // 🆕 Store activeRole in same storage type
        storage.setItem("activeRole", highestRole);
        localStorage.setItem("activeRole", highestRole); // Also in localStorage for backward compat

        // Create consistent user data object with profile image prioritized
        const userDataForCache = {
          ...result.user,
          _id: result.user.id,
          id: result.user.id,
          role: result.user.role,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          profileImageUrl: result.user.profileImageUrl || null, // Ensure it's set even if null
        };

        // Set user data in both caches immediately to prevent loading state
        queryClient.setQueryData(["/api/auth/verify"], userDataForCache);
        queryClient.setQueryData(["/api/profile"], userDataForCache);

        toast({
          title: "Welcome back!",
          description: "You have successfully signed in",
          duration: 5000,
        });

        // Use role-based redirection from server response
        // Check for a saved returnUrl first (e.g., from shared form link)
        const returnUrl = sessionStorage.getItem("returnUrl");
        if (returnUrl) {
          sessionStorage.removeItem("returnUrl");
          navigate(returnUrl);
        } else {
          navigate(result.redirectTo || "/dashboard");
        }
      } else {
        // Handle lockout scenario
        if (response.status === 423 && result.isLockout) {
          setLockoutTimeLeft(result.timeLeft);
          setShowLockoutModal(true);
          setErrors({}); // Clear form errors when showing lockout modal
        } else {
          // Handle remaining attempts warning or regular error
          setErrors({ submit: result.message || "Invalid email or password" });
        }
      }
    } catch (error) {
      setErrors({ submit: "Network error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();

    if (!resetEmail.trim()) {
      setErrors({ resetEmail: "Email is required" });
      return;
    }

    if (!validateEmail(resetEmail)) {
      setErrors({ resetEmail: "Please enter a valid email address" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      const result = await response.json();

      if (response.ok) {
        // Persist for ResetPassword to reuse
        localStorage.setItem("lastResetEmail", resetEmail);

        setResetSent(true);
        toast({
          title: "Reset link sent",
          description:
            "Please check your email for password reset instructions",
          duration: 5000,
        });
      } else {
        setErrors({
          resetEmail: result.message || "Failed to send reset email",
        });
      }
    } catch (error) {
      setErrors({ resetEmail: "Network error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 py-8 md:px-8 bg-[#f7f9fc] overflow-hidden"
      style={generateBackgroundStyle()}
    >
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(120deg, rgba(243,246,252,0.94) 0%, rgba(236,242,250,0.9) 50%, rgba(244,245,252,0.94) 100%)",
          }}
        />
        <div
          className="absolute top-0 left-0 w-full h-[2px]"
          style={{ boxShadow: "0 6px 16px rgba(15, 23, 42, 0.18)" }}
        />
        <div
          className="absolute top-6 left-8 h-16 w-16 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(rgba(156, 163, 175, 0.35) 1px, transparent 1px)",
            backgroundSize: "8px 8px",
          }}
        />
        <div
          className="absolute -left-24 -bottom-72 h-[24rem] w-[24rem] rounded-full"
          style={{
            background:
              "radial-gradient(circle at 62% 42%, rgba(209, 220, 249, 0.95) 0%, rgba(224, 233, 252, 0.78) 52%, rgba(255, 255, 255, 0) 100%)",
          }}
        />
        <div
          className="absolute right-0 bottom-0 h-44 w-64 opacity-65"
          style={{
            background:
              "radial-gradient(circle at 92% 92%, rgba(216, 205, 255, 0.46) 0%, rgba(228, 219, 255, 0.28) 36%, rgba(255, 255, 255, 0) 72%)",
          }}
        />
        <div
          className="absolute right-12 bottom-8 h-12 w-12 opacity-45"
          style={{
            backgroundImage:
              "radial-gradient(rgba(167, 139, 250, 0.42) 1px, transparent 1px)",
            backgroundSize: "7px 7px",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8 items-start">
          <div className="bg-white border border-gray-200 rounded-sm p-6 shadow-lg self-start mt-8 lg:mt-14">
            {showForgotPassword ? (
              !resetSent ? (
                <>
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">
                      Reset Password
                    </h2>
                    <p className="text-gray-600 mt-2 text-sm leading-relaxed">
                      Enter your email address and we'll send you a link to
                      reset your password
                    </p>
                  </div>
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="email"
                          value={resetEmail}
                          onChange={(e) => {
                            setResetEmail(e.target.value);
                            if (errors.resetEmail) {
                              setErrors((prev) => ({
                                ...prev,
                                resetEmail: "",
                              }));
                            }
                          }}
                          className={`w-full h-10 pl-10 pr-3 border rounded-sm focus:outline-none focus:border-blue-500 ${
                            errors.resetEmail
                              ? "border-red-300"
                              : "border-gray-300"
                          }`}
                          placeholder="Enter your email"
                        />
                      </div>
                      {errors.resetEmail && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.resetEmail}
                        </p>
                      )}
                    </div>
                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full h-10 rounded-sm"
                      disabled={isLoading}
                    >
                      {isLoading ? "Sending..." : "Send Reset Link"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-10 rounded-sm"
                      onClick={() => setShowForgotPassword(false)}
                    >
                      Back to Sign In
                    </Button>
                  </form>
                </>
              ) : (
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-sm flex items-center justify-center mx-auto mb-4">
                    <Mail className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">
                    Check Your Email
                  </h2>
                  <p className="text-gray-600 mb-3">
                    We've sent a password reset link to{" "}
                    <strong>{resetEmail}</strong>
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    Please check your email and click the reset link to create a
                    new password. The link will expire in 30 minutes for
                    security reasons.
                  </p>
                  <Button
                    variant="primary"
                    className="w-full h-10 rounded-sm"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetSent(false);
                      setResetEmail("");
                    }}
                  >
                    Back to Sign In
                  </Button>
                </div>
              )
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-b from-blue-500 to-blue-700 rounded-sm flex items-center justify-center mx-auto mb-3 shadow">
                    <span className="text-white font-bold text-xl">TS</span>
                  </div>
                  <h2 className="text-[36px] leading-none font-bold text-gray-900">
                    Welcome Back
                  </h2>
                  <p className="text-gray-600 text-sm mt-1">
                    Sign in to your TaskSetu account
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <input
                        ref={emailInputRef}
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          handleInputChange("email", e.target.value)
                        }
                        onBlur={(e) => handleFieldBlur("email", e.target.value)}
                        className={`w-full h-10 px-3 pr-10 border rounded-sm focus:outline-none text-sm transition-colors ${
                          fieldValidation.email.touched
                            ? fieldValidation.email.isValid
                              ? "border-green-300 focus:border-green-500"
                              : "border-red-300 focus:border-red-500"
                            : "border-gray-300 focus:border-blue-500"
                        }`}
                        placeholder="Enter your email"
                        aria-describedby={
                          fieldValidation.email.touched &&
                          !fieldValidation.email.isValid
                            ? "email-error"
                            : undefined
                        }
                        aria-invalid={
                          fieldValidation.email.touched &&
                          !fieldValidation.email.isValid
                        }
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                        {fieldValidation.email.touched &&
                          (fieldValidation.email.isValid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          ))}
                        <Mail className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                    {fieldValidation.email.touched &&
                      !fieldValidation.email.isValid && (
                        <div
                          id="email-error"
                          className="flex items-start gap-1.5 text-xs text-red-600 mt-1.5"
                          role="alert"
                        >
                          <XCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                          <span>{fieldValidation.email.message}</span>
                        </div>
                      )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        ref={passwordInputRef}
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) =>
                          handleInputChange("password", e.target.value)
                        }
                        onBlur={(e) =>
                          handleFieldBlur("password", e.target.value)
                        }
                        className={`w-full h-10 px-3 pr-16 border rounded-sm focus:outline-none text-sm transition-colors ${
                          fieldValidation.password.touched
                            ? fieldValidation.password.isValid
                              ? "border-green-300 focus:border-green-500"
                              : "border-red-300 focus:border-red-500"
                            : "border-gray-300 focus:border-blue-500"
                        }`}
                        placeholder="Enter your password"
                        aria-describedby={
                          fieldValidation.password.touched &&
                          !fieldValidation.password.isValid
                            ? "password-error"
                            : undefined
                        }
                        aria-invalid={
                          fieldValidation.password.touched &&
                          !fieldValidation.password.isValid
                        }
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                        {fieldValidation.password.touched &&
                          (fieldValidation.password.isValid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          ))}
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-gray-400 hover:text-gray-600 p-0.5"
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    {fieldValidation.password.touched &&
                      !fieldValidation.password.isValid && (
                        <div
                          id="password-error"
                          className="flex items-start gap-1.5 text-xs text-red-600 mt-1.5"
                          role="alert"
                        >
                          <XCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                          <span>{fieldValidation.password.message}</span>
                        </div>
                      )}
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center text-sm text-gray-700 gap-2">
                      <input
                        id="remember-me"
                        name="remember-me"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      Remember me
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {errors.submit && (
                    <div
                      className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-none text-xs flex items-start gap-2"
                      role="alert"
                    >
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{errors.submit}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full h-10 rounded-sm font-medium"
                    disabled={
                      isLoading ||
                      showLockoutModal ||
                      !formData.email.trim() ||
                      !formData.password.trim()
                    }
                    title={
                      isLoading
                        ? "Signing in..."
                        : showLockoutModal
                          ? "Account is temporarily locked"
                          : !formData.email.trim() || !formData.password.trim()
                            ? "Please fill in all fields to continue"
                            : "Sign in to your account"
                    }
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-b-transparent mr-2"></div>
                        Signing in...
                      </div>
                    ) : showLockoutModal ? (
                      "Account Locked"
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <LogIn className="h-4 w-4" />
                        Sign In
                      </div>
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-600">
                    Don't have an account?{" "}
                    <Link
                      href="/register"
                      className="text-blue-600 hover:text-blue-700 font-semibold"
                    >
                      Create
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="hidden lg:block p-2">
            <div className="flex items-start justify-between gap-6">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2 mb-6">
                  <div className="h-9 w-9 rounded bg-blue-600 text-white text-xl font-bold flex items-center justify-center">
                    TS
                  </div>
                  <span className="text-2xl font-semibold text-gray-800">
                    TaskSetu -<span className="text-2xl text-blue-600"> UAT</span>
                  </span>
                </div>

                <h2 className="text-[40px] font-bold text-gray-900 leading-[1.1] tracking-[-0.8px] -mt-1">
                  Simple. Lightweight.
                  <br />
                  <span className="text-blue-600">Task Management</span> That
                  Just Works.
                </h2>
                <p className="mt-4 text-gray-600 leading-8 max-w-2xl text-[21px]">
                  TaskSetu helps individuals and teams stay organized, follow
                  through, and get things done - without the clutter.
                </p>
              </div>

              <div className="hidden xl:block w-full max-w-[400px] shrink-0 mt-4">
                <img 
                  src="/login-illustration.png" 
                  alt="Task Management Illustration" 
                  className="w-full h-auto object-contain"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 mt-8">
              <div className="rounded-sm border border-gray-200 bg-white p-4">
                <ClipboardList className="h-5 w-5 text-blue-500" />
                <h3 className="mt-3 font-semibold text-gray-900 text-sm">
                  Different Types
                  <br />
                  of Tasks
                </h3>
                <p className="mt-2 text-xs text-gray-600 leading-5">
                  Create regular, recurring, and milestone tasks with ease.
                </p>
              </div>
              <div className="rounded-sm border border-gray-200 bg-white p-4">
                <Users className="h-5 w-5 text-purple-500" />
                <h3 className="mt-3 font-semibold text-gray-900 text-sm">
                  Team & Collaboration
                </h3>
                <p className="mt-2 text-xs text-gray-600 leading-5">
                  Onboard your organization and collaborate with selected
                  members.
                </p>
              </div>
              <div className="rounded-sm border border-gray-200 bg-white p-4">
                <Bell className="h-5 w-5 text-green-500" />
                <h3 className="mt-3 font-semibold text-gray-900 text-sm">
                  Stay on Track
                </h3>
                <p className="mt-2 text-xs text-gray-600 leading-5">
                  Follow-ups and reminders help you focus on what matters most.
                </p>
              </div>
              <div className="rounded-sm border border-gray-200 bg-white p-4">
                <BarChart3 className="h-5 w-5 text-amber-500" />
                <h3 className="mt-3 font-semibold text-gray-900 text-sm">
                  Smart Dashboard
                </h3>
                <p className="mt-2 text-xs text-gray-600 leading-5">
                  Real-time insights and summaries at a glance.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-sm border border-gray-200 bg-gradient-to-r from-[#f5f8ff] to-[#eff3ff] px-4 py-3">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 shrink-0 rounded-xl bg-gradient-to-br from-blue-300 to-blue-500 flex items-center justify-center">
                  <ShieldCheck className="h-7 w-7 text-white" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-gray-800 leading-5">
                    Built for productivity, designed for individuals and teams.
                  </p>
                  <p className="mt-1 text-[13px] text-gray-600">
                    Secure, simple, and scalable task management
                  </p>
                  <p className="text-[13px] text-gray-600">
                    for businesses of all sizes.
                  </p>
                </div>

                <div className="hidden xl:flex items-center text-[13px] text-gray-600">
                  <div className="flex items-center gap-2 px-5 border-l border-gray-300">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    <span>Secure & Private</span>
                  </div>
                  <div className="flex items-center gap-2 px-5 border-l border-gray-300">
                    <Cloud className="h-4 w-4 text-blue-600" />
                    <span>Cloud Synced</span>
                  </div>
                  <div className="flex items-center gap-2 px-5 border-l border-gray-300">
                    <UserCheck className="h-4 w-4 text-blue-600" />
                    <span>Team Friendly</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lockout Modal */}
      <LockoutModal
        isOpen={showLockoutModal}
        timeLeft={lockoutTimeLeft}
        onClose={() => setShowLockoutModal(false)}
      />
    </div>
  );
}
