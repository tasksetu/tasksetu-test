import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  FolderOpen,
  FileText,
  Settings,
  Menu,
  X,
  Shield,
  BarChart3,
} from "lucide-react";

export function Sidebar({
  isOpen,
  isMobileMenuOpen,
  onToggle,
  onMobileToggle,
}) {
  const [location] = useLocation();

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Tasks", href: "/tasks", icon: CheckSquare },
    { name: "Projects", href: "/projects", icon: FolderOpen },
    { name: "Forms", href: "/forms", icon: FileText },
    { name: "Users", href: "/users", icon: Users },
    { name: "Role Management", href: "/roles", icon: Shield },
    { name: "Reports", href: "/reports", icon: BarChart3 },
    { name: "Integrations", href: "/integrations", icon: Settings },
  ];

  const isActive = (href) => {
    return location === href || (href === "/dashboard" && location === "/");
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 bg-sidebarDark border-r border-gray-600/30 transition-all duration-300 shadow-xl ${
          isOpen ? "w-64" : "w-16"
        } hidden lg:block`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center h-12 px-3 border-b border-gray-600/30 bg-sidebarDark">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckSquare className="h-6 w-6 text-white" />
              </div>
              {isOpen && (
                <div className="ml-2">
                  <h1 className="text-lg font-bold text-white">TaskSetu</h1>
                  <p className="text-xs text-gray-300">Professional Edition</p>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
            {/* Core Features Section */}
            <div className="space-y-1">
              <div className="px-2 py-1">
                {isOpen && (
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Core Features
                  </p>
                )}
              </div>

              {navigation.slice(0, 3).map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={item.name}>
                    <Link
                      href={item.href}
                      className={`group flex items-center px-3 py-3 text-sm font-semibold rounded-sm transition-all duration-200 ease-in-out relative ${
                        isActive(item.href)
                          ? "bg-sidebarActive text-white shadow-lg"
                          : "text-gray-300 hover:bg-sidebarHover hover:text-white"
                      }`}
                    >
                      <Icon
                        className={`flex-shrink-0 h-5 w-5 transition-colors duration-200 ${
                          isActive(item.href)
                            ? "text-white"
                            : "text-gray-400 group-hover:text-white"
                        } ${isOpen ? "mr-3" : ""}`}
                      />

                      {isOpen && (
                        <span className="font-medium">{item.name}</span>
                      )}

                      {!isOpen && (
                        <div className="absolute left-16 bg-sidebarActive text-white px-2 py-1 rounded-md text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap shadow-lg">
                          {item.name}
                        </div>
                      )}

                      {isActive(item.href) && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full"></div>
                      )}
                    </Link>

                    {index < 3 && (
                      <div className="my-2 mx-3 border-t border-gray-600/30"></div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Section Divider */}
            <div className="my-6">
              <div className="border-t border-gray-600/30 mx-3"></div>
              {isOpen && (
                <p className="text-xs font-semibold text-gray-300 mt-4 mb-2 px-3 uppercase tracking-wider">
                  Management
                </p>
              )}
            </div>

            {/* Management Section */}
            <div className="space-y-1">
              {navigation.slice(3, 7).map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={item.name}>
                    <Link
                      href={item.href}
                      className={`group flex items-center px-3 py-3 text-sm font-semibold rounded-sm transition-all duration-200 ease-in-out relative ${
                        isActive(item.href)
                          ? "bg-sidebarActive text-white shadow-lg"
                          : "text-gray-300 hover:bg-sidebarHover hover:text-white"
                      }`}
                    >
                      <Icon
                        className={`flex-shrink-0 h-5 w-5 transition-colors duration-200 ${
                          isActive(item.href)
                            ? "text-white"
                            : "text-gray-400 group-hover:text-white"
                        } ${isOpen ? "mr-3" : ""}`}
                      />

                      {isOpen && (
                        <span className="font-medium">{item.name}</span>
                      )}

                      {!isOpen && (
                        <div className="absolute left-16 bg-sidebarActive text-white px-2 py-1 rounded-md text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap shadow-lg">
                          {item.name}
                        </div>
                      )}

                      {isActive(item.href) && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full"></div>
                      )}
                    </Link>

                    {index < 3 && (
                      <div className="my-2 mx-3 border-t border-gray-600/30"></div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Section Divider */}
            <div className="my-6">
              <div className="border-t border-gray-600/30 mx-3"></div>
              {isOpen && (
                <p className="text-xs font-semibold text-gray-300 mt-4 mb-2 px-3 uppercase tracking-wider">
                  Settings
                </p>
              )}
            </div>

            {/* Integration Section */}
            <div className="space-y-1">
              {navigation.slice(7).map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={item.name}>
                    <Link
                      href={item.href}
                      className={`group flex items-center px-3 py-3 text-sm font-semibold rounded-sm transition-all duration-200 ease-in-out relative ${
                        isActive(item.href)
                          ? "bg-sidebarActive text-white shadow-lg"
                          : "text-gray-300 hover:bg-sidebarHover hover:text-white"
                      }`}
                    >
                      <Icon
                        className={`flex-shrink-0 h-5 w-5 transition-colors duration-200 ${
                          isActive(item.href)
                            ? "text-white"
                            : "text-gray-400 group-hover:text-white"
                        } ${isOpen ? "mr-3" : ""}`}
                      />

                      {isOpen && (
                        <span className="font-medium">{item.name}</span>
                      )}

                      {!isOpen && (
                        <div className="absolute left-16 bg-sidebarActive text-white px-2 py-1 rounded-md text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap shadow-lg">
                          {item.name}
                        </div>
                      )}

                      {isActive(item.href) && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full"></div>
                      )}
                    </Link>

                    {index < navigation.slice(7).length - 1 && (
                      <div className="my-2 mx-3 border-t border-gray-600/30"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <div
        className={`fixed inset-0 z-40 lg:hidden ${isMobileMenuOpen ? "block" : "hidden"}`}
      >
        <div className="fixed inset-y-0 left-0 w-64 bg-sidebarDark border-r border-gray-600/30">
          <div className="flex flex-col h-full">
            {/* Mobile Header */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-gray-600/30">
              <div className="flex items-center">
                <CheckSquare className="h-8 w-8 text-white" />
                <h1 className="ml-3 text-xl font-bold text-white">TaskSetu</h1>
              </div>
              <button
                onClick={onMobileToggle}
                className="p-2 rounded-md text-gray-400 hover:bg-sidebarHover"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Mobile Navigation */}
            <nav className="flex-1 px-2 py-4 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={onMobileToggle}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive(item.href)
                        ? "bg-sidebarActive text-white"
                        : "text-gray-300 hover:bg-sidebarHover hover:text-white"
                    }`}
                  >
                    <Icon
                      className={`flex-shrink-0 h-5 w-5 ${
                        isActive(item.href)
                          ? "text-white"
                          : "text-gray-400 group-hover:text-white"
                      }`}
                    />
                    <span className="ml-3">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </>
  );
}
