import React, { useState } from "react";
import {
  Settings as SettingsIcon,
  Shield,
  Users,
  Bell,
  Lock,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import LicenseManagement from "./LicenseManagement";

const Settings = () => {
  const [activeTab, setActiveTab] = useState("license");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const tabs = [
    {
      id: "license",
      name: "License Management",
      icon: Shield,
      component: LicenseManagement,
    },
    {
      id: "users",
      name: "User Management",
      icon: Users,
      component: () => (
        <div className="p-4 sm:p-4">User Management - Coming Soon</div>
      ),
    },
    {
      id: "notifications",
      name: "Notifications",
      icon: Bell,
      component: () => (
        <div className="p-4 sm:p-4">Notifications - Coming Soon</div>
      ),
    },
    {
      id: "security",
      name: "Security",
      icon: Lock,
      component: () => (
        <div className="p-4 sm:p-4">Security Settings - Coming Soon</div>
      ),
    },
    {
      id: "billing",
      name: "Billing",
      icon: CreditCard,
      component: () => (
        <div className="p-4 sm:p-4">Billing History - Coming Soon</div>
      ),
    },
  ];

  const ActiveComponent =
    tabs.find((tab) => tab.id === activeTab)?.component || LicenseManagement;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex flex-col lg:flex-row">
        {/* Mobile Menu Toggle */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="lg:hidden fixed top-20 right-4 z-50 bg-white shadow-lg h-9 w-9"
        >
          <SettingsIcon className="w-5 h-5 text-blue-600" />
        </Button>

        {/* Sidebar - Responsive */}
        <div
          className={`
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
          fixed lg:sticky top-0 left-0 z-40
          w-64 bg-white shadow-sm min-h-screen
          transition-transform duration-300 ease-in-out
        `}
        >
          <div className="p-4 sm:p-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <SettingsIcon className="w-5 h-5 sm:w-6 sm:h-6 mr-2 text-blue-600" />
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
                  Settings
                </h1>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileMenuOpen(false)}
                className="lg:hidden text-gray-500 hover:text-gray-700 h-9 w-9"
              >
                ✕
              </Button>
            </div>
          </div>

          <nav className="p-3 sm:p-4">
            <ul className="space-y-2">
              {tabs.map((tab) => (
                <li key={tab.id}>
                  <Button
                    variant={activeTab === tab.id ? "secondary" : "ghost"}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-start px-3 h-9 text-left rounded-sm transition-colors text-sm sm:text-base ${
                      activeTab === tab.id
                        ? "bg-blue-100 text-blue-700 border border-blue-200"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <tab.icon className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 flex-shrink-0" />
                    <span className="truncate" title={tab.name}>
                      {tab.name}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Overlay for mobile sidebar */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Main Content - Responsive */}
        <div className="flex-1 w-full lg:w-auto">
          <ActiveComponent />
        </div>
      </div>
    </div>
  );
};

export default Settings;
