import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Mail, CheckCircle, ArrowLeft } from "lucide-react";

export default function RegistrationSuccess() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [registrationType, setRegistrationType] = useState("individual");

  useEffect(() => {
    // Get email and type from URL params or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get("email");
    const typeParam = urlParams.get("type");

    if (emailParam) {
      setEmail(emailParam);
      localStorage.setItem("registrationEmail", emailParam);
    } else {
      const storedEmail = localStorage.getItem("registrationEmail");
      if (storedEmail) {
        setEmail(storedEmail);
      } else {
        // No email found, redirect to registration
        setLocation("/register");
        return;
      }
    }

    if (typeParam) {
      setRegistrationType(typeParam);
      localStorage.setItem("registrationType", typeParam);
    } else {
      const storedType = localStorage.getItem("registrationType");
      if (storedType) {
        setRegistrationType(storedType);
      }
    }
  }, [setLocation]);

  const getTitle = () => {
    return registrationType === "organization"
      ? "Organization Registration Initiated"
      : "Account Registration Initiated";
  };

  const getDescription = () => {
    return registrationType === "organization"
      ? "Your organization workspace setup is almost complete"
      : "Your individual account setup is almost complete";
  };

  return (
    <div className="registration-success-square-ui h-screen bg-gray-50">
      <style>{`
        .registration-success-square-ui * {
          border-radius: 0 !important;
        }
      `}</style>
      <div className="h-full w-full flex items-center justify-center p-4">
        <div className="w-full max-w-md aspect-square bg-white rounded-none shadow-lg border border-gray-200">
          <div className=" p-4 flex flex-col justify-center">
            {/* Header Section */}
            <div className="text-center mb-3">
              <div className="w-12 h-12 bg-green-100 rounded-none flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">{getTitle()}</h2>
              <p className="text-xs text-gray-600 mt-1">{getDescription()}</p>
            </div>

            {/* Email Confirmation */}
            {email && (
              <div className="bg-blue-50 border border-blue-200 rounded-none p-2 mb-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <p className="text-xs text-blue-800">
                    <span className="font-medium">Email sent to:</span> {email}
                  </p>
                </div>
              </div>
            )}

            {/* Next Steps */}
            <div className="bg-green-50 border border-green-200 rounded-none p-3 mb-3">
              <div className="text-center">
                <h3 className="text-sm font-semibold text-green-800 mb-1">
                  Next Steps
                </h3>
                <p className="text-xs text-green-700 mb-2">
                  A verification link has been sent to your email. Please
                  complete your registration.
                </p>
                <div className="text-xs text-green-600 space-y-0.5">
                  <p>1. Check your email inbox</p>
                  <p>2. Click the verification link</p>
                  <p>3. Set your secure password</p>
                  <p>4. Start using TaskSetu</p>
                </div>
              </div>
            </div>

            {/* Help Section */}
            <div className="space-y-2">
              <div className="bg-gray-50 border border-gray-200 rounded-none p-2">
                <h4 className="text-xs font-medium text-gray-900 mb-1">
                  Didn't receive the email?
                </h4>
                <ul className="text-xs text-gray-600 space-y-0.5">
                  <li>• Check your spam/junk folder</li>
                  <li>• Make sure you entered the correct email</li>
                  <li>• The link expires in 24 hours</li>
                </ul>
              </div>

              {/* Actions */}
              <div className="text-center space-y-1">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium text-xs"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Go to Login
                </Link>

                <div className="text-xs text-gray-500">
                  <span>Need help? </span>
                  <a
                    href="mailto:support@tasksetu.com"
                    className="text-blue-600 hover:text-blue-700"
                  >
                    Contact Support
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
