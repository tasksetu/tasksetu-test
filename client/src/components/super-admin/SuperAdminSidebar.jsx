import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Building2,
  Users,
  Activity,
  FileText,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Package,
  Key,
  Zap,
  Scroll,
  AlertTriangle,
  Heart,
  Headphones,
} from "lucide-react";

export default function SuperAdminSidebar({ isCollapsed, setIsCollapsed }) {
  const [location, setLocation] = useLocation();
  const [expandedSections, setExpandedSections] = useState({});

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Phase-1 Menu Structure - Governance Only, No User Operations
  const menuSections = [
    {
      id: "overview",
      title: "Platform Overview",
      icon: LayoutDashboard,
      items: [
        {
          label: "Dashboard",
          href: "/super-admin/dashboard",
          icon: LayoutDashboard,
        },
        // { label: "Platform Health", href: "/super-admin/health", icon: Heart },
      ],
    },
    {
      id: "companies",
      title: "Companies",
      icon: Building2,
      items: [
        {
          label: "Company Directory",
          href: "/super-admin/companies",
          icon: Building2,
        },
        // { label: "License Utilization", href: "/super-admin/licenses", icon: Key },
        // { label: "Company Status", href: "/super-admin/company-status", icon: Shield },
      ],
    },
    {
      id: "users",
      title: "Users",
      icon: Users,
      items: [{ label: "All Users", href: "/super-admin/users", icon: Users }],
    },
    {
      id: "licensing",
      title: "Licensing & Plans",
      icon: Package,
      items: [
        {
          label: "License Plans",
          href: "/super-admin/license-plans",
          icon: Package,
        },
        {
          label: "License Management",
          href: "/super-admin/license-management",
          icon: Key,
        },
        // { label: "Feature Mapping", href: "/super-admin/feature-flags", icon: Zap },
      ],
    },
    // {
    //   id: "configuration",
    //   title: "System Configuration",
    //   icon: Settings,
    //   items: [
    //     { label: "Feature Flags", href: "/super-admin/feature-flags", icon: Zap },
    //   ]
    // },
    // {
    //   id: "analytics",
    //   title: "Platform Analytics",
    //   icon: Activity,
    //   items: [
    //     { label: "Active Users & Companies", href: "/super-admin/analytics", icon: Activity },
    //     { label: "Module Adoption", href: "/super-admin/analytics", icon: LayoutDashboard },
    //     { label: "License Consumption", href: "/super-admin/analytics", icon: Package },
    //   ]
    // },
    {
      id: "compliance",
      title: "Audit & Compliance",
      icon: Scroll,
      items: [
        {
          label: "Audit Logs",
          href: "/super-admin/audit-logs",
          icon: FileText,
        },
        {
          label: "Support Tickets",
          href: "/super-admin/support-tickets",
          icon: Headphones,
        },
      ],
    },
    // {
    //   id: "support",
    //   title: "Support & Ops",
    //   icon: AlertTriangle,
    //   items: [
    //     { label: "Error Logs", href: "/super-admin/error-logs", icon: AlertTriangle },
    //   ]
    // },
    {
      id: "management",
      title: "Management",
      icon: Shield,
      items: [
        {
          label: "Admin Management",
          href: "/super-admin/admins",
          icon: Shield,
        },
        {
          label: "System Settings",
          href: "/super-admin/settings",
          icon: Settings,
        },
      ],
    },
  ];

  const handleLogout = () => {
    console.log("logout");
    localStorage.removeItem("token");
    setLocation("/login");
  };

  return (
    <div
      className={`bg-sidebarDark text-white h-full flex flex-col transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Header */}
      <div className="p-3 border-b border-gray-600/30">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div>
              <h1 className="text-lg font-bold text-white">Super Admin</h1>
              <p className="text-xs text-gray-300">Platform Control</p>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-sm hover:bg-sidebarHover transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {menuSections.map((section) => {
          const SectionIcon = section.icon;
          const isExpanded = expandedSections[section.id];
          const isActive = section.items.some(
            (item) => location === item.href || location.startsWith(item.href),
          );

          return (
            <div key={section.id}>
              {/* Section Header */}
              <button
                onClick={() => !isCollapsed && toggleSection(section.id)}
                className={`flex items-center gap-3 w-full p-2.5 rounded-sm transition-all duration-200 ${
                  isActive
                    ? "bg-sidebarActive text-white shadow-md"
                    : "text-gray-300 hover:bg-sidebarHover hover:text-white"
                }`}
              >
                <SectionIcon className="h-4 w-4 flex-shrink-0" />
                {!isCollapsed && (
                  <>
                    <span className="text-sm font-medium flex-1 text-left">
                      {section.title}
                    </span>
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    />
                  </>
                )}
              </button>

              {/* Section Items */}
              {!isCollapsed && isExpanded && (
                <div className="ml-4 mt-1 space-y-1 border-l border-gray-600/30 pl-3">
                  {section.items.map((item) => {
                    const ItemIcon = item.icon;
                    const itemActive =
                      location === item.href || location.startsWith(item.href);

                    return (
                      <Link key={item.href} href={item.href}>
                        <div
                          className={`flex items-center gap-3 p-2 rounded-sm transition-all duration-200 text-sm ${
                            itemActive
                              ? "bg-sidebarActive text-white shadow-md"
                              : "text-gray-400 hover:bg-sidebarHover hover:text-white"
                          }`}
                        >
                          <ItemIcon className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>{item.label}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-gray-600/30">
        <button
          onClick={() => handleLogout()}
          className={`flex items-center gap-3 p-2.5 rounded-sm text-gray-300 hover:bg-red-600 hover:text-white transition-all duration-200 w-full ${
            isCollapsed ? "justify-center" : ""
          }`}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </div>
  );
}
