import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  User,
  Building2,
  ArrowRight,
  Shield,
  Target,
  Users,
  BarChart3,
  ArrowLeft,
  AlertCircle,
  ClipboardList,
  Bell,
  Cloud,
  UserCheck,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  // Separate form data
  const [individualData, setIndividualData] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });

  const [organizationData, setOrganizationData] = useState({
    organizationName: "",
    numberOfEmployees: "",
    firstName: "",
    lastName: "",
    email: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const handleReset = () => {
    setIndividualErrors({});
    setOrganizationErrors({});
    setOrganizationData({
      organizationName: "",
      numberOfEmployees: "",
      firstName: "",
      lastName: "",
      email: "",
    });
    setIndividualData({
      firstName: "",
      lastName: "",
      email: "",
    });
  };
  // Separate error objects
  const [individualErrors, setIndividualErrors] = useState({});
  const [organizationErrors, setOrganizationErrors] = useState({});
  const handleTypeSelection = (type) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setSelectedType(type);
      setIsTransitioning(false);

      // Clear errors when switching forms
      if (type === "individual") {
        setOrganizationErrors({});
      } else if (type === "organization") {
        setIndividualErrors({});
      }
    }, 200);
  };

  const validateField = (formType, field, value) => {
    let error = "";
    const fieldLabels = {
      firstName: "First Name",

      email: "Email",
      organizationName: "Organization Name",
    };

    if (!value.trim()) {
      error = `${fieldLabels[field] || field} is required`;
    } else {
      if (field === "email") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) error = "Please enter a valid email";
      }
    }

    if (formType === "organization") {
      setOrganizationErrors((prev) => ({ ...prev, [field]: error }));
    } else if (formType === "individual") {
      setIndividualErrors((prev) => ({ ...prev, [field]: error }));
    }
  };
  const handleBackToChoice = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setSelectedType(null);
      setIsTransitioning(false);
    }, 200);
  };

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };
  const handleInputChange = (formType, field, value) => {
    if (formType === "organization") {
      setOrganizationData((prev) => ({ ...prev, [field]: value }));
      validateField("organization", field, value);
      // Clear submit error on any change
      setOrganizationErrors((prev) => {
        if (prev && prev.submit) {
          const { submit, ...rest } = prev;
          return rest;
        }
        return prev;
      });
    } else {
      setIndividualData((prev) => ({ ...prev, [field]: value }));
      validateField("individual", field, value);
      // Clear submit error on any change
      setIndividualErrors((prev) => {
        if (prev && prev.submit) {
          const { submit, ...rest } = prev;
          return rest;
        }
        return prev;
      });
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    let newErrors = {};
    let payload = {};

    if (selectedType === "individual") {
      const { firstName, lastName, email } = individualData;

      if (!firstName.trim()) newErrors.firstName = "First name is required";

      if (!email) newErrors.email = "Email is required";
      else if (!validateEmail(email))
        newErrors.email = "Please enter a valid email";

      if (Object.keys(newErrors).length > 0) {
        setIndividualErrors(newErrors);
        return;
      }

      payload = {
        email,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        // ✅ Auto-detect browser timezone — sent silently, no UI change
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
      };
    }

    if (selectedType === "organization") {
      const { organizationName, firstName, lastName, email } = organizationData;

      if (!organizationName.trim())
        newErrors.organizationName = "Organization name is required";
      else if (organizationName.trim().length < 2)
        newErrors.organizationName = "At least 2 characters";
      else if (organizationName.trim().length > 100)
        newErrors.organizationName = "Max 100 characters";

      if (!firstName.trim()) newErrors.firstName = "First name is required";

      if (!email) newErrors.email = "Email is required";
      else if (!validateEmail(email))
        newErrors.email = "Please enter a valid email";

      if (Object.keys(newErrors).length > 0) {
        setOrganizationErrors(newErrors);
        return;
      }

      payload = {
        organizationName: organizationName.trim(),
        numberOfEmployees: organizationData.numberOfEmployees
          ? parseInt(organizationData.numberOfEmployees)
          : undefined,
        email,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        isPrimaryAdmin: selectedType === "organization" ? true : false,
        // ✅ Auto-detect browser timezone — sent silently, no UI change
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
      };
    }

    setIsLoading(true);
    try {
      const endpoint =
        selectedType === "individual"
          ? "/api/auth/register/individual"
          : "/api/auth/register/organization";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        if (result.resent) {
          toast({
            title: "Verification Email Resent",
            description:
              result.message || "We've re-sent your verification link.",
            variant: "default",
            className: "bg-green-50 border-green-200 text-green-800",
          });
          setLocation("/login");
          return;
        }

        if (result.autoAuthenticated && result.token) {
          localStorage.setItem("token", result.token);
          toast({
            title:
              selectedType === "organization"
                ? "Organization created successfully"
                : "Registration successful",
            description:
              result.message ||
              "Welcome to TaskSetu! Auto-authenticated for testing.",
          });
          setLocation("/dashboard");
        } else {
          const email =
            selectedType === "individual"
              ? individualData.email
              : organizationData.email;

          localStorage.setItem("verificationEmail", email);
          localStorage.setItem("registrationEmail", email);
          localStorage.setItem("registrationType", selectedType);

          setLocation(
            `/registration-success?email=${encodeURIComponent(
              email,
            )}&type=${selectedType}`,
          );
        }
      } else {
        const errorMsg = result.message || "Registration failed";
        selectedType === "individual"
          ? setIndividualErrors({ submit: errorMsg })
          : setOrganizationErrors({ submit: errorMsg });
      }
    } catch (error) {
      const errorMsg = "Network error. Please try again.";
      selectedType === "individual"
        ? setIndividualErrors({ submit: errorMsg })
        : setOrganizationErrors({ submit: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

  // Only consider field-level errors, ignore 'submit' so button isn't locked after server error
  const hasOrganizationErrors = Object.entries(organizationErrors).some(
    ([k, v]) => k !== "submit" && v,
  );
  const hasIndividualErrors = Object.entries(individualErrors).some(
    ([k, v]) => k !== "submit" && v,
  );

  // Require all mandatory fields and a valid email before enabling the button
  const isIndividualComplete =
    Boolean(individualData.firstName.trim()) &&
    Boolean(individualData.email.trim()) &&
    validateEmail(individualData.email);

  const isOrganizationComplete =
    Boolean(organizationData.organizationName.trim()) &&
    Boolean(organizationData.firstName.trim()) &&
    Boolean(organizationData.email.trim()) &&
    validateEmail(organizationData.email);

  useEffect(() => {
    console.log("error", individualErrors, organizationErrors, selectedType);
    handleReset();
  }, [selectedType]);

  const renderAuthBackground = () => (
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
  );

  const renderAuthShowcase = () => (
    <div className="hidden lg:block p-2">
      <div className="flex items-start justify-between gap-6">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-5 w-5 rounded bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
              TS
            </div>
            <span className="text-[15px] font-semibold text-gray-800">
              TaskSetu
            </span>
          </div>

          <h2 className="text-[40px] font-bold text-gray-900 leading-[1.1] tracking-[-0.8px]">
            Simple. Lightweight.
            <br />
            <span className="text-blue-600">Task Management</span> That Just
            Works.
          </h2>
          <p className="mt-4 text-gray-600 leading-8 max-w-2xl text-[21px]">
            TaskSetu helps individuals and teams stay organized, follow through,
            and get things done - without the clutter.
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
            Onboard your organization and collaborate with selected members.
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
  );
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-8 md:px-8 bg-[#f7f9fc] overflow-hidden">
      {renderAuthBackground()}

      <div className="relative z-10 w-full max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8 items-start">
          <div className="bg-white border border-gray-200 rounded-sm p-6 shadow-lg self-start mt-8 lg:mt-14">
            {!selectedType ? (
              <div
                className={`transition-all duration-300 ease-in-out ${isTransitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}
              >
                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-b from-blue-500 to-blue-700 rounded-sm flex items-center justify-center mx-auto mb-3 shadow">
                    <span className="text-white font-bold text-xl">TS</span>
                  </div>
                  <h2 className="text-[28px] leading-none font-bold text-gray-900">
                    Create Your Account
                  </h2>
                  <p className="text-gray-600 text-sm mt-2">
                    Choose how you want to use TaskSetu
                  </p>
                </div>

                <div className="space-y-4">
                  <button
                    onClick={() => handleTypeSelection("individual")}
                    className="w-full text-left p-4 rounded-sm border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all duration-200 group bg-white"
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-2.5 bg-blue-50 rounded-sm">
                        <User className="h-5 w-5 text-blue-500" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          Individual User
                        </h3>
                        <p className="text-sm text-gray-600">
                          Simple task tracking for personal productivity.
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-blue-500 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>

                  <button
                    onClick={() => handleTypeSelection("organization")}
                    className="w-full text-left p-4 rounded-sm border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all duration-200 group bg-white"
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-2.5 bg-indigo-50 rounded-sm">
                        <Building2 className="h-5 w-5 text-indigo-500" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          Organization
                        </h3>
                        <p className="text-sm text-gray-600">
                          Manage tasks across teams without complexity.
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-indigo-500 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                </div>

                <div className="mt-6 pt-5 border-t border-gray-100 text-center">
                  <p className="text-sm text-gray-600">
                    Already have an account?{" "}
                    <Link
                      href="/login"
                      className="text-blue-600 hover:text-blue-700 font-semibold"
                    >
                      Sign In
                    </Link>
                  </p>
                </div>
              </div>
            ) : selectedType === "individual" ? (
              <div className="w-full max-w-md mx-auto animate-in slide-in-from-right-5 duration-500 ease-in-out">
                <div className="mb-3">
                  <button
                    onClick={handleBackToChoice}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-3 transition-colors text-sm"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to options
                  </button>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-blue-100 rounded-sm">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        Individual Account
                      </h2>
                      <p className="text-gray-600 text-sm">
                        Create your personal TaskSetu account
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-sm border border-gray-200 p-3 sm:p-4 shadow-sm transition-all duration-500">
                  <form onSubmit={handleRegister} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={individualData.firstName}
                          onChange={(e) =>
                            handleInputChange(
                              "individual",
                              "firstName",
                              e.target.value,
                            )
                          }
                          className={`w-full h-9 px-3 text-sm border rounded-sm focus:outline-none focus:border-blue-500 transition-colors ${individualErrors.firstName ? "border-red-300" : "border-gray-300"}`}
                          placeholder="First name"
                        />
                        {individualErrors.firstName && (
                          <p className="text-red-500 text-xs mt-1">
                            {individualErrors.firstName}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={individualData.lastName}
                          onChange={(e) => {
                            setIndividualData((prev) => ({
                              ...prev,
                              lastName: e.target.value,
                            }));
                          }}
                          className={`w-full h-9 px-3 text-sm border rounded-sm focus:outline-none focus:border-blue-500 transition-colors ${individualErrors.lastName ? "border-red-300" : "border-gray-300"}`}
                          placeholder="Last name"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={individualData.email}
                        onChange={(e) =>
                          handleInputChange(
                            "individual",
                            "email",
                            e.target.value,
                          )
                        }
                        className={`w-full h-9 px-3 text-sm border rounded-sm focus:outline-none focus:border-blue-500 transition-colors ${individualErrors.email ? "border-red-300" : "border-gray-300"}`}
                        placeholder="Email address"
                      />
                      {individualErrors.email && (
                        <p className="text-red-500 text-xs mt-1">
                          {individualErrors.email}
                        </p>
                      )}
                    </div>

                    {individualErrors.submit && (
                      <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-sm text-sm flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        {individualErrors.submit}
                      </div>
                    )}

                    <div className="pt-2 ">
                      <Button
                        type="submit"
                        variant="primary"
                        className="w-full h-9 rounded-sm"
                        disabled={
                          isLoading ||
                          hasIndividualErrors ||
                          !isIndividualComplete
                        }
                      >
                        {isLoading ? "Creating account..." : "Create Account"}
                      </Button>
                    </div>
                  </form>

                  <div className="text-center pt-2">
                    <p className="text-gray-600 text-sm">
                      Already have an account?{" "}
                      <Link
                        href="/login"
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Sign In
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-md mx-auto animate-in slide-in-from-right-5 duration-500 ease-in-out">
                <div className="mb-3">
                  <button
                    onClick={handleBackToChoice}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-3 transition-colors text-sm"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to options
                  </button>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-indigo-100 rounded-sm">
                      <Building2 className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        Organization Account
                      </h2>
                      <p className="text-gray-600 text-sm">
                        Set up your company workspace
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-sm border border-gray-200 p-3 sm:p-4 shadow-sm transition-all duration-500">
                  <form onSubmit={handleRegister} className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Organization Name{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={organizationData.organizationName}
                        onChange={(e) =>
                          handleInputChange(
                            "organization",
                            "organizationName",
                            e.target.value,
                          )
                        }
                        className={`w-full h-9 px-3 text-sm border rounded-sm focus:outline-none focus:border-indigo-500 transition-colors ${organizationErrors.organizationName ? "border-red-300" : "border-gray-300"}`}
                        placeholder="Enter organization name"
                      />
                      {organizationErrors.organizationName && (
                        <p className="text-red-500 text-xs mt-1">
                          {organizationErrors.organizationName}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Number of Employees
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={organizationData.numberOfEmployees}
                        onChange={(e) => {
                          setOrganizationData((prev) => ({
                            ...prev,
                            numberOfEmployees: e.target.value,
                          }));
                        }}
                        className={`w-full h-9 px-3 text-sm border rounded-sm focus:outline-none focus:border-indigo-500 transition-colors ${organizationErrors.numberOfEmployees ? "border-red-300" : "border-gray-300"}`}
                        placeholder="Enter number of employees (optional)"
                      />
                      {organizationErrors.numberOfEmployees && (
                        <p className="text-red-500 text-xs mt-1">
                          {organizationErrors.numberOfEmployees}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={organizationData.firstName}
                          onChange={(e) =>
                            handleInputChange(
                              "organization",
                              "firstName",
                              e.target.value,
                            )
                          }
                          className={`w-full h-9 px-3 text-sm border rounded-sm focus:outline-none focus:border-indigo-500 transition-colors ${organizationErrors.firstName ? "border-red-300" : "border-gray-300"}`}
                          placeholder="Enter first name"
                        />
                        {organizationErrors.firstName && (
                          <p className="text-red-500 text-xs mt-1">
                            {organizationErrors.firstName}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={organizationData.lastName}
                          onChange={(e) => {
                            setOrganizationData((prev) => ({
                              ...prev,
                              lastName: e.target.value,
                            }));
                          }}
                          className={`w-full h-9 px-3 text-sm border rounded-sm focus:outline-none focus:border-indigo-500 transition-colors ${organizationErrors.lastName ? "border-red-300" : "border-gray-300"}`}
                          placeholder="Enter last name"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Admin Email Address{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={organizationData.email}
                        onChange={(e) =>
                          handleInputChange(
                            "organization",
                            "email",
                            e.target.value,
                          )
                        }
                        className={`w-full h-9 px-3 text-sm border rounded-sm focus:outline-none focus:border-indigo-500 transition-colors ${organizationErrors.email ? "border-red-300" : "border-gray-300"}`}
                        placeholder="Enter admin email address"
                      />
                      {organizationErrors.email && (
                        <p className="text-red-500 text-xs mt-1">
                          {organizationErrors.email}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        This will be the admin account for your organization
                      </p>
                    </div>

                    {organizationErrors.submit && (
                      <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-sm text-sm flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        {organizationErrors.submit}
                      </div>
                    )}

                    <div className="pt-1">
                      <Button
                        type="submit"
                        variant="primary"
                        className="w-full h-9 rounded-sm"
                        disabled={
                          isLoading ||
                          hasOrganizationErrors ||
                          !isOrganizationComplete
                        }
                      >
                        {isLoading
                          ? "Creating organization..."
                          : "Create Organization"}
                      </Button>
                    </div>
                  </form>

                  <div className="text-center pt-2">
                    <p className="text-gray-600 text-sm">
                      Already have an account?{" "}
                      <Link
                        href="/login"
                        className="text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        Sign In
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          {renderAuthShowcase()}
        </div>
      </div>
    </div>
  );
}
