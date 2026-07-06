import React, { useState, useContext, createContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import {
  UserCheck,
  Crown,
  Users,
  User,
  Shield,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import { useLocation } from "wouter";
// Create context for role switching
const RoleContext = createContext();

// Role Context Provider
export const RoleProvider = ({ children }) => {
  const [activeRole, setActiveRole] = useState(() => {
    // Initialize activeRole from localStorage
    return localStorage.getItem("activeRole") || null;
  });

  return (
    <RoleContext.Provider value={{ activeRole, setActiveRole }}>
      {children}
    </RoleContext.Provider>
  );
};

// Hook to use role context
export const useActiveRole = () => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useActiveRole must be used within a RoleProvider");
  }
  return context;
};

// Role icon mapping
const getRoleIcon = (role) => {
  if (!role) return User; // Default to User icon if role is undefined/null

  switch (role.toLowerCase()) {
    case "super_admin":
    case "superadmin":
      return Crown;
    case "org_admin":
    case "admin":
    case "company_admin":
      return Shield;
    case "manager":
      return Users;
    case "employee":
      return User;
    case "individual":
      return UserCheck;
    default:
      return User;
  }
};

// Role display name mapping
export const getRoleDisplayName = (role) => {
  if (!role) return "";

  // Handle array or object cases safely
  if (Array.isArray(role)) {
    role = role[0] || "";
  } else if (typeof role !== "string") {
    role = String(role || "");
  }

  const normalized = role.toLowerCase();

  switch (normalized) {
    case "super_admin":
    case "superadmin":
      return "Super Admin";
    case "org_admin":
    case "admin":
    case "company_admin":
      return "Organization Admin";
    case "manager":
      return "Manager";
    case "employee":
      return "Employee";
    case "individual":
      return "Individual User";
    default:
      return "";
    // return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
};

// Role Switcher Component
const RoleSwitcher = () => {
  const { data: user } = useQuery({
    queryKey: ["/api/auth/verify"],
    enabled: !!localStorage.getItem("token"),
  });
  const [location, navigate] = useLocation(); // navigate function from wouter
  const { activeRole, setActiveRole } = useActiveRole();
  const queryClient = useQueryClient();

  // Check if current page is a billing/upgrade/payment page where role switching should be disabled
  const isBillingPage =
    location.includes("/billing") ||
    location.includes("/upgrade") ||
    location.includes("/payment") ||
    location.includes("/subscription");

  // Get roles safely and ensure currentRole is always one of userRoles
  const userRoles = Array.isArray(user?.role) ? user.role : [];

  // Ensure initial selection prioritizes stored role, then falls back to highest privilege role
  const didInitRef = React.useRef(false);
  React.useEffect(() => {
    if (!userRoles.length) return;

    // Get stored role from localStorage
    const storedRole = localStorage.getItem("activeRole");

    if (!didInitRef.current) {
      // Priority: stored role if valid, otherwise use highest privilege role
      let initialRole;

      if (storedRole && userRoles.includes(storedRole)) {
        // Use stored role if it's still valid
        initialRole = storedRole;
        console.log("🔄 Restored role from localStorage:", storedRole);
      } else {
        // Fallback to highest privilege role (last in array is usually highest)
        // Order typically: employee, manager, org_admin, super_admin
        const roleOrder = [
          "employee",
          "individual",
          "manager",
          "org_admin",
          "super_admin",
        ];
        initialRole = userRoles.sort((a, b) => {
          const indexA = roleOrder.indexOf(a.toLowerCase());
          const indexB = roleOrder.indexOf(b.toLowerCase());
          return indexB - indexA; // Descending order - highest first
        })[0];
        console.log(
          "🔄 No valid stored role, using highest privilege:",
          initialRole
        );
      }

      setActiveRole(initialRole);
      localStorage.setItem("activeRole", initialRole);
      didInitRef.current = true;
      return;
    }

    // If current stored role is no longer valid, fall back to highest privilege role
    if (activeRole && !userRoles.includes(activeRole)) {
      const roleOrder = [
        "employee",
        "individual",
        "manager",
        "org_admin",
        "super_admin",
      ];
      const fallbackRole = userRoles.sort((a, b) => {
        const indexA = roleOrder.indexOf(a.toLowerCase());
        const indexB = roleOrder.indexOf(b.toLowerCase());
        return indexB - indexA;
      })[0];
      console.log("⚠️ Current role invalid, falling back to:", fallbackRole);
      setActiveRole(fallbackRole);
      localStorage.setItem("activeRole", fallbackRole);
    }
  }, [userRoles, activeRole, setActiveRole]);

  // Derive currentRole from stored role if valid, otherwise use highest privilege
  const currentRole =
    activeRole && userRoles.includes(activeRole)
      ? activeRole
      : userRoles.sort((a, b) => {
        const roleOrder = [
          "employee",
          "individual",
          "manager",
          "org_admin",
          "super_admin",
        ];
        const indexA = roleOrder.indexOf(a.toLowerCase());
        const indexB = roleOrder.indexOf(b.toLowerCase());
        return indexB - indexA;
      })[0];

  // Show switcher for development - remove the multiple roles check temporarily
  if (!user || isBillingPage || !currentRole) {
    return null;
  }

  const handleRoleSwitch = (newRole) => {
    // Prevent role switching on billing/payment pages for security
    if (
      location.includes("/billing") ||
      location.includes("/upgrade") ||
      location.includes("/payment") ||
      location.includes("/subscription")
    ) {
      console.warn("Role switching disabled on billing/payment pages");
      return;
    }

    // Ignore switching to a role not available to the user
    if (!userRoles.includes(newRole)) {
      console.warn("Selected role not available for this user");
      const fallback = userRoles[0];
      setActiveRole(fallback);
      localStorage.setItem("activeRole", fallback);
      return;
    }

    setActiveRole(newRole);
    localStorage.setItem("activeRole", newRole);

    queryClient.setQueryData(["/api/auth/verify"], (oldData) => ({
      ...oldData,
      activeRole: newRole,
    }));
    // window.location.reload();
  };

  const CurrentRoleIcon = getRoleIcon(currentRole);

  return (
    <div className="flex items-center bg-white">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 sm:h-9 px-2 sm:px-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 flex items-center gap-1 sm:gap-2"
            title="Switch User Role">
            <CurrentRoleIcon className="h-4 w-4 flex-shrink-0" />
            <span className="text-xs sm:text-sm truncate max-w-[80px] sm:max-w-none" title={getRoleDisplayName(currentRole)}>
              {getRoleDisplayName(currentRole)}
            </span>
            <ChevronDown className="h-3 w-3 flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-48 sm:w-56 bg-white z-50 min-w-[12rem] sm:min-w-[14rem] !rounded-sm"
          sideOffset={5}
          alignOffset={-5}>
          <div className="px-3 py-2 text-xs bg-white font-medium text-gray-500 border-b">
            Switch Role
          </div>

          {userRoles.map((role) => {
            if (!role) return null;

            const RoleIcon = getRoleIcon(role);
            const isActive =
              (role || "").toLowerCase() === (currentRole || "").toLowerCase();

            return (
              <DropdownMenuItem
                key={role}
                onClick={() => handleRoleSwitch(role)}
                className={`cursor-pointer py-2 px-3 ${isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                  }`}>
                <RoleIcon className="h-4 w-4 mr-2 sm:mr-3 flex-shrink-0" />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-medium text-sm truncate" title={getRoleDisplayName(role)}>
                    {getRoleDisplayName(role)}
                  </span>
                  {isActive && (
                    <span className="text-xs text-blue-600">
                      Currently Active
                    </span>
                  )}
                </div>
                {isActive && (
                  <div className="ml-auto flex-shrink-0">
                    <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                  </div>
                )}
              </DropdownMenuItem>
            );
          })}

          <div className="border-t pt-2 mt-2">
            <DropdownMenuItem
              onClick={() => window.location.reload()}
              className="cursor-pointer text-gray-600 hover:bg-gray-100">
              <RotateCcw className="h-4 w-4 mr-3" />
              <span className="text-sm">Refresh Page</span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default RoleSwitcher;
