import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Eye, EyeOff, AlertCircle, CheckCircle2, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SuperAdminLogin() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [loginSettings, setLoginSettings] = useState({
    backgroundColor: "#1e293b",
    gradientFrom: "#334155",
    gradientTo: "#1e293b",
    useGradient: true,
    backgroundImage: "",
    overlayOpacity: 0.5,
  });

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
        console.log("Using default super admin login settings");
      }
    };

    fetchLoginSettings();
  }, []);

  const generateBackgroundStyle = () => {
    if (loginSettings.backgroundImage) {
      return {
        backgroundImage: `linear-gradient(rgba(0,0,0,${loginSettings.overlayOpacity}), rgba(0,0,0,${loginSettings.overlayOpacity})), url(${loginSettings.backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    } else if (loginSettings.useGradient) {
      return {
        background: `linear-gradient(135deg, ${loginSettings.gradientFrom}, ${loginSettings.gradientTo})`,
      };
    } else {
      return {
        backgroundColor: loginSettings.backgroundColor,
      };
    }
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

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

      if (response.ok) {
        // Check if user is super admin
        // if (result.user.role !== 'super_admin' && result.user.role !== 'superadmin') {
        //   setErrors({ submit: "Access denied. Super admin credentials required." });
        //   setIsLoading(false);
        //   return;
        // }

        localStorage.setItem("token", result.token);
        localStorage.setItem("user", JSON.stringify(result.user));

        toast({
          title: "Welcome Super Admin!",
          description: "You have successfully signed in",
        });

        // Always redirect to super admin dashboard
        window.location.href = "/superadmin";
      } else {
        setErrors({ submit: result.message || "Invalid email or password" });
      }
    } catch (error) {
      setErrors({ submit: "Network error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={generateBackgroundStyle()}
    >
      <div className="max-w-md w-full">
        <div className="bg-white rounded-sm border border-gray-200 p-7 shadow-xl">
          {/* Success Message */}
          {successMessage && (
            <div className="mb-3 p-4 bg-green-50 border border-green-200 rounded-sm">
              <div className="flex items-center">
                <CheckCircle2 className="h-5 w-5 text-green-600 mr-3" />
                <span className="text-green-800 text-sm font-medium">
                  {successMessage}
                </span>
              </div>
            </div>
          )}

          <div className="text-center mb-3">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Shield className="h-8 w-8 text-slate-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Super Admin Access
            </h2>
            <p className="text-gray-600 mt-2">Platform Control & Management</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className={`w-full px-3 py-3 border rounded-md focus:ring-2 focus:ring-slate-500 focus:border-slate-500 ${
                    errors.email ? "border-red-300" : "border-gray-300"
                  }`}
                  placeholder="Enter your admin email"
                />
              </div>
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
              )}
            </div>

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
                  className={`w-full px-3 py-3 pr-10 border rounded-md focus:ring-2 focus:ring-slate-500 focus:border-slate-500 ${
                    errors.password ? "border-red-300" : "border-gray-300"
                  }`}
                  placeholder="Enter your admin password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            {errors.submit && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-sm text-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {errors.submit}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full text-white py-3 px-4 rounded-sm bg-slate-700 hover:bg-slate-800 focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isLoading ? "Signing in..." : "Access Super Admin Panel"}
            </button>
          </form>

          <div className="text-center mt-6 pt-6 border-t border-gray-200">
            <p className="text-gray-600 text-sm">
              Regular user?{" "}
              <Link
                href="/login"
                className="text-slate-600 hover:text-slate-700 font-medium"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
