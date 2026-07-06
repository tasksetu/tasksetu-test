import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Building, User } from "lucide-react";
import SimpleEmailInput from "@/components/ui/SimpleEmailInput";
import { useShowToast } from "@/utils/ToastMessage";

export default function RegisterPage() {
  const [registrationType, setRegistrationType] = useState("individual"); // 'individual' or 'organization'
  const [formKey, setFormKey] = useState(Date.now()); // Force remount on form switch
  const { showSuccessToast, showErrorToast } = useShowToast();

  // Individual form state
  const [individualForm, setIndividualForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });

  // Organization form state
  const [organizationForm, setOrganizationForm] = useState({
    organizationName: "",
    firstName: "",
    lastName: "",
    adminEmail: "",
  });

  // Separate submission states
  const [individualSubmitting, setIndividualSubmitting] = useState(false);
  const [organizationSubmitting, setOrganizationSubmitting] = useState(false);

  // Separate error states
  const [individualErrors, setIndividualErrors] = useState({});
  const [organizationErrors, setOrganizationErrors] = useState({});

  const handleIndividualSubmit = async (e) => {
    e.preventDefault();

    // Clear previous errors
    setIndividualErrors({});

    // Validate form
    const errors = {};
    if (!individualForm.firstName.trim()) {
      errors.firstName = "First name is required";
    }
    if (!individualForm.lastName.trim()) {
      errors.lastName = "Last name is required";
    }
    if (!individualForm.email.trim()) {
      errors.email = "Email is required";
    }

    if (Object.keys(errors).length > 0) {
      setIndividualErrors(errors);
      return;
    }

    setIndividualSubmitting(true);
    try {
      console.log("Individual registration:", individualForm);
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      showSuccessToast("Account created");
    } catch (error) {
      showErrorToast("Registration failed. Please try again.");
    } finally {
      setIndividualSubmitting(false);
    }
  };

  const handleOrganizationSubmit = async (e) => {
    e.preventDefault();

    // Clear previous errors
    setOrganizationErrors({});

    // Validate form
    const errors = {};
    if (!organizationForm.organizationName.trim()) {
      errors.organizationName = "Organization name is required";
    }
    if (!organizationForm.firstName.trim()) {
      errors.firstName = "First name is required";
    }
    if (!organizationForm.lastName.trim()) {
      errors.lastName = "Last name is required";
    }
    if (!organizationForm.adminEmail.trim()) {
      errors.adminEmail = "Admin email is required";
    }

    if (Object.keys(errors).length > 0) {
      setOrganizationErrors(errors);
      return;
    }

    setOrganizationSubmitting(true);
    try {
      console.log("Organization registration:", organizationForm);
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      showSuccessToast("Organization created");
    } catch (error) {
      showErrorToast("Registration failed. Please try again.");
    } finally {
      setOrganizationSubmitting(false);
    }
  };

  const resetForms = () => {
    // Reset form data
    setIndividualForm({ firstName: "", lastName: "", email: "" });
    setOrganizationForm({
      organizationName: "",
      firstName: "",
      lastName: "",
      adminEmail: "",
    });

    // Reset error states
    setIndividualErrors({});
    setOrganizationErrors({});

    // Reset submission states
    setIndividualSubmitting(false);
    setOrganizationSubmitting(false);

    // Force complete remount
    setFormKey(Date.now());

    // Clear any email validation timeouts
    if (window.emailValidationTimeout) {
      clearTimeout(window.emailValidationTimeout);
    }
  };

  const switchToIndividual = () => {
    resetForms();
    setRegistrationType("individual");
  };

  const switchToOrganization = () => {
    resetForms();
    setRegistrationType("organization");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Side - Welcome/Info */}
      <div className="flex-1 bg-blue-600 text-white p-7 flex flex-col justify-center">
        <div className="max-w-md">
          <h1 className="text-4xl font-bold mb-3">Welcome to TaskSetu</h1>
          <p className="text-blue-100 mb-8">
            Join thousands of professionals managing their tasks efficiently
          </p>

          {registrationType === "individual" ? (
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-blue-500 rounded-sm">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">
                    Personal Task Management
                  </h3>
                  <p className="text-sm text-blue-100">
                    Organize your personal tasks and collaborate when needed
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="p-2 bg-blue-500 rounded-sm">
                  <Building className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Team Collaboration</h3>
                  <p className="text-sm text-blue-100">
                    Join organization workspaces and collaborate seamlessly
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-blue-500 rounded-sm">
                  <Building className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">
                    Enterprise Task Management
                  </h3>
                  <p className="text-sm text-blue-100">
                    Complete project and task management for your entire
                    organization
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="p-2 bg-blue-500 rounded-sm">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Team Management</h3>
                  <p className="text-sm text-blue-100">
                    Invite team members, assign roles, and manage permissions
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Registration Form */}
      <div className="flex-1 p-7 flex items-center justify-center">
        <div className="w-full max-w-md">
          {/* Back to options button */}
          <button
            onClick={() => setRegistrationType(null)}
            className="flex items-center text-gray-600 hover:text-gray-800 mb-3"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to options
          </button>

          {registrationType === "individual" ? (
            <Card key={`individual-form-${formKey}`}>
              <CardHeader className="text-center">
                <div className="flex items-center justify-center mb-3">
                  <div className="p-3 bg-blue-100 rounded-sm">
                    <User className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
                <CardTitle>Individual Account</CardTitle>
                <CardDescription>
                  Create your personal TaskSetu account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleIndividualSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="individual-first-name">
                        First Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        key={`individual-fname-${formKey}`}
                        id="individual-first-name"
                        value={individualForm.firstName}
                        onChange={(e) =>
                          setIndividualForm((prev) => ({
                            ...prev,
                            firstName: e.target.value,
                          }))
                        }
                        className={
                          individualErrors.firstName ? "border-red-500" : ""
                        }
                        required
                      />
                      {individualErrors.firstName && (
                        <p className="text-sm text-red-600">
                          {individualErrors.firstName}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="individual-last-name">Last Name</Label>
                      <Input
                        key={`individual-lname-${formKey}`}
                        id="individual-last-name"
                        value={individualForm.lastName}
                        onChange={(e) =>
                          setIndividualForm((prev) => ({
                            ...prev,
                            lastName: e.target.value,
                          }))
                        }
                        className={
                          individualErrors.lastName ? "border-red-500" : ""
                        }
                        required
                      />
                      {individualErrors.lastName && (
                        <p className="text-sm text-red-600">
                          {individualErrors.lastName}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="individual-email">
                      Email Address <span className="text-red-500">*</span>
                    </Label>
                    <SimpleEmailInput
                      key={`individual-email-${formKey}`}
                      id="individual-email"
                      placeholder="Email address"
                      value={individualForm.email}
                      onChange={(email) =>
                        setIndividualForm((prev) => ({ ...prev, email }))
                      }
                      className={individualErrors.email ? "border-red-500" : ""}
                      required
                    />
                    {individualErrors.email && (
                      <p className="text-sm text-red-600">
                        {individualErrors.email}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    disabled={individualSubmitting}
                  >
                    {individualSubmitting
                      ? "Creating Account..."
                      : "Create Account"}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-600">
                    Already have an account?{" "}
                    <a
                      href="/login"
                      className="text-blue-600 hover:text-blue-700"
                    >
                      Sign In
                    </a>
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : registrationType === "organization" ? (
            <Card key={`organization-form-${formKey}`}>
              <CardHeader className="text-center">
                <div className="flex items-center justify-center mb-3">
                  <div className="p-3 bg-blue-100 rounded-sm">
                    <Building className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
                <CardTitle>Organization Account</CardTitle>
                <CardDescription>Set up your company workspace</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleOrganizationSubmit} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="organization-name">Organization Name</Label>
                    <Input
                      key={`org-name-${formKey}`}
                      id="organization-name"
                      placeholder="Enter organization name"
                      value={organizationForm.organizationName}
                      onChange={(e) =>
                        setOrganizationForm((prev) => ({
                          ...prev,
                          organizationName: e.target.value,
                        }))
                      }
                      className={
                        organizationErrors.organizationName
                          ? "border-red-500"
                          : ""
                      }
                      required
                    />
                    {organizationErrors.organizationName && (
                      <p className="text-sm text-red-600">
                        {organizationErrors.organizationName}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="organization-first-name">
                        First Name
                      </Label>
                      <Input
                        key={`org-fname-${formKey}`}
                        id="organization-first-name"
                        value={organizationForm.firstName}
                        onChange={(e) =>
                          setOrganizationForm((prev) => ({
                            ...prev,
                            firstName: e.target.value,
                          }))
                        }
                        className={
                          organizationErrors.firstName ? "border-red-500" : ""
                        }
                        required
                      />
                      {organizationErrors.firstName && (
                        <p className="text-sm text-red-600">
                          {organizationErrors.firstName}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="organization-last-name">Last Name</Label>
                      <Input
                        key={`org-lname-${formKey}`}
                        id="organization-last-name"
                        value={organizationForm.lastName}
                        onChange={(e) =>
                          setOrganizationForm((prev) => ({
                            ...prev,
                            lastName: e.target.value,
                          }))
                        }
                        className={
                          organizationErrors.lastName ? "border-red-500" : ""
                        }
                        required
                      />
                      {organizationErrors.lastName && (
                        <p className="text-sm text-red-600">
                          {organizationErrors.lastName}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="organization-admin-email">
                      Admin Email Address
                    </Label>
                    <SimpleEmailInput
                      key={`organization-email-${formKey}`}
                      id="organization-admin-email"
                      placeholder="Enter admin email address"
                      value={organizationForm.adminEmail}
                      onChange={(email) =>
                        setOrganizationForm((prev) => ({
                          ...prev,
                          adminEmail: email,
                        }))
                      }
                      className={
                        organizationErrors.adminEmail ? "border-red-500" : ""
                      }
                      required
                    />
                    {organizationErrors.adminEmail && (
                      <p className="text-sm text-red-600">
                        {organizationErrors.adminEmail}
                      </p>
                    )}
                    <p className="text-sm text-gray-600">
                      This will be the admin account for your organization
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    disabled={organizationSubmitting}
                  >
                    {organizationSubmitting
                      ? "Creating Organization..."
                      : "Create Organization"}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-600">
                    Already have an account?{" "}
                    <a
                      href="/login"
                      className="text-blue-600 hover:text-blue-700"
                    >
                      Sign In
                    </a>
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Registration Type Selection */
            <div className="space-y-3">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Get Started
                </h2>
                <p className="text-gray-600">
                  Choose how you'd like to use TaskSetu
                </p>
              </div>

              <button
                onClick={switchToIndividual}
                className="w-full p-4 border-2 border-gray-200 rounded-sm hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="flex items-start space-x-3">
                  <div className="p-3 bg-blue-100 rounded-sm">
                    <User className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">
                      Individual Account
                    </h3>
                    <p className="text-sm text-gray-600">
                      Perfect for personal task management and joining existing
                      teams
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={switchToOrganization}
                className="w-full p-4 border-2 border-gray-200 rounded-sm hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="flex items-start space-x-3">
                  <div className="p-3 bg-blue-100 rounded-sm">
                    <Building className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">
                      Organization Account
                    </h3>
                    <p className="text-sm text-gray-600">
                      Set up your company workspace and manage teams
                    </p>
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
