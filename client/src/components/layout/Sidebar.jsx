import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Receipt,
  User,
  Crown,
  Bell,
  Home,
  Calendar,
  Users,
  Building,
  BarChart3,
  Settings as SettingsIcon,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Main navigation items
const mainNavItems = [
  { icon: Home, label: "Dashboard", href: "/dashboard" },
  { icon: Calendar, label: "Calendar", href: "/calendar" },
  { icon: Users, label: "Team Members", href: "/team" },
  { icon: BarChart3, label: "Reporting", href: "/reporting" },
];

// Settings navigation items
const settingsNavItems = [
  { icon: User, label: "Profile", href: "/settings/profile" },
  { icon: Crown, label: "License Management", href: "/admin/subscription" },
  { icon: Receipt, label: "Billing & Invoices", href: "/admin/billing" },
  { icon: Bell, label: "Notifications", href: "/settings/notifications" },
];

export default function Sidebar({ isOpen, onClose }) {
  const [location] = useLocation();

  const renderNavItems = (items, sectionTitle) => (
    <div className="px-3 py-2">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        {sectionTitle}
      </h2>
      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;

          return (
            <Link key={item.href} href={item.href}>
              <a
                className={cn(
                  "group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-blue-100 text-blue-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
                onClick={() => onClose && onClose()}>
                <Icon
                  className={cn(
                    "mr-3 h-5 w-5 flex-shrink-0",
                    isActive
                      ? "text-blue-600"
                      : "text-gray-400 group-hover:text-gray-500"
                  )}
                />
                <span className="lg:inline">{item.label}</span>
              </a>
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile/Tablet Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "flex flex-col bg-white border-r border-gray-200 h-full transition-transform duration-300 ease-in-out z-50",
          // Mobile: slide from left
          "fixed inset-y-0 left-0 w-64 transform lg:relative lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop/Laptop: always visible
          "lg:w-64"
        )}>
        {/* Logo/Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">TaskSetu</h1>
          {/* Close button for mobile/tablet */}
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md hover:bg-gray-100">
            <X className="h-6 w-6 text-gray-600" />
          </button>
        </div>

        {/* Main Navigation */}
        <div className="flex-1 overflow-y-auto">
          {renderNavItems(mainNavItems, "Main")}

          {/* Settings Navigation */}
          {renderNavItems(settingsNavItems, "Settings")}
        </div>
      </div>
    </>
  );
}
