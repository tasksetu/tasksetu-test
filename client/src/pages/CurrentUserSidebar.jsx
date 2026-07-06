import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { UserContextSidebar } from "../layout/sidebar";

/**
 * Page component to demonstrate the current user's role-based sidebar
 * This shows how the sidebar adapts to the authenticated user's role
 */
const CurrentUserSidebar = () => {
  // Get current user data
  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/auth/verify"],
    enabled: !!localStorage.getItem("token"),
  });

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading user data...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-3">Authentication required</p>
          <Button
            variant="primary"
            onClick={() => (window.location.href = "/login")}
            className="h-9"
          >
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* User's dynamic sidebar */}
      <UserContextSidebar onLogout={handleLogout} />

      {/* Main content */}
      <div className="flex-1 p-7">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-sm shadow-sm border p-4">
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Current User Sidebar Demo
            </h1>

            {/* User Information */}
            <div className="bg-blue-50 rounded-sm p-4 mb-3">
              <h2 className="text-lg font-semibold text-blue-900 mb-3">
                Authenticated User Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="font-medium text-blue-800">Name:</span>
                  <span className="ml-2 text-blue-700">
                    {user.firstName} {user.lastName}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-blue-800">Email:</span>
                  <span className="ml-2 text-blue-700">{user.email}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-800">Role:</span>
                  <span className="ml-2 text-blue-700 capitalize">
                    {user.role}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-blue-800">
                    Organization:
                  </span>
                  <span className="ml-2 text-blue-700">
                    {user.organization
                      ? user.organization.name
                      : "Individual User"}
                  </span>
                </div>
              </div>
            </div>

            {/* Role-Based Sidebar Explanation */}
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-3">
                  Dynamic Sidebar Features
                </h2>
                <p className="text-gray-600 mb-3">
                  The sidebar automatically adapts based on your authenticated
                  user role:
                </p>
              </div>

              {/* Role-specific information */}
              {user.role === "member" && (
                <div className="p-4 bg-green-50 rounded-sm border border-green-200">
                  <h3 className="font-semibold text-green-800 mb-2">
                    Member Role
                  </h3>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• Dashboard - My Dashboard</li>
                    <li>
                      • Tasks - My Tasks, Create Task, Quick Tasks, Calendar,
                      Milestones, Approvals
                    </li>
                    <li>• Reports - My Productivity, My Overdue Tasks</li>
                    <li>• Settings - Profile, Notifications</li>
                    <li>• Universal - Help & Support, Logout</li>
                  </ul>
                </div>
              )}

              {(user.role === "admin" || user.role === "org_admin") && (
                <div className="p-4 bg-blue-50 rounded-sm border border-blue-200">
                  <h3 className="font-semibold text-blue-800 mb-2">
                    Organization Admin Role
                  </h3>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>
                      • Dashboard - Team Dashboard, Organization Dashboard
                    </li>
                    <li>• Tasks - My Tasks, Team Tasks, All Company Tasks</li>
                    <li>• Management - Manage Users, Roles & Permissions</li>
                    <li>• Reports - Company Reports</li>
                    <li>• Settings - Company Settings</li>
                  </ul>
                </div>
              )}

              {(user.role === "superadmin" || user.role === "super_admin") && (
                <div className="p-4 bg-purple-50 rounded-sm border border-purple-200">
                  <h3 className="font-semibold text-purple-800 mb-2">
                    Super Admin Role
                  </h3>
                  <ul className="text-sm text-purple-700 space-y-1">
                    <li>• Platform Overview</li>
                    <li>• License Mapping</li>
                    <li>• System Configurations</li>
                    <li>• Global Notification Rules</li>
                    <li>• All Platform Users</li>
                    <li>• Analytics & Audit Logs</li>
                  </ul>
                </div>
              )}

              {user.role === "employee" && (
                <div className="p-4 bg-teal-50 rounded-sm border border-teal-200">
                  <h3 className="font-semibold text-teal-800 mb-2">
                    Employee Role
                  </h3>
                  <ul className="text-sm text-teal-700 space-y-1">
                    <li>• Similar to Member role with organization context</li>
                    <li>• Dashboard - My Dashboard</li>
                    <li>• Tasks - My Tasks, Create Task, Calendar</li>
                    <li>• Reports - My Productivity</li>
                    <li>• Settings - Profile, Notifications</li>
                  </ul>
                </div>
              )}

              {/* Implementation Details */}
              <div className="mt-8 p-4 bg-gray-50 rounded-sm">
                <h3 className="font-semibold text-gray-800 mb-3">
                  Implementation Details
                </h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>
                    ✅ <strong>Dynamic Role Detection</strong> - Automatically
                    fetches user role from /api/auth/verify
                  </li>
                  <li>
                    ✅ <strong>Role Mapping</strong> - Maps backend roles to
                    appropriate sidebar configurations
                  </li>
                  <li>
                    ✅ <strong>Nested Menus</strong> - Supports
                    expandable/collapsible menu sections
                  </li>
                  <li>
                    ✅ <strong>Mobile Responsive</strong> - Works on desktop and
                    mobile with overlay navigation
                  </li>
                  <li>
                    ✅ <strong>Authentication Integration</strong> - Handles
                    logout and token management
                  </li>
                  <li>
                    ✅ <strong>Loading States</strong> - Shows appropriate
                    loading and error states
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CurrentUserSidebar;
