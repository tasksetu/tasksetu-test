import React, { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  Search,
  Settings,
  LogOut,
  Edit3,
  Menu,
  X,
  Zap,
  Command,
  Calendar,
} from "lucide-react";
import ProfileUpdateModal from "@/components/profile/ProfileUpdateModal";
import { UserAvatar } from "@/components/ui/user-avatar";
import RoleSwitcher, { getRoleDisplayName } from "../RoleSwitcher";
import { useAuthStore } from "../../stores/useAuthStore";
import { quickTasksAPI } from "../../services/quickTasksAPI";
import eventEmitter from "../../utils/eventEmitter";
import { useShowToast } from "@/utils/ToastMessage";
import { useCalendar } from "../../contexts/CalendarContext";

export default function Header({ user, onMenuClick }) {
  const [location, setLocation] = useLocation();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const notificationRef = useRef(null);
  const [quickTaskText, setQuickTaskText] = useState("");
  const [isSubmittingQuickTask, setIsSubmittingQuickTask] = useState(false);
  const quickTaskInputRef = useRef(null);
  const { showSuccessToast, showErrorToast } = useShowToast();

  // Keyboard shortcut: Cmd+K / Ctrl+K to focus quick task input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        quickTaskInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const { showCalendar, toggleCalendar } = useCalendar();

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showNotifications]);

  // Check if current page is a billing/upgrade/payment page where role switching should be disabled
  const isBillingPage =
    location.includes("/billing") ||
    location.includes("/upgrade") ||
    location.includes("/payment") ||
    location.includes("/subscription");

  const [notifications, setNotifications] = useState([]);

  // Fetch real notifications from API
  const { data: notificationsData, error: notificationsError } = useQuery({
    queryKey: ["/api/notifications"],
    enabled: !!user,
    staleTime: 5000,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Update notifications when API data changes
  useEffect(() => {
    if (notificationsData) {
      const notifications = Array.isArray(notificationsData)
        ? notificationsData
        : notificationsData.notifications || [];
      setNotifications(notifications);
    }
  }, [notificationsData]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const queryClient = useQueryClient();
  const { setUser, logout } = useAuthStore();

  // Get auth user first
  const { data: authUser } = useQuery({
    queryKey: ["/api/auth/me"],
    initialData: user,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch user data
  const { data: profileUser } = useQuery({
    queryKey: ["/api/users", authUser?.id],
    queryFn: async () => {
      if (authUser?.id) {
        const response = await fetch(`/api/users/${authUser.id}`);
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          return userData;
        }
      }
      return null;
    },
    enabled: !!authUser?.id,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Use profile data primarily, fallback to auth data
  const currentUser = profileUser || authUser || user;

  const handleLogout = async () => {
    try {
      localStorage.removeItem("token");
      logout();
      queryClient.clear();
      setLocation("/login");
    } catch (error) {
      console.error("Logout error:", error);
      localStorage.removeItem("token");
      logout();
      queryClient.clear();
      setLocation("/login");
    }
  };

  // Quick Task creation handler
  const handleQuickTaskSubmit = async () => {
    if (!quickTaskText.trim() || isSubmittingQuickTask) return;

    setIsSubmittingQuickTask(true);
    try {
      const taskData = {
        title: quickTaskText.trim(),
        priority: "low",
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const response = await quickTasksAPI.createQuickTask(taskData);

      if (response && response.success) {
        setQuickTaskText("");
        eventEmitter.emit(
          "quickTaskCreated",
          response.quickTask || response.data,
        );
        showSuccessToast("Quick task created successfully!");
      } else {
        throw new Error(response.message || "Failed to create quick task");
      }
    } catch (error) {
      console.error("Error creating quick task:", error);
      showErrorToast(error.message || "Failed to create quick task");
    } finally {
      setIsSubmittingQuickTask(false);
    }
  };

  const getDisplayName = () => {
    if (currentUser?.firstName && currentUser?.lastName) {
      return `${currentUser.firstName} ${currentUser.lastName}`;
    }
    return currentUser?.email?.split("@")[0] || "User";
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  const getNotificationIcon = (trigger_event) => {
    const icons = {
      task_created: "👤",
      task_assigned: "👤",
      task_updated: "✏️",
      task_completed: "✅",
      task_overdue: "🚨",
      task_due_today: "⏰",
      task_due_soon: "⏰",
      comment_added: "💬",
      user_mentioned: "💬",
      subtask_added: "📝",
      subtask_completed: "✅",
      approval_requested: "📋",
      approval_approved: "✅",
      approval_denied: "❌",
      task_reminder: "🔔",
      system_test: "🧪",
      assignment: "👤",
      due_date: "⏰",
      overdue: "🚨",
      mention: "💬",
      status_change: "✏️",
      snooze_wakeup: "😴",
      reminder: "🔔",
    };
    return icons[trigger_event] || "📝";
  };

  const markAsRead = async (notificationId) => {
    try {
      const response = await fetch(
        `/api/notifications/${notificationId}/read`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.ok) {
        setNotifications(
          notifications.map((n) =>
            n._id === notificationId ? { ...n, is_read: true } : n,
          ),
        );
        queryClient.invalidateQueries(["/api/notifications"]);
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleNotificationClick = (notification, event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    setShowNotifications(false);
    markAsRead(notification._id).catch((err) =>
      console.error("Error marking notification as read:", err),
    );

    const { related_entity } = notification;
    if (!related_entity) return;

    const { entity_type, entity_id } = related_entity;
    if (!entity_type || !entity_id) return;

    setTimeout(() => {
      if (
        notification.trigger_event === "quick_task_completed" ||
        notification.trigger_event === "quick_task_converted"
      ) {
        setLocation("/quick-tasks");
        return;
      }

      switch (entity_type) {
        case "task":
          setLocation(`/tasks/${entity_id}`);
          break;
        case "quick_task":
          setLocation("/quick-tasks");
          break;
        case "approval":
          setLocation(`/tasks/${entity_id}`);
          break;
        case "milestone":
          setLocation(`/tasks/${entity_id}`);
          break;
        default:
          console.warn("Unknown entity type:", entity_type);
      }
    }, 100);
  };

  return (
    <header className="bg-white border-b border-gray-200 px-3 sm:px-4 md:px-6 py-3 shadow-sm fixed top-0 left-0 right-0 z-30">
      <div className="flex items-center h-10 gap-2 sm:gap-3">
        {/* Left section - shares equal space with right on desktop for true centering */}
        <div className="flex items-center flex-shrink-0 lg:flex-1">
          {/* Hamburger Menu for Mobile/Tablet */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-sm transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Task Input - Centered in the middle */}
        <div className="flex-1 lg:flex-none lg:w-[550px] min-w-0">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <Zap className="h-4 w-4" />
            </div>
            <input
              ref={quickTaskInputRef}
              type="text"
              value={quickTaskText}
              onChange={(e) => setQuickTaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleQuickTaskSubmit();
                }
              }}
              placeholder="What needs to be done? e.g. Call Amit tomorrow 4pm"
              className="w-full pl-10 pr-20 py-2 bg-gray-50 border border-gray-200 rounded-sm text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
              disabled={isSubmittingQuickTask}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {quickTaskText.trim() && (
                <button
                  onClick={handleQuickTaskSubmit}
                  disabled={isSubmittingQuickTask}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-sm transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {isSubmittingQuickTask ? (
                    "..."
                  ) : (
                    <>
                      Add
                      <span className="text-[18px] mt-1">↵</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right section - shares equal space with left on desktop */}
        <div className="flex items-center flex-shrink-0 lg:flex-1 lg:justify-end space-x-1 sm:space-x-2 md:space-x-3">
          {/* Role Switcher - Hidden on billing/upgrade pages, responsive */}
          {!profileUser?.role?.includes("individual") && !isBillingPage && (
            <div className="flex items-center">
              <RoleSwitcher />
            </div>
          )}

          {/* Billing Page Indicator */}
          {isBillingPage && !profileUser?.role?.includes("individual") && (
            <div className="hidden sm:flex items-center space-x-2 bg-blue-50 text-blue-700 px-2 md:px-3 py-1 rounded-sm text-xs md:text-sm">
              <svg
                className="w-3 h-3 md:w-4 md:h-4"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-medium">Secure Session</span>
            </div>
          )}

          {/* CALENDAR BUTTON */}
          <div className="relative">
            <button
              onClick={toggleCalendar}
              className={`p-1.5 sm:p-2 rounded-sm transition-colors ${
                showCalendar
                  ? "bg-blue-100 text-blue-600"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
              title={showCalendar ? "Hide Calendar" : "Show Calendar"}
            >
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>

          {/* Notification Dropdown */}
          <div className="relative notification-dropdown" ref={notificationRef}>
            <button
              className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-sm transition-colors relative"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Content */}
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-80 md:w-96 bg-white shadow-xl rounded-sm border border-gray-200 z-50 max-h-[80vh] sm:max-h-96 overflow-hidden">
                <div className="p-3 sm:p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                      Notifications
                    </h3>
                    <Link
                      href="/notifications"
                      className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline"
                    >
                      Read All
                    </Link>
                  </div>
                </div>

                <div className="max-h-60 sm:max-h-80 overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.slice(0, 10).map((notification) => (
                      <div
                        key={notification._id}
                        className={`p-3 sm:p-4 border-b border-gray-100 cursor-pointer transition-all duration-200 ${
                          !notification.is_read
                            ? "bg-blue-50 hover:bg-blue-100 border-l-4 border-l-blue-500"
                            : "hover:bg-gray-50"
                        }`}
                        onClick={(e) =>
                          handleNotificationClick(notification, e)
                        }
                      >
                        <div className="flex items-start space-x-2 sm:space-x-3">
                          <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-white rounded-full flex items-center justify-center border shadow-sm">
                            <span className="text-xs sm:text-sm">
                              {getNotificationIcon(notification.trigger_event)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs sm:text-sm font-medium text-gray-900 mb-1">
                              {notification.title}
                            </h4>
                            <p className="text-xs sm:text-sm text-gray-600 mb-2 line-clamp-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center flex-wrap gap-2">
                              <span className="text-xs text-gray-500">
                                {formatTimestamp(notification.created_at)}
                              </span>
                              <span
                                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                  notification.priority === "urgent"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {notification.priority}
                              </span>
                              {!notification.is_read && (
                                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-7 sm:p-12 text-center">
                      <div className="text-gray-300 text-4xl sm:text-5xl mb-3">
                        🔔
                      </div>
                      <h4 className="text-gray-600 font-medium mb-1 text-sm sm:text-base">
                        No notifications
                      </h4>
                      <p className="text-gray-400 text-xs sm:text-sm">
                        You're all caught up!
                      </p>
                    </div>
                  )}
                </div>

                {notifications.length > 0 && (
                  <div className="p-2 sm:p-3 border-t border-gray-200 bg-gray-50">
                    <button
                      onClick={() => {
                        setShowNotifications(false);
                        setLocation("/notifications");
                      }}
                      className="w-full text-center text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium py-2 hover:bg-blue-50 rounded-sm transition-colors"
                    >
                      View All Notifications
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Avatar */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-8 w-8 sm:h-10 sm:w-10 rounded-full p-0 hover:bg-gray-100 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              >
                <UserAvatar
                  user={currentUser}
                  size="md"
                  className="h-7 w-7 sm:h-8 sm:w-8"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56 sm:w-64 bg-white border border-gray-200 shadow-lg overflow-visible !rounded-sm"
              align="end"
              side="bottom"
              sideOffset={4}
            >
              <div className="flex flex-col space-y-1 p-2 sm:p-3 bg-gray-50 border-b">
                <p
                  className="text-xs sm:text-sm font-semibold text-gray-900 leading-none truncate"
                  title={getDisplayName()}
                >
                  {getDisplayName()}
                </p>
                <p
                  className="text-xs text-gray-500 leading-none truncate"
                  title={currentUser?.email}
                >
                  {currentUser?.email}
                </p>
                <p className="text-xs text-blue-600 font-medium mt-1 capitalize">
                  {getRoleDisplayName(
                    currentUser?.activeRole || currentUser?.role?.[0] || "User",
                  )}
                </p>
              </div>
              <DropdownMenuItem
                onClick={() => setLocation("/edit-profile")}
                className="cursor-pointer hover:bg-gray-50 text-xs sm:text-sm"
              >
                <Edit3 className="mr-2 sm:mr-3 h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                <span>Edit Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setLocation("/notifications?settings=true")}
                className="cursor-pointer hover:bg-gray-50 text-xs sm:text-sm"
              >
                <Settings className="mr-2 sm:mr-3 h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer hover:bg-red-50 text-red-600 focus:text-red-600 text-xs sm:text-sm"
              >
                <LogOut className="mr-2 sm:mr-3 h-3 w-3 sm:h-4 sm:w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ProfileUpdateModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />

      {/* Mobile Search Modal */}
      {showMobileSearch && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setShowMobileSearch(false)}
          ></div>
          <div className="relative bg-white w-full p-4 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search tasks, users, projects..."
                  className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setShowMobileSearch(false);
                  }}
                />
              </div>
              <button
                onClick={() => setShowMobileSearch(false)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-sm transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              Press ESC to close or tap outside to dismiss
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
