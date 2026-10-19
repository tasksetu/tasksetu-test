import React, { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  IndividualDashboard,
  OrganizationDashboard,
  SuperAdminDashboard,
  ManagerDashboard,
  EmployeeDashboard,
} from "../dashboard";
import { useActiveRole } from "../components/RoleSwitcher";
import { useAuth } from "@/features/shared/hooks/useAuth";

const Dashboard = () => {
  const { activeRole, setActiveRole } = useActiveRole();
  const { user, isLoading } = useAuth();

  // Normalize user roles
  const userRoles = useMemo(() => {
    if (!user?.role) return [];
    return Array.isArray(user.role) ? user.role : [user.role];
  }, [user?.role]);

  const userRolesLower = useMemo(() => {
    return userRoles.map((r) => String(r).toLowerCase());
  }, [userRoles]);

  // Priority order for resolving default role: super_admin > org_admin > manager > employee > individual
  const rolePriority = [
    "super_admin",
    "superadmin",
    "org_admin",
    "admin",
    "company_admin",
    "owner",
    "manager",
    "employee",
    "member",
    "individual",
  ];

  const sortedRoles = useMemo(() => {
    return [...userRoles].sort((a, b) => {
      const idxA = rolePriority.indexOf(String(a).toLowerCase());
      const idxB = rolePriority.indexOf(String(b).toLowerCase());
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });
  }, [userRoles]);

  const isValidActiveRole = useMemo(() => {
    if (!activeRole || userRolesLower.length === 0) return false;
    const activeLower = String(activeRole).toLowerCase();
    return userRolesLower.includes(activeLower);
  }, [activeRole, userRolesLower]);

  // Determine current effective role
  const currentRole = isValidActiveRole ? activeRole : (sortedRoles[0] || "individual");

  // Keep activeRole and localStorage in sync if activeRole was stale or mismatched
  useEffect(() => {
    if (user && userRoles.length > 0 && !isValidActiveRole) {
      console.log("🔄 Correcting stale activeRole:", { from: activeRole, to: currentRole });
      setActiveRole(currentRole);
      try {
        localStorage.setItem("activeRole", currentRole);
      } catch (e) {
        console.error("Failed to update activeRole in localStorage", e);
      }
    }
  }, [user, userRoles.length, isValidActiveRole, activeRole, currentRole, setActiveRole]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Debug logging
  console.log("🎯 Dashboard Router Debug:", {
    user: user?.email,
    userRoles: user?.role,
    activeRole,
    effectiveRole: currentRole,
  });

  const renderDashboard = () => {
    const userRole = currentRole?.toLowerCase();

    console.log("📊 Rendering dashboard for role:", userRole);

    switch (userRole) {
      case "superadmin":
      case "super_admin":
        console.log("✅ Rendering SuperAdminDashboard");
        return <SuperAdminDashboard />;

      case "admin":
      case "org_admin":
      case "company_admin":
      case "owner":
        console.log("✅ Rendering OrganizationDashboard");
        return <OrganizationDashboard />;

      case "manager":
        console.log("✅ Rendering ManagerDashboard");
        return <ManagerDashboard />;

      case "member":
      case "employee":
        console.log("✅ Rendering EmployeeDashboard");
        return <EmployeeDashboard />;

      case "individual":
      default:
        console.log("✅ Rendering IndividualDashboard");
        return <IndividualDashboard forcedRole="individual" />;
    }
  };

  return <div data-testid="dashboard-container">{renderDashboard()}</div>;
};

export default Dashboard;

