import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Shield,
  Settings,
  Bell,
  CreditCard,
  Key,
  Database,
  Palette,
  Globe,
  Mail,
  FileText,
  Lock,
} from "lucide-react";

export default function SettingsSidebar({ isOpen, onClose }) {
  const [location] = useLocation();

  // Get current user data to check role
  const { data: user } = useQuery({
    queryKey: ["/api/auth/verify"],
    enabled: !!localStorage.getItem("token"),
  });

  // Check if user can manage organization
  const canManageOrganization =
    user?.role === "org_admin" || user?.role === "superadmin";

  const settingsItems = [
    {
      category: "Team Management",
      items: [
        // Only show User Management / Subscription for organization admins
        ...(canManageOrganization
          ? [
              {
                name: "User Management / Subscription",
                href: "/settings/user-management",
                icon: Users,
                description: "Manage team members, licenses and permissions",
              },
              {
                name: "Roles & Permissions",
                href: "/settings/roles",
                icon: Shield,
                description: "Configure user roles and access",
              },
            ]
          : []),
        {
          name: "General Settings",
          href: "/settings/general",
          icon: Settings,
          description: "Personal preferences and account settings",
        },
      ],
    },
  ];

  const isActive = (href) => {
    return location === href || location.startsWith(href + "/");
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-80 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
            <p className="text-sm text-gray-600">Manage your organization</p>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            ×
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-6">
          <nav className="px-4 space-y-3">
            {settingsItems.map((category) => (
              <div key={category.category}>
                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {category.category}
                </h3>
                <div className="space-y-1">
                  {category.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);

                    return (
                      <Link key={item.href} href={item.href}>
                        <div
                          className={`group flex items-start px-3 py-3 text-sm font-medium rounded-sm transition-all duration-200 ${
                            active
                              ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600"
                              : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                          }`}
                          onClick={() => {
                            if (window.innerWidth < 1024) {
                              onClose();
                            }
                          }}
                        >
                          <Icon
                            className={`flex-shrink-0 h-5 w-5 mr-3 mt-0.5 ${
                              active
                                ? "text-blue-600"
                                : "text-gray-400 group-hover:text-gray-600"
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <div
                              className={`font-medium ${active ? "text-blue-700" : "text-gray-900"}`}
                            >
                              {item.name}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                              {item.description}
                            </div>
                          </div>
                          {active && (
                            <div className="flex-shrink-0 w-1 h-1 bg-blue-600 rounded-full"></div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Settings className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">Settings</p>
              <p className="text-xs text-gray-500">Version 1.0</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
