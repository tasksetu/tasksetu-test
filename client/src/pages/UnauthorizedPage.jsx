import { useLocation } from "wouter";
import { usePermissions } from "@/features/shared/hooks/usePermissions";
import RBACService from "@/features/shared/services/rbacService";
import { AlertTriangle, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Clean Unauthorized Access Page
 * Shows when users try to access restricted routes
 */
export const UnauthorizedPage = ({
  title = "Access Denied",
  message = "You don't have permission to access this page.",
  showBackButton = true,
  showHomeButton = true,
}) => {
  const [, setLocation] = useLocation();
  const { role, user } = usePermissions();

  const handleGoHome = () => {
    const redirectPath = RBACService.getRedirectPath(role);
    setLocation(redirectPath);
  };

  const handleGoBack = () => {
    window.history.back();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-sm sm:px-10">
          {/* Icon */}
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-3">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>

          {/* Title */}
          <div className="text-center mb-3">
            <h2
              className="text-2xl font-bold text-gray-900 mb-2"
              data-testid="unauthorized-title"
            >
              {title}
            </h2>
            <p className="text-gray-600" data-testid="unauthorized-message">
              {message}
            </p>
          </div>

          {/* User Role Info */}
          {user && (
            <div className="bg-blue-50 border border-blue-200 rounded-sm p-4 mb-3">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-sm font-medium">
                      {user.firstName?.[0] || user.email?.[0] || "?"}
                    </span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-900">
                    {user.firstName && user.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user.email}
                  </p>
                  <p className="text-sm text-blue-700 capitalize">
                    Role: {role || "Unknown"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {showHomeButton && (
              <Button
                variant="primary"
                onClick={handleGoHome}
                className="w-full h-9 flex justify-center items-center"
                data-testid="button-go-home"
              >
                <Home className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Button>
            )}

            {showBackButton && (
              <Button
                variant="outline"
                onClick={handleGoBack}
                className="w-full h-9 flex justify-center items-center"
                data-testid="button-go-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            )}
          </div>

          {/* Help Text */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              If you believe this is an error, please contact your
              administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
