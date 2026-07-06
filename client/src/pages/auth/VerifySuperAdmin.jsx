import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Shield, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function VerifySuperAdmin() {
  const [, setLocation] = useLocation();
  const [verificationStatus, setVerificationStatus] = useState("loading"); // loading, success, error
  const [message, setMessage] = useState("");
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    const verifyToken = async () => {
      try {
        // Get token from URL parameters
        const params = new URLSearchParams(window.location.search);
        const token = params.get("token");

        if (!token) {
          setVerificationStatus("error");
          setMessage("Verification token is missing");
          return;
        }

        // Send verification request to backend
        const response = await fetch("/api/auth/verify-super-admin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setVerificationStatus("success");
          setMessage(
            data.message ||
              "Super admin account verified and activated successfully!",
          );
          setUserInfo(data.user);

          // Redirect to login after 3 seconds
          setTimeout(() => {
            setLocation("/super-admin/login");
          }, 3000);
        } else {
          setVerificationStatus("error");
          setMessage(data.message || "Verification failed. Please try again.");
        }
      } catch (error) {
        console.error("Verification error:", error);
        setVerificationStatus("error");
        setMessage("An error occurred during verification. Please try again.");
      }
    };

    verifyToken();
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-2">
        <CardHeader className="text-center pb-8">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-red-600 to-red-800 rounded-full flex items-center justify-center mb-3">
            {verificationStatus === "loading" && (
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            )}
            {verificationStatus === "success" && (
              <CheckCircle2 className="h-8 w-8 text-white" />
            )}
            {verificationStatus === "error" && (
              <XCircle className="h-8 w-8 text-white" />
            )}
          </div>
          <CardTitle className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <Shield className="h-7 w-7 text-red-600" />
            Super Admin Verification
          </CardTitle>
          <CardDescription className="text-base mt-2">
            {verificationStatus === "loading" &&
              "Verifying your super admin account..."}
            {verificationStatus === "success" &&
              "Account activated successfully!"}
            {verificationStatus === "error" && "Verification failed"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {verificationStatus === "loading" && (
            <div className="text-center py-8">
              <div className="inline-block">
                <Loader2 className="h-12 w-12 text-red-600 animate-spin" />
              </div>
              <p className="mt-4 text-gray-600">
                Please wait while we verify your account...
              </p>
            </div>
          )}

          {verificationStatus === "success" && (
            <div className="space-y-3">
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <AlertDescription className="text-green-800 ml-2">
                  {message}
                </AlertDescription>
              </Alert>

              {userInfo && (
                <div className="bg-gray-50 rounded-sm p-4 space-y-2">
                  <h3 className="font-semibold text-gray-900">
                    Account Details:
                  </h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>
                      <strong>Name:</strong> {userInfo.firstName}{" "}
                      {userInfo.lastName}
                    </p>
                    <p>
                      <strong>Email:</strong> {userInfo.email}
                    </p>
                    <p>
                      <strong>Role:</strong>{" "}
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
                        SUPER ADMIN
                      </span>
                    </p>
                    <p>
                      <strong>Status:</strong>{" "}
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                        ACTIVE
                      </span>
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-sm p-4">
                <p className="text-sm text-blue-800">
                  <strong>🎉 Welcome to TaskSetu!</strong>
                  <br />
                  You now have full platform access. Redirecting to login page
                  in 3 seconds...
                </p>
              </div>

              <Button
                onClick={() => setLocation("/super-admin/login")}
                className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
              >
                Go to Login Now
              </Button>
            </div>
          )}

          {verificationStatus === "error" && (
            <div className="space-y-3">
              <Alert className="bg-red-50 border-red-200">
                <XCircle className="h-5 w-5 text-red-600" />
                <AlertDescription className="text-red-800 ml-2">
                  {message}
                </AlertDescription>
              </Alert>

              <div className="bg-yellow-50 border border-yellow-200 rounded-sm p-4">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Possible reasons:</strong>
                  <br />
                  • The verification link has expired (24-hour limit)
                  <br />
                  • The link has already been used
                  <br />
                  • Invalid or malformed token
                  <br />• The account may have been deleted
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => setLocation("/super-admin/login")}
                  className="w-full"
                  variant="outline"
                >
                  Go to Login
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  className="w-full"
                  variant="secondary"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
