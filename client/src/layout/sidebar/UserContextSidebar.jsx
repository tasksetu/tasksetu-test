import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Sidebar } from './index';

/**
 * User Context-Aware Sidebar that automatically adapts to the authenticated user's role
 * This component fetches user data from the authentication API and renders the appropriate sidebar
 */
const UserContextSidebar = ({
  className = '',
  defaultCollapsed = false,
  showToggle = true,
  onLogout
}) => {
  // Get current user data from authentication endpoint
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/verify"],
    enabled: !!localStorage.getItem("token"),
    retry: 1,
  });

  // Default logout handler if none provided
  const handleLogout = onLogout || (() => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  });

  // Show loading state
  if (isLoading) {
    return (
      <div className={`w-64 bg-white border-r border-gray-200 ${className}`}>
        <div className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            <div className="h-4 bg-gray-300 rounded w-1/2"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded"></div>
              <div className="h-3 bg-gray-200 rounded w-5/6"></div>
              <div className="h-3 bg-gray-200 rounded w-4/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !user) {
    return (
      <div className={`w-64 bg-white border-r border-gray-200 ${className}`}>
        <div className="p-4">
          <div className="text-center text-gray-500">
            <p className="text-sm">Authentication required</p>
            <Button
              variant="ghost"
              onClick={() => window.location.href = "/login"}
              className="mt-2 text-blue-600 hover:text-blue-800 text-sm h-9"
            >
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Render dynamic sidebar based on user role
  return (
    <Sidebar
      role={user.role}
      onLogout={handleLogout}
      className={className}
      defaultCollapsed={defaultCollapsed}
      showToggle={showToggle}
    />
  );
};

export default UserContextSidebar;