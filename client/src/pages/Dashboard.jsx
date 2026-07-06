import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { IndividualDashboard, OrganizationDashboard, SuperAdminDashboard, ManagerDashboard } from '../dashboard';
import { useActiveRole } from '../components/RoleSwitcher';
import { useAuth } from '@/features/shared/hooks/useAuth';

/**
 * Dynamic Dashboard Router - Renders appropriate dashboard based on user role
 * This component automatically detects user role and shows the correct dashboard
 * Note: Authentication is handled by AdminLayout, so this component assumes user is already authenticated
 */
const Dashboard = () => {
  // Get active role from context (for role switching)
  const { activeRole } = useActiveRole();

  // Get current user data using useAuth hook to ensure fresh data after profile updates
  const { user, isLoading } = useAuth();

  // Show loading state while fetching user data
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
  console.log('🎯 Dashboard Router Debug:', {
    user: user?.email,
    userRoles: user?.role,
    activeRole,
    selectedRole: activeRole || user?.role?.[0]
  });

  // Route to appropriate dashboard based on user role
  const renderDashboard = () => {
    // Use activeRole from context (for role switching), fallback to first role
    const currentRole = activeRole || user?.role?.[0];
    const userRole = currentRole?.toLowerCase();

    console.log('📊 Rendering dashboard for role:', userRole);

    switch (userRole) {
      case 'superadmin':
      case 'super_admin':
        console.log('✅ Rendering SuperAdminDashboard');
        return <SuperAdminDashboard />;

      case 'admin':
      case 'org_admin':
      case 'company_admin':
      case 'owner':
        console.log('✅ Rendering OrganizationDashboard');
        return <OrganizationDashboard />;

      case 'manager':
        console.log('✅ Rendering ManagerDashboard');
        return <ManagerDashboard />;

      case 'member':
      case 'employee':
      case 'individual':
      default:
        console.log('✅ Rendering IndividualDashboard');
        return <IndividualDashboard />;
    }
  };

  return (
    <div data-testid="dashboard-container">
      {renderDashboard()}
    </div>
  );
};

export default Dashboard;