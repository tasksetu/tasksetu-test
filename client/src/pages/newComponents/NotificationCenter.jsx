import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import CommonLoader from "@/components/common/CommonLoader";
import { apiClient } from "../../utils/apiClient";
import { useLocation } from "wouter";
import { useLicense } from "../../hooks/useLicense";
import { useShowToast } from "@/utils/ToastMessage";
import { useAuth } from "../../features/shared/hooks/useAuth";
import { getTimezoneOptions } from "../../utils/timezoneList";
import { Loader } from "lucide-react";

// API base URL
const API_URL = import.meta.env.VITE_API_URL || "";

// Notification types mapping from backend
const NotificationType = {
  TASK_CREATED: "task_created",
  TASK_UPDATED: "task_updated",
  TASK_OVERDUE: "task_overdue",
  TASK_COMPLETED: "task_completed",
  TASK_REASSIGNED: "task_reassigned",
  TASK_REMINDER: "task_reminder",
  TASK_DUE_TODAY: "task_due_today",
  TASK_DUE_SOON: "task_due_soon",
  USER_MENTIONED: "user_mentioned",
  COMMENT_ADDED: "comment_added",
  SNOOZE_WAKEUP: "snooze_wakeup",
  APPROVAL_REQUESTED: "approval_requested",
  APPROVAL_APPROVED: "approval_approved",
  APPROVAL_DENIED: "approval_denied",
  SUBTASK_ADDED: "subtask_added",
  SUBTASK_COMPLETED: "subtask_completed",
};

// Map backend trigger events to display types
const mapTriggerEventToType = (triggerEvent) => {
  const mapping = {
    task_created: "assignment",
    task_updated: "status_change",
    task_overdue: "overdue",
    task_completed: "status_change",
    task_reassigned: "assignment",
    task_reminder: "reminder",
    task_due_today: "due_date",
    task_due_soon: "due_date",
    user_mentioned: "mention",
    comment_added: "mention",
    snooze_wakeup: "snooze_wakeup",
    approval_requested: "assignment",
    approval_approved: "status_change",
    approval_denied: "status_change",
    subtask_added: "assignment",
    subtask_completed: "status_change",
  };
  return mapping[triggerEvent] || "reminder";
};

// Map backend priority to display priority
const mapPriority = (priority) => {
  return priority === "urgent" ? "critical" : priority || "medium";
};

export default function NotificationCenter() {
  const [, setLocation] = useLocation();
  const { showSuccessToast, showErrorToast } = useShowToast();
  const { role: userRole } = useAuth();

  // License feature access
  const { checkFeature, license, isLoading: licenseLoading } = useLicense();
  const hasBasicNotifications = checkFeature("NOTIF_BASIC");
  const hasAdvancedNotifications = checkFeature("NOTIF_ADV");

  // State for notifications
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  // State for notification settings
  const [notificationSettings, setNotificationSettings] = useState({
    notifications_enabled: true,
    channels: {
      in_app: {
        enabled: true,
        frequency: "real_time",
        quiet_hours: { start: "22:00", end: "08:00", enabled: false },
      },
      email: {
        enabled: true,
        frequency: "real_time",
        quiet_hours: { start: "22:00", end: "08:00", enabled: false },
      },
      push: {
        enabled: false,
        frequency: "real_time",
        quiet_hours: { start: "22:00", end: "08:00", enabled: false },
      },
    },
    event_preferences: {
      task_assigned: true,
      task_due_soon: true,
      task_due_today: true,
      task_overdue: true,
      task_status_changed: true,
      user_mentioned: true,
      comment_added: true,
      task_reminder: true,
    },
    digest_settings: {
      daily_digest_time: "09:00",
      weekly_digest_day: "monday",
      weekly_digest_time: "09:00",
      include_completed_tasks: false,
      max_digest_items: 20,
    },
    timezone:
      Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
    dueDateReminders: {
      enabled: true,
      daysBeforeDue: [3, 1],
      time: "09:00",
    },
  });
  const [settingsLoading, setSettingsLoading] = useState(false);

  const [filter, setFilter] = useState("all");
  const [showSettings, setShowSettings] = useState(false);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        includeExpired: "false",
      });

      // Add filter parameters
      if (filter === "unread") {
        params.append("isRead", "false");
      } else if (filter !== "all") {
        // Map filter to trigger event
        const filterMapping = {
          assignment: "task_created",
          due_date: "task_due_soon",
          overdue: "task_overdue",
          mention: "user_mentioned",
          status_change: "task_updated",
          snooze_wakeup: "snooze_wakeup",
        };
        if (filterMapping[filter]) {
          params.append("triggerEvent", filterMapping[filter]);
        }
      }

      const response = await apiClient.get(
        `/api/notifications?${params.toString()}`,
      );

      if (response.data.success) {
        const data = response.data.data;
        // Transform notifications to component format
        const transformedNotifications = (
          data.data ||
          data.notifications ||
          []
        ).map((n) => ({
          id: n._id,
          type: mapTriggerEventToType(n.trigger_event),
          triggerEvent: n.trigger_event,
          title: n.title,
          message: n.message,
          timestamp: n.created_at,
          read: n.is_read,
          taskId: n.related_entity?.entity_id,
          entityType: n.related_entity?.entity_type,
          priority: mapPriority(n.priority),
          metadata: n.metadata,
        }));

        setNotifications(transformedNotifications);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
      setError("Failed to load notifications. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [filter, pagination.page, pagination.limit]);

  // Fetch notification settings from API
  const fetchNotificationSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const response = await apiClient.get(`/api/notification-settings`);

      if (response.data.success && response.data.data) {
        const settings = response.data.data;
        setNotificationSettings((prev) => ({
          ...prev,
          notifications_enabled: settings.notifications_enabled ?? true,
          channels: {
            in_app: settings.channels?.in_app || prev.channels.in_app,
            email: settings.channels?.email || prev.channels.email,
            push: settings.channels?.push || prev.channels.push,
          },
          event_preferences:
            settings.event_preferences || prev.event_preferences,
          digest_settings: settings.digest_settings || prev.digest_settings,
          timezone: settings.timezone || prev.timezone,
          dueDateReminders: {
            enabled: settings.due_date_reminders?.enabled ?? true,
            daysBeforeDue: settings.due_date_reminders?.days_before_due || [
              3, 1,
            ],
            time: settings.due_date_reminders?.reminder_time || "09:00",
          },
        }));
      }
    } catch (err) {
      console.error("Error fetching notification settings:", err);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  // Mark single notification as read
  const markNotificationRead = async (id) => {
    try {
      await apiClient.put(`/api/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
    } catch (err) {
      console.error("Error marking notification as read:", err);
      showErrorToast("Failed to mark notification as read");
    }
  };

  // Mark all notifications as read
  const markAllNotificationsRead = async () => {
    try {
      await apiClient.put(`/api/notifications/mark-all-read`);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      showSuccessToast("All notifications marked as read");
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
      showErrorToast("Failed to mark all notifications as read");
    }
  };

  // Delete notification
  const deleteNotification = async (id) => {
    try {
      await apiClient.delete(`/api/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      showSuccessToast("Notification deleted");
    } catch (err) {
      console.error("Error deleting notification:", err);
      showErrorToast("Failed to delete notification");
    }
  };

  // Update notification settings
  const updateNotificationSettings = async (newSettings) => {
    try {
      // Transform settings to backend format
      const backendSettings = {
        notifications_enabled: newSettings.notifications_enabled,
        channels: {
          in_app: newSettings.channels?.in_app,
          email: newSettings.channels?.email,
          push: newSettings.channels?.push,
        },
        event_preferences: newSettings.event_preferences,
        digest_settings: newSettings.digest_settings,
        timezone: newSettings.timezone,
        due_date_reminders: newSettings.dueDateReminders
          ? {
              enabled: newSettings.dueDateReminders.enabled,
              days_before_due: newSettings.dueDateReminders.daysBeforeDue,
              reminder_time: newSettings.dueDateReminders.time,
            }
          : undefined,
      };

      await apiClient.put(`/api/notification-settings`, backendSettings);
      setNotificationSettings((prev) => ({ ...prev, ...newSettings }));
      showSuccessToast("Notification settings updated");
    } catch (err) {
      console.error("Error updating notification settings:", err);
      // Check if it's a license/feature access error
      if (err.response?.status === 403 && err.response?.data?.upgradeRequired) {
        showErrorToast(
          "Advanced notifications (Email, Push) require an upgraded plan.",
        );
      } else {
        showErrorToast("Failed to update notification settings");
      }
    }
  };

  // Fetch unread count for badge
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await apiClient.get(`/api/notifications/unread-count`);
      if (response.data.success) {
        return response.data.data.unreadCount || 0;
      }
    } catch (err) {
      console.error("Error fetching unread count:", err);
    }
    return 0;
  }, []);

  // Initialize notifications on component mount
  useEffect(() => {
    fetchNotifications();
    fetchNotificationSettings();
  }, [fetchNotifications, fetchNotificationSettings]);

  // Poll for new notifications every minute
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotifications();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Calculate unread count
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Filter notifications based on selected filter
  const filteredNotifications = notifications.filter((notification) => {
    if (filter === "all") return true;
    if (filter === "unread") return !notification.read;
    return notification.type === filter;
  });

  const getNotificationIcon = (type) => {
    const icons = {
      assignment: "👤",
      due_date: "⏰",
      overdue: "🚨",
      mention: "💬",
      status_change: "✏️",
      snooze_wakeup: "😴",
      reminder: "🔔",
    };
    return icons[type] || "📝";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      critical: "#ff4444",
      urgent: "#ff4444",
      high: "#ff8800",
      medium: "#0099ff",
      normal: "#0099ff",
      low: "#00aa44",
    };
    return colors[priority] || "#666";
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

  // Handle notification click - navigate to related entity
  const handleNotificationClick = async (notification) => {
    // Mark as read first
    if (!notification.read) {
      await markNotificationRead(notification.id);
    }

    // Navigate based on entity type
    if (notification.taskId) {
      switch (notification.entityType) {
        case "task":
        case "subtask":
          setLocation(`/tasks/${notification.taskId}`);
          break;
        case "approval":
          setLocation(`/approvals/${notification.taskId}`);
          break;
        case "comment":
          setLocation(
            `/tasks/${notification.metadata?.task_id || notification.taskId}?thread=true`,
          );
          break;
        default:
          setLocation(`/tasks/${notification.taskId}`);
      }
    }
  };

  const markAsRead = (notificationId) => {
    markNotificationRead(notificationId);
  };

  const markAllAsRead = () => {
    markAllNotificationsRead();
  };

  const handleDeleteNotification = (notificationId) => {
    deleteNotification(notificationId);
  };

  if (showSettings) {
    return (
      <NotificationSettings
        settings={notificationSettings}
        onSettingsChange={updateNotificationSettings}
        onBack={() => setShowSettings(false)}
        isLoading={settingsLoading}
        hasAdvancedNotifications={hasAdvancedNotifications}
        licenseTier={license?.code || "EXPLORE"}
        userRole={userRole}
      />
    );
  }

  return (
    <div className="notification-center-page flex flex-col min-h-screen gap-3 p-5 [&_.card]:!rounded-sm [&_input:not([type='checkbox']):not([type='radio'])]:!rounded-sm [&_select]:!rounded-sm [&_textarea]:!rounded-sm [&_.form-input]:!rounded-sm [&_.form-select]:!rounded-sm [&_.form-textarea]:!rounded-sm [&_button:not(.rounded-full)]:!rounded-sm [&_table]:!rounded-sm [&_.bg-white.border]:!rounded-sm [&_.rounded-sm]:!rounded-sm [&_.rounded-md]:!rounded-sm [&_.rounded-lg]:!rounded-sm [&_.rounded-xl]:!rounded-sm [&_.rounded-2xl]:!rounded-sm [&_.rounded]:!rounded-sm [&_[data-loader-ring]]:!rounded-full">
      {/* License Info Banner - Show for Explore tier users */}
      {!hasAdvancedNotifications && !licenseLoading && (
        <div className="shrink-0 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-sm p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <span className="text-xl">🔔</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Basic Notifications Only
              </h3>
              <p className="text-sm text-gray-600">
                You're on the{" "}
                <span className="font-medium text-amber-600">
                  {license?.code || "Explore"}
                </span>{" "}
                tier. Upgrade to enable email and push notifications.
              </p>
            </div>
          </div>
          <a
            href="/settings/license"
            className="h-8 px-4 inline-flex items-center bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-medium rounded-sm hover:from-blue-600 hover:to-indigo-700 transition-colors"
          >
            Upgrade
          </a>
        </div>
      )}

      <div className="shrink-0 flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center space-x-3">
          <h1 className="text-2xl font-normal m-0"
                style={{ color: "#676a6c" }}>Notifications</h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              {unreadCount} unread
            </span>
          )}
        </div>
        <div className="flex items-center space-x-3 mt-4 lg:mt-0">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              className="h-8 rounded-sm"
              onClick={markAllAsRead}
            >
              Mark All Read
            </Button>
          )}
          <Button
            variant="outline"
            className="h-8 rounded-sm"
            onClick={() => {
              fetchNotificationSettings();
              setShowSettings(true);
            }}
          >
            <span className="">⚙️</span>
            Settings
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col min-h-0 bg-white rounded-sm shadow-sm border border-gray-200 p-3">
        <div className="shrink-0 mb-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="form-select h-8 min-h-8 max-h-8 w-full max-w-md border border-gray-300 rounded-sm py-0 leading-none box-border"
          >
            <option value="all">All Notifications</option>
            <option value="unread">Unread Only</option>
            <option value="assignment">Assignments</option>
            <option value="due_date">Due Date Reminders</option>
            <option value="overdue">Overdue Alerts</option>
            <option value="mention">Mentions</option>
            <option value="status_change">Status Changes</option>
            <option value="snooze_wakeup">Snooze Wake-ups</option>
          </select>
        </div>

        <div className="flex flex-1 min-h-0 flex-col overflow-y-auto">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="flex flex-col items-center gap-3">
                <Loader className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-lg text-gray-600">Loading notification...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="flex min-h-[220px] flex-1 flex-col items-center justify-center py-10 text-center px-4">
              <div className="text-red-400 text-6xl mb-3">⚠️</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Error Loading Notifications
              </h3>
              <p className="text-gray-500 mb-3">{error}</p>
              <Button
                variant="primary"
                className="h-8 rounded-sm"
                onClick={fetchNotifications}
              >
                Try Again
              </Button>
            </div>
          )}

          {/* Notifications List */}
          {!isLoading && !error && (
            <div className="space-y-3">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex items-start space-x-3 p-3 rounded-sm border cursor-pointer transition-all duration-200 ${!notification.read ? "bg-blue-50 border-blue-200 hover:bg-blue-100" : "bg-gray-50 border-gray-200 hover:bg-gray-100"}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex-shrink-0 w-8 h-8 bg-white rounded-full flex items-center justify-center border">
                    <span className="text-sm">
                      {getNotificationIcon(notification.type)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">
                          {notification.title}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <div className="flex items-center space-x-2 mt-2">
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(notification.timestamp)}
                          </span>
                          <span
                            className="text-xs font-medium"
                            style={{
                              color: getPriorityColor(notification.priority),
                            }}
                          >
                            {notification.priority}
                          </span>
                          {!notification.read && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              New
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-gray-600 ml-4"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNotification(notification.id);
                        }}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && filteredNotifications.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-3">🔔</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No notifications
              </h3>
              <p className="text-gray-500">
                {filter === "unread"
                  ? "All caught up! No unread notifications."
                  : "You're all set! No notifications to show."}
              </p>
            </div>
          )}
        </div>

        {/* Pagination — stays fixed below scroll area */}
        {!isLoading && !error && pagination.pages > 1 && (
          <div className="shrink-0 flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              Page {pagination.page} of {pagination.pages} ({pagination.total}{" "}
              total)
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                className="h-8 text-sm rounded-sm"
                disabled={pagination.page <= 1}
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                }
              >
                Previous
              </Button>
              <Button
                variant="outline"
                className="h-8 text-sm rounded-sm"
                disabled={pagination.page >= pagination.pages}
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                }
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationSettings({
  settings,
  onSettingsChange,
  onBack,
  isLoading,
  hasAdvancedNotifications = false,
  licenseTier = "EXPLORE",
  userRole = "employee",
}) {
  const [activeSection, setActiveSection] = useState("delivery");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Check if advanced features (email, push, SMS) are available based on license
  const isAdvancedChannel = (channel) =>
    ["email", "push", "sms"].includes(channel);

  // Helper to check if channel can be enabled
  const canEnableChannel = (channel) => {
    if (channel === "in_app") return true; // NOTIF_BASIC - always available
    return hasAdvancedNotifications; // NOTIF_ADV required for email, push, sms
  };

  // Handle toggle for channel settings
  const handleChannelToggle = async (channel, field = "enabled") => {
    // Check license before allowing advanced channels to be enabled
    if (isAdvancedChannel(channel) && !hasAdvancedNotifications) {
      setShowUpgradeModal(true);
      return;
    }

    try {
      setIsSaving(true);
      const currentValue = settings.channels?.[channel]?.[field] ?? false;
      const newSettings = {
        ...settings,
        channels: {
          ...settings.channels,
          [channel]: {
            ...settings.channels[channel],
            [field]: !currentValue,
          },
        },
      };
      await onSettingsChange(newSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error("Error updating channel settings:", error);
      // Check if it's a license/feature access error from backend
      if (
        error.response?.status === 403 &&
        error.response?.data?.upgradeRequired
      ) {
        setShowUpgradeModal(true);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Handle toggle for event preferences
  const handleEventToggle = async (event) => {
    try {
      setIsSaving(true);
      const currentValue = settings.event_preferences?.[event] ?? true;
      const newSettings = {
        ...settings,
        event_preferences: {
          ...settings.event_preferences,
          [event]: !currentValue,
        },
      };
      await onSettingsChange(newSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error("Error updating event preferences:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle channel frequency change
  const handleFrequencyChange = async (channel, frequency) => {
    try {
      setIsSaving(true);
      const newSettings = {
        ...settings,
        channels: {
          ...settings.channels,
          [channel]: {
            ...settings.channels[channel],
            frequency: frequency,
          },
        },
      };
      await onSettingsChange(newSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error("Error updating frequency:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle quiet hours update
  const handleQuietHoursChange = async (channel, field, value) => {
    try {
      setIsSaving(true);
      const newSettings = {
        ...settings,
        channels: {
          ...settings.channels,
          [channel]: {
            ...settings.channels[channel],
            quiet_hours: {
              ...settings.channels[channel]?.quiet_hours,
              [field]: value,
            },
          },
        },
      };
      await onSettingsChange(newSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error("Error updating quiet hours:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle digest settings update
  const handleDigestChange = async (field, value) => {
    try {
      setIsSaving(true);
      const newSettings = {
        ...settings,
        digest_settings: {
          ...settings.digest_settings,
          [field]: value,
        },
      };
      await onSettingsChange(newSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error("Error updating digest settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle due date reminder days toggle
  const handleDueDateReminderChange = async (days) => {
    try {
      setIsSaving(true);
      const currentDays = settings.dueDateReminders?.daysBeforeDue || [];
      const newDays = currentDays.includes(days)
        ? currentDays.filter((d) => d !== days)
        : [...currentDays, days].sort((a, b) => b - a);

      const newSettings = {
        ...settings,
        dueDateReminders: {
          ...settings.dueDateReminders,
          daysBeforeDue: newDays,
        },
      };
      await onSettingsChange(newSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error("Error updating reminder days:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const sections = [
    { id: "delivery", label: "Delivery", icon: "📨", count: 3 },
    { id: "events", label: "Event Types", icon: "🎯", count: 8 },
    { id: "reminders", label: "Reminders", icon: "⏰", count: 3 },
    { id: "advanced", label: "Advanced", icon: "⚙️", count: 4 },
  ];

  return (
    <div className="notification-center-page min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 overflow-scrol [&_*]:!rounded-none [&_*::before]:!rounded-none [&_*::after]:!rounded-none">
      {/* Professional Header */}
      <div className="bg-white backdrop-blur-md border-b border-gray-200/60 sticky top-0 z-20 border-gray-200">
        <div className="max-w-5xl mx-auto px-8 py-5">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              className="h-8 flex items-center gap-2 px-5 py-1 bg-white border border-gray-200 font-semibold text-gray-700 hover:text-blue-700 hover:bg-blue-50 transition-all duration-200 shadow-md hover:shadow-lg"
              onClick={onBack}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              <span className="font-medium">Back to Notifications</span>
            </Button>

            <div className="flex items-center gap-3">
              {isSaving && (
                <span className="text-sm text-blue-600 flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  Saving...
                </span>
              )}
              {saveSuccess && !isSaving && (
                <span className="text-sm text-green-600 flex items-center gap-2">
                  ✓ Saved
                </span>
              )}

              <div className="flex items-center justify-center shadow-xl">
                <span className="text-4xl">⚙️</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                  Notification Settings
                </h1>
                <p className="text-gray-500 text-base">
                  Customize how and when you receive notifications
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading settings...</span>
        </div>
      ) : (
        <div className="mx-auto p-3">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            {/* Sidebar Navigation - Professional */}
            <div className="lg:col-span-1">
              <div className="bg-white/95 backdrop-blur-md rounded-sm border border-gray-200 p-7 sticky top-28">
                <h3 className="text-lg font-bold text-gray-900 mb-3 tracking-tight">
                  Settings Categories
                </h3>
                <nav className="space-y-2">
                  {sections.map((section) => (
                    <Button
                      key={section.id}
                      variant={
                        activeSection === section.id ? "primary" : "outline"
                      }
                      className={`w-full text-left px-3 py-0 h-8 font-semibold transition-all duration-200 flex items-center justify-between group ${
                        activeSection === section.id
                          ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-xl"
                          : "text-gray-700 hover:bg-blue-100 hover:text-blue-700"
                      }`}
                      onClick={() => setActiveSection(section.id)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">
                          {section.icon}
                        </span>
                        <span>{section.label}</span>
                      </div>
                      {/* <span
                        className={`text-xs px-2 py-1 rounded-full font-bold ${activeSection === section.id
                          ? "bg-white/30 text-white"
                          : "bg-gray-100 text-gray-600 group-hover:bg-blue-200 group-hover:text-blue-700"
                          }`}
                      >
                        {section.count}
                      </span> */}
                    </Button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Enhanced Content Area */}
            <div className="lg:col-span-3">
              <div className="bg-white/95 backdrop-blur-md rounded-sm border border-gray-200 overflow-hidden">
                {/* Delivery Preferences */}
                {activeSection === "delivery" && (
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-sm flex items-center justify-center">
                        <span className="text-lg">📨</span>
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-gray-900">
                          Delivery Preferences
                        </h2>
                        <p className="text-xs text-gray-600">
                          Choose how you want to receive notifications
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {/* In-App Notifications */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-md p-3 border border-blue-100">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-base">🔔</span>
                              <h3 className="text-sm font-semibold text-gray-900">
                                In-App Notifications
                              </h3>
                            </div>
                            <p className="text-xs text-gray-600 mb-1">
                              Receive notifications in the app bell icon
                            </p>
                            <div className="text-xs text-gray-500">
                              ✓ Real-time alerts and instant updates
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={
                                settings.channels?.in_app?.enabled ?? true
                              }
                              onChange={() => handleChannelToggle("in_app")}
                              className="sr-only peer"
                            />
                            <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-500 peer-checked:to-indigo-600"></div>
                          </label>
                        </div>
                      </div>

                      {/* Email Notifications */}
                      <div
                        className={`bg-gradient-to-r from-emerald-50 to-teal-50 rounded-md p-3 border border-emerald-100 ${!hasAdvancedNotifications ? "opacity-75" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-base">📧</span>
                              <h3 className="text-sm font-semibold text-gray-900">
                                Email Notifications
                              </h3>
                              {!hasAdvancedNotifications && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                  🔒 Upgrade Required
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 mb-1">
                              Receive notifications via email
                            </p>
                            <div className="text-xs text-gray-500">
                              {hasAdvancedNotifications
                                ? "✓ Task assignments, updates, and deadlines"
                                : "⚡ Available on Plan, Execute, or Optimize tiers"}
                            </div>
                          </div>
                          <label
                            className={`relative inline-flex items-center ${hasAdvancedNotifications ? "cursor-pointer" : "cursor-not-allowed"}`}
                          >
                            <input
                              type="checkbox"
                              checked={
                                settings.channels?.email?.enabled ?? false
                              }
                              onChange={() => handleChannelToggle("email")}
                              disabled={!hasAdvancedNotifications}
                              className="sr-only peer"
                            />
                            <div
                              className={`w-10 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all ${hasAdvancedNotifications ? "peer-checked:bg-gradient-to-r peer-checked:from-blue-500 peer-checked:to-indigo-600" : "peer-checked:bg-gray-400"}`}
                            ></div>
                          </label>
                        </div>

                        {/* Email Frequency Selector */}
                        {settings.channels?.email?.enabled &&
                          hasAdvancedNotifications && (
                            <div className="mt-3 pt-3 border-t border-emerald-200">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Email Frequency
                              </label>
                              <select
                                value={
                                  settings.channels?.email?.frequency ||
                                  "real_time"
                                }
                                onChange={(e) =>
                                  handleFrequencyChange("email", e.target.value)
                                }
                                className="form-select h-8 text-sm w-full max-w-xs"
                              >
                                <option value="real_time">
                                  Immediate (Real-time)
                                </option>
                                <option value="digest_daily">
                                  Daily Digest
                                </option>
                                <option value="digest_weekly">
                                  Weekly Digest
                                </option>
                                <option value="off">Off</option>
                              </select>
                            </div>
                          )}
                      </div>

                      {/* Push Notifications */}
                      {/* <div className={`bg-gradient-to-r from-purple-50 to-pink-50 rounded-md p-4 border border-purple-100 ${!hasAdvancedNotifications ? 'opacity-75' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-base">📱</span>
                              <h3 className="text-base font-semibold text-gray-900">
                                Push Notifications
                              </h3>
                              {!hasAdvancedNotifications && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                  🔒 Upgrade Required
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              Receive browser/mobile push notifications
                            </p>
                            <div className="text-xs text-gray-500">
                              {hasAdvancedNotifications
                                ? '✓ Instant alerts even when app is closed'
                                : '⚡ Available on Plan, Execute, or Optimize tiers'}
                            </div>
                          </div>
                          <label className={`relative inline-flex items-center ${hasAdvancedNotifications ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                            <input
                              type="checkbox"
                              checked={settings.channels?.push?.enabled ?? false}
                              onChange={() => handleChannelToggle("push")}
                              disabled={!hasAdvancedNotifications}
                              className="sr-only peer"
                            />
                            <div className={`w-10 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all ${hasAdvancedNotifications ? 'peer-checked:bg-gradient-to-r peer-checked:from-blue-500 peer-checked:to-indigo-600' : 'peer-checked:bg-gray-400'}`}></div>
                          </label>
                        </div>
                      </div> */}
                    </div>
                  </div>
                )}

                {/* Event Type Preferences */}
                {activeSection === "events" && (
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-500 rounded-sm flex items-center justify-center">
                        <span className="text-lg">🎯</span>
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">
                          Event Type Preferences
                        </h2>
                        <p className="text-sm text-gray-600">
                          Choose which events trigger notifications
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {/* Task Events */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-md p-4 border border-blue-100">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <span>📋</span> Task Events
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {[
                            {
                              key: "task_assigned",
                              label: "Task Assigned",
                              desc: "When a task is assigned to you",
                            },
                            {
                              key: "task_due_soon",
                              label: "Due Date Reminders",
                              desc: "Before tasks are due",
                            },
                            {
                              key: "task_overdue",
                              label: "Overdue Alerts",
                              desc: "When tasks become overdue",
                            },
                            {
                              key: "task_status_changed",
                              label: "Status Changes",
                              desc: "When task status updates",
                            },
                          ].map(({ key, label, desc }) => (
                            <label
                              key={key}
                              className="flex items-start gap-3 cursor-pointer p-2 hover:bg-white/50 rounded-sm"
                            >
                              <input
                                type="checkbox"
                                checked={
                                  settings.event_preferences?.[key] ?? true
                                }
                                onChange={() => handleEventToggle(key)}
                                className="mt-1 w-4 h-4 text-blue-600 rounded"
                              />
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {label}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {desc}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Comment Events */}
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-md p-4 border border-green-100">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <span>💬</span> Comments
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {[
                            {
                              key: "comment_added",
                              label: "New Comments",
                              desc: "When comments are added to your tasks",
                            },
                          ].map(({ key, label, desc }) => (
                            <label
                              key={key}
                              className="flex items-start gap-3 cursor-pointer p-2 hover:bg-white/50 rounded-sm"
                            >
                              <input
                                type="checkbox"
                                checked={
                                  settings.event_preferences?.[key] ?? true
                                }
                                onChange={() => handleEventToggle(key)}
                                className="mt-1 w-4 h-4 text-green-600 rounded"
                              />
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {label}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {desc}
                                </div>
                              </div>
                            </label>
                          ))}
                          {/* Mentions - hidden for individual users only */}
                          {userRole !== "individual" && (
                            <label className="flex items-start gap-3 cursor-pointer p-2 hover:bg-white/50 rounded-sm">
                              <input
                                type="checkbox"
                                checked={
                                  settings.event_preferences?.[
                                    "user_mentioned"
                                  ] ?? true
                                }
                                onChange={() =>
                                  handleEventToggle("user_mentioned")
                                }
                                className="mt-1 w-4 h-4 text-green-600 rounded"
                              />
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  Mentions
                                </div>
                                <div className="text-xs text-gray-500">
                                  When someone mentions you in a task or comment
                                </div>
                              </div>
                            </label>
                          )}
                        </div>
                      </div>

                      {/* Approval Events - hidden for individual users only */}
                      {userRole !== "individual" && (
                        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-md p-4 border border-amber-100">
                          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <span>✅</span> Approval Events
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {[
                              {
                                key: "approval_requested",
                                label: "Approval Requested",
                                desc: "When a task approval is requested from you",
                              },
                              {
                                key: "approval_approved",
                                label: "Task Approved",
                                desc: "When your task gets approved",
                              },
                              {
                                key: "approval_denied",
                                label: "Task Rejected",
                                desc: "When your task gets rejected",
                              },
                            ].map(({ key, label, desc }) => (
                              <label
                                key={key}
                                className="flex items-start gap-3 cursor-pointer p-2 hover:bg-white/50 rounded-sm"
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    settings.event_preferences?.[key] ?? true
                                  }
                                  onChange={() => handleEventToggle(key)}
                                  className="mt-1 w-4 h-4 text-amber-600 rounded"
                                />
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {label}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {desc}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Due Date Reminders */}
                {activeSection === "reminders" && (
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">⏰</span>
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">
                          Due Date Reminders
                        </h2>
                        <p className="text-sm text-gray-600">
                          Get reminded before tasks are due
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-md p-3 border border-orange-100">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">📅</span>
                            <div>
                              <h3 className="text-sm font-semibold text-gray-900">
                                Enable due date reminders
                              </h3>
                              <p className="text-sm text-gray-600">
                                Receive reminders before tasks are due
                              </p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={
                                settings.dueDateReminders?.enabled ?? true
                              }
                              onChange={async () => {
                                const newSettings = {
                                  ...settings,
                                  dueDateReminders: {
                                    ...settings.dueDateReminders,
                                    enabled: !(
                                      settings.dueDateReminders?.enabled ?? true
                                    ),
                                  },
                                };
                                await onSettingsChange(newSettings);
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-3 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-orange-500 peer-checked:to-red-600"></div>
                          </label>
                        </div>

                        {(settings.dueDateReminders?.enabled ?? true) && (
                          <div className="space-y-3 pt-3 border-t border-orange-200">
                            <div className="space-y-2">
                              <div className="flex items-center gap-1">
                                <span>⏱️</span>
                                <h4 className="text-sm font-semibold text-gray-900">
                                  Remind me:
                                </h4>
                              </div>

                              <div className="flex items-center gap-2">
                                {[
                                  { days: 7, label: "7 days", desc: "Week" },
                                  {
                                    days: 3,
                                    label: "3 days",
                                    desc: "Few days",
                                  },
                                  { days: 1, label: "1 day", desc: "Last min" },
                                ].map(({ days, label, desc }) => {
                                  const isSelected =
                                    settings.dueDateReminders?.daysBeforeDue?.includes(
                                      days,
                                    );
                                  return (
                                    <label
                                      key={days}
                                      className="relative block"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() =>
                                          handleDueDateReminderChange(days)
                                        }
                                        className="sr-only"
                                      />

                                      <div
                                        className={`border bg-white rounded-md p-1.5 transition-all cursor-pointer ${
                                          isSelected
                                            ? "border-orange-500 bg-orange-50"
                                            : "border-gray-200 hover:border-orange-300"
                                        }`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <div className="text-sm font-medium text-gray-900">
                                              {label}
                                            </div>
                                            <div className="text-xs text-gray-600">
                                              {desc}
                                            </div>
                                          </div>
                                          <div
                                            className={`w-3 h-3 border rounded flex items-center justify-center ${
                                              isSelected
                                                ? "border-orange-500 bg-orange-500"
                                                : "border-gray-300"
                                            }`}
                                          >
                                            {isSelected && (
                                              <svg
                                                className="w-2 h-2 text-white"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                              >
                                                <path
                                                  fillRule="evenodd"
                                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                  clipRule="evenodd"
                                                />
                                              </svg>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center gap-1">
                                <span>🕘</span>
                                <h4 className="text-sm font-semibold text-gray-900">
                                  Reminder time:
                                </h4>
                              </div>
                              <div className="bg-white rounded-md border border-gray-200 p-1.5 w-fit">
                                <input
                                  type="time"
                                  value={
                                    settings.dueDateReminders?.time || "09:00"
                                  }
                                  onChange={async (e) => {
                                    const newSettings = {
                                      ...settings,
                                      dueDateReminders: {
                                        ...settings.dueDateReminders,
                                        time: e.target.value,
                                      },
                                    };
                                    await onSettingsChange(newSettings);
                                  }}
                                  className="text-sm font-medium text-gray-900 bg-transparent border-none outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Snooze Wake-up Reminders */}
                      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-md p-3 border border-purple-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">😴</span>
                            <div>
                              <h3 className="text-sm font-semibold text-gray-900">
                                Snooze Wake-up Notifications
                              </h3>
                              <p className="text-sm text-gray-600">
                                Get notified when snoozed tasks wake up
                              </p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={
                                settings.event_preferences?.task_reminder ??
                                true
                              }
                              onChange={() =>
                                handleEventToggle("task_reminder")
                              }
                              className="sr-only peer"
                            />
                            <div className="w-8 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-3 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-500 peer-checked:to-indigo-600"></div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Advanced Settings */}
                {activeSection === "advanced" && (
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">⚙️</span>
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">
                          Advanced Settings
                        </h2>
                        <p className="text-sm text-gray-600">
                          Fine-tune your notification preferences
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {/* Quiet Hours */}
                      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-md p-3 border border-purple-100">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                              <span>🔕</span>
                              Quiet Hours
                            </h3>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={
                                  settings.channels?.in_app?.quiet_hours
                                    ?.enabled ?? false
                                }
                                onChange={() =>
                                  handleQuietHoursChange(
                                    "in_app",
                                    "enabled",
                                    !(
                                      settings.channels?.in_app?.quiet_hours
                                        ?.enabled ?? false
                                    ),
                                  )
                                }
                                className="sr-only peer"
                              />
                              <div className="w-8 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-3 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-500 peer-checked:to-indigo-600"></div>
                            </label>
                          </div>
                          <p className="text-sm text-gray-600">
                            Set times when you don't want to receive
                            notifications
                          </p>
                          {settings.channels?.in_app?.quiet_hours?.enabled && (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Start time
                                </label>
                                <input
                                  type="time"
                                  value={
                                    settings.channels?.in_app?.quiet_hours
                                      ?.start || "22:00"
                                  }
                                  onChange={(e) =>
                                    handleQuietHoursChange(
                                      "in_app",
                                      "start",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full h-8 text-sm border border-gray-200 rounded-md px-2 py-0"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  End time
                                </label>
                                <input
                                  type="time"
                                  value={
                                    settings.channels?.in_app?.quiet_hours
                                      ?.end || "08:00"
                                  }
                                  onChange={(e) =>
                                    handleQuietHoursChange(
                                      "in_app",
                                      "end",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full h-8 text-sm border border-gray-200 rounded-md px-2 py-0"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Digest Settings */}
                      <div
                        className={`bg-gradient-to-r from-green-50 to-emerald-50 rounded-md p-3 border border-green-100 ${!hasAdvancedNotifications ? "opacity-75" : ""}`}
                      >
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                            <span>📊</span>
                            Digest Settings
                            {!hasAdvancedNotifications && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 ml-2">
                                🔒 Upgrade Required
                              </span>
                            )}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {hasAdvancedNotifications
                              ? "Receive summary notifications instead of individual ones"
                              : "Email digest options require an upgraded plan"}
                          </p>
                          <div className="flex flex-col gap-2 mt-2">
                            {[
                              {
                                value: "real_time",
                                label: "Send notifications immediately",
                              },
                              { value: "digest_daily", label: "Daily digest" },
                              {
                                value: "digest_weekly",
                                label: "Weekly digest",
                              },
                            ].map(({ value, label }) => (
                              <label
                                key={value}
                                className={`flex items-center gap-2 ${hasAdvancedNotifications ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                              >
                                <input
                                  type="radio"
                                  name="digest"
                                  value={value}
                                  checked={
                                    (settings.channels?.email?.frequency ||
                                      "real_time") === value
                                  }
                                  onChange={(e) =>
                                    hasAdvancedNotifications &&
                                    handleFrequencyChange(
                                      "email",
                                      e.target.value,
                                    )
                                  }
                                  disabled={!hasAdvancedNotifications}
                                  className="w-3 h-3 text-green-600"
                                />
                                <span className="text-sm text-gray-700">
                                  {label}
                                </span>
                              </label>
                            ))}
                          </div>

                          {/* Digest Time Settings */}
                          {settings.channels?.email?.frequency ===
                            "digest_daily" &&
                            hasAdvancedNotifications && (
                              <div className="mt-3 pt-3 border-t border-green-200">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Daily digest time
                                </label>
                                <input
                                  type="time"
                                  value={
                                    settings.digest_settings
                                      ?.daily_digest_time || "09:00"
                                  }
                                  onChange={(e) =>
                                    handleDigestChange(
                                      "daily_digest_time",
                                      e.target.value,
                                    )
                                  }
                                  className="h-8 text-sm border border-gray-200 rounded-md px-2 py-0"
                                />
                              </div>
                            )}

                          {settings.channels?.email?.frequency ===
                            "digest_weekly" &&
                            hasAdvancedNotifications && (
                              <div className="mt-3 pt-3 border-t border-green-200 space-y-2">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Weekly digest day
                                  </label>
                                  <select
                                    value={
                                      settings.digest_settings
                                        ?.weekly_digest_day || "monday"
                                    }
                                    onChange={(e) =>
                                      handleDigestChange(
                                        "weekly_digest_day",
                                        e.target.value,
                                      )
                                    }
                                    className="h-8 text-sm border border-gray-200 rounded-md px-2 py-0"
                                  >
                                    {[
                                      "monday",
                                      "tuesday",
                                      "wednesday",
                                      "thursday",
                                      "friday",
                                      "saturday",
                                      "sunday",
                                    ].map((day) => (
                                      <option key={day} value={day}>
                                        {day.charAt(0).toUpperCase() +
                                          day.slice(1)}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Weekly digest time
                                  </label>
                                  <input
                                    type="time"
                                    value={
                                      settings.digest_settings
                                        ?.weekly_digest_time || "09:00"
                                    }
                                    onChange={(e) =>
                                      handleDigestChange(
                                        "weekly_digest_time",
                                        e.target.value,
                                      )
                                    }
                                    className="h-8 text-sm border border-gray-200 rounded-md px-2 py-0"
                                  />
                                </div>
                              </div>
                            )}
                        </div>
                      </div>

                      {/* Timezone Settings */}
                      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-md p-3 border border-blue-100">
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                            <span>🌍</span>
                            Time Zone
                          </h3>
                          <p className="text-sm text-gray-600">
                            Set your timezone for accurate notification timing
                          </p>
                          <select
                            value={settings.timezone || "Asia/Kolkata"}
                            onChange={async (e) => {
                              const newSettings = {
                                ...settings,
                                timezone: e.target.value,
                              };
                              await onSettingsChange(newSettings);
                            }}
                            className="w-full h-8 text-sm border border-gray-200 rounded-md px-2"
                          >
                            {getTimezoneOptions().map((tz) => (
                              <option key={tz.value} value={tz.value}>
                                {tz.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Master Toggle */}
                      <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-md p-3 border border-red-100">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-sm">🚫</span>
                              <h3 className="text-sm font-semibold text-gray-900">
                                Pause All Notifications
                              </h3>
                            </div>
                            <p className="text-sm text-gray-600">
                              Temporarily disable all notifications
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={
                                !(settings.notifications_enabled ?? true)
                              }
                              onChange={async () => {
                                const newSettings = {
                                  ...settings,
                                  notifications_enabled: !(
                                    settings.notifications_enabled ?? true
                                  ),
                                };
                                await onSettingsChange(newSettings);
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-3 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-red-500 peer-checked:to-pink-600"></div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal for Advanced Notifications */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-sm p-7 max-w-md mx-4 border border-gray-200">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                <span className="text-4xl">🔒</span>
              </div>
              <h3 className="text-2xl font-extrabold text-gray-900 mb-3">
                Upgrade Required
              </h3>
              <p className="text-gray-600 mb-3 text-base">
                Advanced notifications (Email, Push, SMS) require an upgraded
                plan.
                <br />
                You are currently on the{" "}
                <span className="font-semibold text-amber-600">
                  {licenseTier}
                </span>{" "}
                tier.
              </p>
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 mb-7 border border-blue-100">
                <h4 className="font-bold text-gray-900 mb-3">
                  With Plan tier and above, you get:
                </h4>
                <ul className="text-base text-gray-700 space-y-2 text-left">
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    Email notifications for all events
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    Push notifications (browser/mobile)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    Customizable notification schedules
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    Daily & weekly digest options
                  </li>
                </ul>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-8 rounded-2xl"
                  onClick={() => setShowUpgradeModal(false)}
                >
                  Maybe Later
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-2xl font-bold shadow-md"
                  onClick={() => {
                    setShowUpgradeModal(false);
                    window.location.href = "/settings/license";
                  }}
                >
                  Upgrade Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
