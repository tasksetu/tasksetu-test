import React, { useState, useEffect } from "react";
import {
  Bell,
  Settings,
  X,
  Check,
  AlertCircle,
  Info,
  CheckCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useShowToast } from "@/utils/ToastMessage";

const NotificationCenter = () => {
  const [notifications, setNotifications] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const { showSuccessToast, showErrorToast } = useShowToast();
  const [settings, setSettings] = useState({
    notifications_enabled: true,
    channels: {
      in_app: { enabled: true, frequency: "real_time" },
      email: { enabled: true, frequency: "digest_daily" },
      push: { enabled: false, frequency: "real_time" },
      sms: { enabled: false, frequency: "off" },
    },
    event_preferences: {
      task_assigned: true,
      task_due_soon: true,
      task_due_today: true,
      task_overdue: true,
      task_completed: false,
      task_status_changed: true,
      task_reassigned: true,
      task_updated: false,
      task_commented: true,
      task_reminder: true,
      project_assigned: true,
      project_updated: false,
      project_completed: true,
      system_maintenance: true,
      security_alert: true,
      feature_announcement: false,
    },
  });
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Mock API functions - replace with actual API calls
  const apiCall = async (endpoint, options = {}) => {
    const token = localStorage.getItem("token");
    const response = await fetch(`/api${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.statusText}`);
    }

    return response.json();
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const response = await apiCall("/notifications?page=1&limit=20");
      setNotifications(response.data || []);
      setUnreadCount(response.unread_count || 0);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  // Fetch notification settings
  const fetchSettings = async () => {
    try {
      const response = await apiCall("/notification-settings");
      setSettings(response.data);
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      await apiCall(`/notifications/${notificationId}/read`, { method: "PUT" });
      setNotifications((prev) =>
        prev.map((notif) =>
          notif._id === notificationId
            ? { ...notif, is_read: true, read_at: new Date().toISOString() }
            : notif,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark as read:", error);
      showErrorToast("Unable to mark notification as read");
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await apiCall("/notifications/read-all", { method: "PUT" });
      setNotifications((prev) =>
        prev.map((notif) => ({
          ...notif,
          is_read: true,
          read_at: new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      showErrorToast("Unable to mark all notifications as read");
    }
  };

  // Update notification settings
  const updateSettings = async (newSettings) => {
    setLoading(true);
    try {
      const response = await apiCall("/notification-settings", {
        method: "PUT",
        body: JSON.stringify(newSettings),
      });
      setSettings(response.data);
      showSuccessToast("Settings updated");
    } catch (error) {
      console.error("Failed to update settings:", error);
      showErrorToast("Unable to update settings");
    } finally {
      setLoading(false);
    }
  };

  // Send test notification
  const sendTestNotification = async () => {
    try {
      await apiCall("/notification-settings/test", {
        method: "POST",
        body: JSON.stringify({
          channels: ["in_app", "email"],
        }),
      });
      // Refresh notifications after sending test
      setTimeout(fetchNotifications, 1000);
      showSuccessToast("Test notification sent");
    } catch (error) {
      console.error("Failed to send test notification:", error);
      showErrorToast("Unable to send test notification");
    }
  };

  // Get notification icon based on trigger event
  const getNotificationIcon = (triggerEvent) => {
    const icons = {
      task_assigned: <Info className="w-4 h-4 text-blue-500" />,
      task_due_soon: <AlertCircle className="w-4 h-4 text-yellow-500" />,
      task_due_today: <AlertCircle className="w-4 h-4 text-orange-500" />,
      task_overdue: <AlertCircle className="w-4 h-4 text-red-500" />,
      task_completed: <CheckCircle className="w-4 h-4 text-green-500" />,
      system_test: <Info className="w-4 h-4 text-purple-500" />,
    };

    return icons[triggerEvent] || <Bell className="w-4 h-4 text-gray-500" />;
  };

  // Get priority styles
  const getPriorityStyles = (priority) => {
    return priority === "urgent"
      ? "border-l-4 border-red-500 bg-red-50"
      : "border-l-4 border-blue-500 bg-blue-50";
  };

  // Format time
  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  useEffect(() => {
    fetchNotifications();
    fetchSettings();

    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setNotifications([])}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        title="Notifications"
      >
        <Bell className="w-6 h-6 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Settings Button */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="ml-2 p-2 rounded-full hover:bg-gray-100 transition-colors"
        title="Notification Settings"
      >
        <Settings className="w-5 h-5 text-gray-600" />
      </button>

      {/* Notification Panel */}
      <AnimatePresence>
        {notifications.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 top-full mt-2 w-96 bg-white rounded-sm shadow-lg border z-50"
          >
            <div className="p-4 border-b">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-900">Notifications</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-800"
                    disabled={unreadCount === 0}
                  >
                    Mark all read
                  </button>
                  <button
                    onClick={() => setNotifications([])}
                    className="p-1 rounded hover:bg-gray-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`p-4 border-b hover:bg-gray-50 cursor-pointer ${
                    !notification.is_read ? "bg-blue-50" : ""
                  } ${getPriorityStyles(notification.priority)}`}
                  onClick={() =>
                    !notification.is_read && markAsRead(notification._id)
                  }
                >
                  <div className="flex items-start gap-3">
                    {getNotificationIcon(notification.trigger_event)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">
                        {notification.title}
                      </p>
                      <p className="text-gray-600 text-sm mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        {formatTime(notification.created_at)}
                      </p>
                      {!notification.is_read && (
                        <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mt-2"></span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={sendTestNotification}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Send Test Notification
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 top-full mt-2 w-96 bg-white rounded-sm shadow-lg border z-50"
          >
            <div className="p-4 border-b">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-900">
                  Notification Settings
                </h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1 rounded hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto p-4 space-y-3">
              {/* Master Toggle */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Enable Notifications
                </label>
                <input
                  type="checkbox"
                  checked={settings.notifications_enabled}
                  onChange={(e) =>
                    updateSettings({
                      ...settings,
                      notifications_enabled: e.target.checked,
                    })
                  }
                  className="rounded"
                  disabled={loading}
                />
              </div>

              {/* Channel Settings */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Delivery Channels
                </h4>
                <div className="space-y-3">
                  {Object.entries(settings.channels).map(
                    ([channel, config]) => (
                      <div
                        key={channel}
                        className="flex items-center justify-between"
                      >
                        <label className="text-sm text-gray-600 capitalize">
                          {channel.replace("_", " ")}
                        </label>
                        <div className="flex items-center gap-2">
                          <select
                            value={config.frequency}
                            onChange={(e) =>
                              updateSettings({
                                ...settings,
                                channels: {
                                  ...settings.channels,
                                  [channel]: {
                                    ...config,
                                    frequency: e.target.value,
                                  },
                                },
                              })
                            }
                            className="text-xs border rounded px-2 py-1"
                            disabled={loading || !config.enabled}
                          >
                            <option value="real_time">Real Time</option>
                            <option value="digest_daily">Daily Digest</option>
                            <option value="digest_weekly">Weekly Digest</option>
                            <option value="off">Off</option>
                          </select>
                          <input
                            type="checkbox"
                            checked={config.enabled}
                            onChange={(e) =>
                              updateSettings({
                                ...settings,
                                channels: {
                                  ...settings.channels,
                                  [channel]: {
                                    ...config,
                                    enabled: e.target.checked,
                                  },
                                },
                              })
                            }
                            className="rounded"
                            disabled={loading}
                          />
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>

              {/* Event Preferences - Show only key ones */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Event Types
                </h4>
                <div className="space-y-2">
                  {[
                    "task_assigned",
                    "task_due_soon",
                    "task_overdue",
                    "task_completed",
                    "task_reminder",
                  ].map((event) => (
                    <div
                      key={event}
                      className="flex items-center justify-between"
                    >
                      <label className="text-sm text-gray-600 capitalize">
                        {event.replace(/_/g, " ")}
                      </label>
                      <input
                        type="checkbox"
                        checked={settings.event_preferences[event]}
                        onChange={(e) =>
                          updateSettings({
                            ...settings,
                            event_preferences: {
                              ...settings.event_preferences,
                              [event]: e.target.checked,
                            },
                          })
                        }
                        className="rounded"
                        disabled={loading}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {loading && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationCenter;
