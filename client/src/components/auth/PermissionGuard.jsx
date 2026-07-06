import { usePermissions } from "@/features/shared/hooks/usePermissions";

/**
 * Permission-based component guard
 * Shows/hides components based on user permissions
 */
export const PermissionGuard = ({
  permission,
  route,
  roleLevel,
  fallback = null,
  children,
}) => {
  const { hasPermission, canAccessRoute, hasRoleLevel } = usePermissions();

  let hasAccess = true;

  // Check specific permission
  if (permission) {
    hasAccess = hasPermission(permission);
  }

  // Check route access
  if (route && hasAccess) {
    hasAccess = canAccessRoute(route);
  }

  // Check role level
  if (roleLevel && hasAccess) {
    hasAccess = hasRoleLevel(roleLevel);
  }

  return hasAccess ? children : fallback;
};

/**
 * Field-level permission guard for forms
 * Controls visibility and disabled state of form fields
 */
export const FieldGuard = ({
  permission,
  roleLevel,
  hideOnNoAccess = false,
  disableOnNoAccess = true,
  children,
}) => {
  const { hasPermission, hasRoleLevel } = usePermissions();

  let hasAccess = true;

  if (permission) {
    hasAccess = hasPermission(permission);
  }

  if (roleLevel && hasAccess) {
    hasAccess = hasRoleLevel(roleLevel);
  }

  // Hide field if no access and hideOnNoAccess is true
  if (!hasAccess && hideOnNoAccess) {
    return null;
  }

  // Return children with disabled prop if disableOnNoAccess is true
  if (!hasAccess && disableOnNoAccess && children) {
    if (typeof children === "function") {
      return children({ disabled: true });
    }

    // Clone children and add disabled prop
    return React.cloneElement(children, {
      disabled: true,
      className:
        `${children.props.className || ""} opacity-50 cursor-not-allowed`.trim(),
    });
  }

  return children;
};

/**
 * Route-level permission guard
 * Redirects users who don't have access to a route
 */
export const RouteGuard = ({ route, children, fallback }) => {
  const { canAccessRoute, role } = usePermissions();
  const hasAccess = canAccessRoute(route);

  if (!hasAccess) {
    if (fallback) {
      return fallback;
    }

    // Default unauthorized page
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center max-w-md mx-auto p-7 bg-white rounded-md shadow-lg">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 mb-3">
            You don't have permission to access this page.
          </p>
          <button
            onClick={() => window.history.back()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-sm font-medium transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return children;
};

export default PermissionGuard;
