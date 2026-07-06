import React from "react";
import { Link, useRoute } from "wouter";
import {
  Settings,
  User,
  Shield,
  Bell,
  Database,
  CreditCard,
  Crown,
  Users,
  Building,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SettingsLayout = ({ children }) => {
  const [, params] = useRoute("/settings/:section?");
  const [, adminParams] = useRoute("/admin/:section?");

  const currentSection = params?.section || adminParams?.section || "general";

  const settingsItems = [
    {
      category: "Account",
      items: [
        {
          id: "general",
          title: "General Settings",
          href: "/settings",
          icon: Settings,
          description: "Basic application preferences",
        },
        {
          id: "profile",
          title: "Profile",
          href: "/settings/profile",
          icon: User,
          description: "Personal information and preferences",
        },
        {
          id: "security",
          title: "Security",
          href: "/settings/security",
          icon: Shield,
          description: "Password and authentication",
        },
        {
          id: "notifications",
          title: "Notifications",
          href: "/settings/notifications",
          icon: Bell,
          description: "Email and app notifications",
        },
      ],
    },
    {
      category: "Administration",
      items: [
        {
          id: "subscription",
          title: "License Management",
          href: "/admin/subscription",
          icon: Crown,
          description: "Subscription plans and usage",
        },
        {
          id: "billing",
          title: "Billing",
          href: "/admin/billing",
          icon: CreditCard,
          description: "Payment methods and invoices",
        },
        {
          id: "users",
          title: "User Management",
          href: "/admin/users",
          icon: Users,
          description: "Manage team members and roles",
        },
        {
          id: "organization",
          title: "Organization",
          href: "/admin/organization",
          icon: Building,
          description: "Company settings and branding",
        },
      ],
    },
    {
      category: "System",
      items: [
        {
          id: "data",
          title: "Data & Storage",
          href: "/settings/data",
          icon: Database,
          description: "Data export and backup",
        },
        {
          id: "privacy",
          title: "Privacy",
          href: "/settings/privacy",
          icon: Lock,
          description: "Privacy and data protection",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          {/* Settings Navigation Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-gray-200 rounded-sm p-4 sticky top-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Settings
              </h2>

              {settingsItems.map((category) => (
                <div key={category.category} className="mb-3">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    {category.category}
                  </h3>
                  <nav className="space-y-1">
                    {category.items.map((item) => {
                      const Icon = item.icon;
                      const isActive =
                        currentSection === item.id ||
                        (item.id === "general" && !currentSection);

                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          className={cn(
                            "flex items-start space-x-3 px-3 py-2 rounded-sm text-sm transition-colors group",
                            isActive
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "text-gray-700 hover:bg-gray-50 hover:text-gray-900",
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4 mt-0.5 flex-shrink-0",
                              isActive
                                ? "text-blue-600"
                                : "text-gray-400 group-hover:text-gray-600",
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <div
                              className="font-medium truncate"
                              title={item.title}
                            >
                              {item.title}
                            </div>
                            <div
                              className="text-xs text-gray-500 truncate"
                              title={item.description}
                            >
                              {item.description}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default SettingsLayout;
