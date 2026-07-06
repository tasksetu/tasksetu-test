import React, { useState } from "react";
import { Sidebar } from "./index";
import { useShowToast } from "@/utils/ToastMessage";

const SidebarDemo = () => {
  const { showSuccessToast } = useShowToast();
  const [currentRole, setCurrentRole] = useState("member");

  const handleLogout = () => {
    console.log("Logout clicked for role:", currentRole);
    showSuccessToast(`Logout action triggered for ${currentRole} role`);
  };

  const handleRoleChange = (role) => {
    setCurrentRole(role);
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Role Switcher */}
      <div className="fixed top-4 right-4 z-50 bg-white rounded-sm shadow-lg p-3 border">
        <h3 className="text-sm font-semibold mb-2">Switch Role:</h3>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => handleRoleChange("member")}
            className={`px-3 py-1 text-xs rounded ${
              currentRole === "member"
                ? "bg-green-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            data-testid="role-member"
          >
            Member
          </button>
          <button
            onClick={() => handleRoleChange("orgMember")}
            className={`px-3 py-1 text-xs rounded ${
              currentRole === "orgMember"
                ? "bg-teal-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            data-testid="role-org-member"
          >
            Org Member
          </button>
          <button
            onClick={() => handleRoleChange("organization")}
            className={`px-3 py-1 text-xs rounded ${
              currentRole === "organization"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            data-testid="role-organization"
          >
            Org Admin
          </button>
          <button
            onClick={() => handleRoleChange("superadmin")}
            className={`px-3 py-1 text-xs rounded ${
              currentRole === "superadmin"
                ? "bg-purple-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            data-testid="role-superadmin"
          >
            Super Admin
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <Sidebar
        role={currentRole}
        onLogout={handleLogout}
        showToggle={true}
        defaultCollapsed={false}
      />

      {/* Main Content */}
      <div className="flex-1 lg:ml-0 p-7">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-sm shadow-sm border p-4">
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              TaskSetu Unified Sidebar Demo
            </h1>

            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-2">
                  Current Role:{" "}
                  <span className="capitalize text-blue-600">
                    {currentRole}
                  </span>
                </h2>
                <p className="text-gray-600">
                  The sidebar automatically adapts to show role-appropriate menu
                  items.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
                <div className="p-4 bg-green-50 rounded-sm border border-green-200">
                  <h3 className="font-semibold text-green-800 mb-2">Member</h3>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• Personal dashboard</li>
                    <li>• My tasks & productivity</li>
                    <li>• Calendar & milestones</li>
                    <li>• Personal approvals</li>
                  </ul>
                </div>

                <div className="p-4 bg-teal-50 rounded-sm border border-teal-200">
                  <h3 className="font-semibold text-teal-800 mb-2">
                    Org Member
                  </h3>
                  <ul className="text-sm text-teal-700 space-y-1">
                    <li>• Company dashboard</li>
                    <li>• My tasks & productivity</li>
                    <li>• Organization calendar</li>
                    <li>• Company approvals</li>
                  </ul>
                </div>

                <div className="p-4 bg-blue-50 rounded-sm border border-blue-200">
                  <h3 className="font-semibold text-blue-800 mb-2">
                    Org Admin
                  </h3>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Team & org dashboards</li>
                    <li>• User management</li>
                    <li>• Company-wide tasks</li>
                    <li>• Reports & settings</li>
                  </ul>
                </div>

                <div className="p-4 bg-purple-50 rounded-sm border border-purple-200">
                  <h3 className="font-semibold text-purple-800 mb-2">
                    Super Admin
                  </h3>
                  <ul className="text-sm text-purple-700 space-y-1">
                    <li>• Platform overview</li>
                    <li>• License management</li>
                    <li>• System configuration</li>
                    <li>• Analytics & audit logs</li>
                  </ul>
                </div>
              </div>

              <div className="mt-8 p-4 bg-yellow-50 rounded-sm border border-yellow-200">
                <h3 className="font-semibold text-yellow-800 mb-2">Features</h3>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>✅ Role-based menu rendering</li>
                  <li>✅ Nested menu support with expand/collapse</li>
                  <li>✅ Mobile responsive with overlay</li>
                  <li>✅ Collapsible sidebar for desktop</li>
                  <li>✅ Active state management</li>
                  <li>✅ Clean Tailwind styling</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SidebarDemo;
