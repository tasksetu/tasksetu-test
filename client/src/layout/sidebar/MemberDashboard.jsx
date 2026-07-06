import React, { useEffect, useState } from "react";
import { MemberSidebar } from "./index";

/**
 * Complete member dashboard implementation that demonstrates
 * how to integrate the sidebar with authentication and user context
 */
const MemberDashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate getting user data from authentication context
    // In a real app, this would come from your auth provider or API
    const mockUserData = {
      id: "68b826d59a951fac9dc4ae98",
      email: "useraccount@gmail.com",
      firstName: "User",
      lastName: "Account",
      role: "member",
      permissions: [],
      profileImageUrl: null,
      organization: null, // Individual member without organization
    };

    setTimeout(() => {
      setUser(mockUserData);
      setLoading(false);
    }, 500);
  }, []);

  const handleLogout = () => {
    // Clear authentication token
    localStorage.removeItem("token");

    // Clear user state
    setUser(null);

    // Redirect to login page
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">
            Please log in to access your dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Member-specific sidebar */}
      <MemberSidebar
        userRole={user.role}
        hasOrganization={!!user.organization}
        onLogout={handleLogout}
      />

      {/* Main dashboard content */}
      <div className="flex-1 lg:ml-0 p-7">
        <div className="max-w-6xl mx-auto">
          {/* Welcome header */}
          <div className="bg-white rounded-sm shadow-sm border p-4 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Welcome back, {user.firstName}!
                </h1>
                <p className="text-gray-600 mt-1">
                  {user.organization
                    ? `Organization Member - ${user.organization.name}`
                    : "Individual Member Dashboard"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Role: {user.role}</p>
                <p className="text-sm text-gray-500">Email: {user.email}</p>
              </div>
            </div>
          </div>

          {/* Dashboard content grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* My Tasks Card */}
            <div className="bg-white rounded-sm shadow-sm border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  My Tasks
                </h3>
                <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">
                  12 active
                </span>
              </div>
              <p className="text-gray-600 text-sm mb-3">
                Keep track of your assigned tasks and progress
              </p>
              <a
                href="/tasks"
                className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
              >
                View all tasks →
              </a>
            </div>

            {/* Quick Actions Card */}
            <div className="bg-white rounded-sm shadow-sm border p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Quick Actions
              </h3>
              <div className="space-y-3">
                <a
                  href="/tasks/create"
                  className="block p-3 bg-green-50 rounded-sm hover:bg-green-100 transition-colors"
                >
                  <span className="font-medium text-green-800">
                    Create New Task
                  </span>
                </a>
                <a
                  href="/calendar"
                  className="block p-3 bg-blue-50 rounded-sm hover:bg-blue-100 transition-colors"
                >
                  <span className="font-medium text-blue-800">
                    View Calendar
                  </span>
                </a>
              </div>
            </div>

            {/* Recent Activity Card */}
            <div className="bg-white rounded-sm shadow-sm border p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Recent Activity
              </h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">
                    Task "Project Setup" completed
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">
                    New task assigned to you
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">
                    Deadline approaching for "Review"
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Usage Instructions */}
          <div className="mt-8 bg-yellow-50 rounded-sm border border-yellow-200 p-4">
            <h3 className="text-lg font-semibold text-yellow-800 mb-3">
              Member Sidebar Integration
            </h3>
            <div className="text-sm text-yellow-700 space-y-2">
              <p>
                <strong>Role Detection:</strong> Automatically shows "Individual
                Member" menus for users without organization.
              </p>
              <p>
                <strong>Navigation:</strong> Grouped menu items (Dashboard,
                Tasks, Reports, Settings) with collapsible sections.
              </p>
              <p>
                <strong>Responsive:</strong> Mobile-friendly with overlay
                navigation and desktop collapse/expand.
              </p>
              <p>
                <strong>Authentication:</strong> Integrated logout functionality
                with token cleanup.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberDashboard;
