import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  IndividualDashboard,
  OrganizationDashboard,
  SuperAdminDashboard,
  ManagerDashboard,
} from "../dashboard";
import { useActiveRole } from "../components/RoleSwitcher";
import { useAuth } from "@/features/shared/hooks/useAuth";

const Dashboard = () => {
  const { activeRole } = useActiveRole();
  const { user, isLoading } = useAuth();
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
    selectedRole: activeRole || user?.role?.[0],
  });

  const renderDashboard = () => {
    const currentRole = activeRole || user?.role?.[0];
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
      case "individual":
      default:
        console.log("✅ Rendering IndividualDashboard");
        return <IndividualDashboard />;
    }
  };

  return <div data-testid="dashboard-container">{renderDashboard()}</div>;
};

export default Dashboard;
