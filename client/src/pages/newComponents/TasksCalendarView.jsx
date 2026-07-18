import React, { useState } from "react";
import { useShowToast } from "@/utils/ToastMessage";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
export default function TasksCalendarView({
  tasks,
  onTaskClick,
  onClose,
  onDateSelect,
  onDueDateFilter,
}) {
  const { showSuccessToast, showErrorToast } = useShowToast();
  // Set initial date to current month instead of January 2024
  const [currentDate, setCurrentDate] = useState(new Date()); // Current date
  const [viewMode, setViewMode] = useState("month"); // month, week, day
  const [selectedDate, setSelectedDate] = useState(null);
  const [isGoogleCalendarConnected, setIsGoogleCalendarConnected] =
    useState(false);
  const [googleCalendarStatus, setGoogleCalendarStatus] =
    useState("disconnected"); // disconnected, connecting, connected, error
  const [syncErrors, setSyncErrors] = useState([]);
  const [isExporting, setIsExporting] = useState(false);

  // For debugging: Empty initial state for production
  const sampleTasks = [];

  // Use provided tasks or sample tasks for debugging
  const effectiveTasks = tasks && tasks.length > 0 ? tasks : sampleTasks;

  // Generate recurring task instances
  const generateRecurringTaskInstances = (task, startDate, endDate) => {
    if (!task.isRecurring || !task.recurringPattern) return [task];

    const instances = [];
    const pattern = task.recurringPattern;
    let currentDate = new Date(task.dueDate || task.createdAt);

    while (currentDate <= endDate && instances.length < 100) {
      // Limit to prevent infinite loops
      if (currentDate >= startDate) {
        instances.push({
          ...task,
          id: `${task.id}_${currentDate.toISOString().split("T")[0]}`,
          dueDate: currentDate.toISOString().split("T")[0],
          isRecurringInstance: true,
          originalTaskId: task.id,
        });
      }

      // Calculate next occurrence based on pattern
      switch (pattern.type) {
        case "daily":
          currentDate.setDate(currentDate.getDate() + (pattern.interval || 1));
          break;
        case "weekly":
          currentDate.setDate(
            currentDate.getDate() + (pattern.interval || 1) * 7,
          );
          break;
        case "monthly":
          currentDate.setMonth(
            currentDate.getMonth() + (pattern.interval || 1),
          );
          break;
        case "yearly":
          currentDate.setFullYear(
            currentDate.getFullYear() + (pattern.interval || 1),
          );
          break;
        default:
          break;
      }
    }

    return instances;
  };

  // Filter tasks to show all tasks with due dates (for calendar view) including recurring instances
  const getTasksWithDueDates = () => {
    const startDate = new Date(currentDate);
    startDate.setMonth(startDate.getMonth() - 1); // Show 1 month before for recurring tasks
    const endDate = new Date(currentDate);
    endDate.setMonth(endDate.getMonth() + 2); // Show 2 months after for recurring tasks

    const allTasks = [];

    effectiveTasks.forEach((task) => {
      if (task.dueDate) {
        if (task.isRecurring) {
          // Generate recurring instances only within the date range
          const instances = generateRecurringTaskInstances(
            task,
            startDate,
            endDate,
          );
          allTasks.push(...instances);
        } else {
          // For regular tasks, include all tasks regardless of date range
          // This allows users to navigate to any month and see their tasks
          allTasks.push(task);
        }
      }
    });

    return allTasks;
  };

  const tasksWithDueDates = getTasksWithDueDates();

  // Utility function to format date as YYYY-MM-DD without timezone issues
  const formatDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  // Add debugging at the top of the component
  console.log("=== TASKS CALENDAR DEBUG ===");
  console.log("Original tasks:", tasks?.length || 0);
  console.log("Effective tasks (with samples):", effectiveTasks?.length || 0);
  console.log(
    "Tasks with due dates:",
    effectiveTasks?.filter((task) => task.dueDate)?.length || 0,
  );
  console.log(
    "Current calendar date:",
    currentDate.toISOString().split("T")[0],
  );
  console.log(
    "Current month/year:",
    `${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`,
  );
  console.log(
    "All task due dates (raw):",
    effectiveTasks
      ?.filter((task) => task.dueDate)
      ?.map((task) => ({
        title: task.title,
        originalDueDate: task.dueDate,
        dateType: typeof task.dueDate,
        parsedDate: new Date(task.dueDate),
        normalizedDate: task.dueDate
          ? (() => {
              try {
                const d = new Date(task.dueDate);
                return isNaN(d.getTime())
                  ? "INVALID"
                  : d.toISOString().split("T")[0];
              } catch (e) {
                return "ERROR";
              }
            })()
          : null,
      })),
  );
  console.log("tasksWithDueDates count:", tasksWithDueDates.length);

  // Enhanced date normalization function
  const normalizeDateString = (dateInput) => {
    if (!dateInput) return null;

    try {
      // Handle different date formats
      let date;

      if (typeof dateInput === "string") {
        // Handle formats like "17 Oct 2025", "2025-10-17", etc.
        date = new Date(dateInput);
      } else if (dateInput instanceof Date) {
        date = dateInput;
      } else {
        return null;
      }

      if (isNaN(date.getTime())) return null;

      // Return in YYYY-MM-DD format
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.warn("Error normalizing date:", dateInput, error);
      return null;
    }
  };

  const getTasksForDate = (date) => {
    if (!date) return [];
    const dateStr = formatDateString(date);

    const matchingTasks = tasksWithDueDates.filter((task) => {
      if (!task.dueDate) return false;

      // Normalize the task due date to YYYY-MM-DD format
      const normalizedTaskDate = normalizeDateString(task.dueDate);
      const isMatch = normalizedTaskDate === dateStr;

      return isMatch;
    });

    // Enhanced debug logging for first few dates of the month
    const dayOfMonth = date.getDate();
    if (dayOfMonth <= 5) {
      console.log(`\n=== DATE MATCHING DEBUG for ${dateStr} ===`);
      console.log("Calendar date:", dateStr);
      console.log(
        "Checking against tasks with due dates:",
        tasksWithDueDates.map((t) => ({
          title: t.title,
          originalDueDate: t.dueDate,
          normalizedDueDate: normalizeDateString(t.dueDate),
        })),
      );
      console.log(
        "Matching tasks found:",
        matchingTasks.length,
        matchingTasks.map((t) => t.title),
      );
    }

    return matchingTasks;
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const navigateWeek = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction * 7);
    setCurrentDate(newDate);
  };

  const navigateDay = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction);
    setCurrentDate(newDate);
  };

  const getWeekDays = (date) => {
    const week = [];
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);

    for (let i = 0; i < 7; i++) {
      const weekDay = new Date(startOfWeek);
      weekDay.setDate(startOfWeek.getDate() + i);
      week.push(weekDay);
    }
    return week;
  };

  const getTasksForDateAndTime = (date, hour = null) => {
    if (!date) return [];
    const dateStr = formatDateString(date);

    // Use the same date matching logic as getTasksForDate for consistency
    const dateTasks = tasksWithDueDates.filter((task) => {
      if (!task.dueDate) return false;

      // Normalize the task due date to YYYY-MM-DD format (same as monthly view)
      const normalizedTaskDate = normalizeDateString(task.dueDate);
      return normalizedTaskDate === dateStr;
    });

    // Debug logging for week/day view task matching (only for today and specific dates)
    const today = new Date();
    if (
      date.toDateString() === today.toDateString() ||
      date.getDate() === 8 ||
      date.getDate() === 10 ||
      date.getDate() === 17
    ) {
      console.log(`\n=== WEEK/DAY VIEW DEBUG for ${dateStr} ===`);
      console.log("Date object:", date);
      console.log("Formatted date string:", dateStr);
      console.log(
        "Tasks found for this date:",
        dateTasks.length,
        dateTasks.map((t) => ({
          title: t.title,
          originalDueDate: t.dueDate,
          normalizedDueDate: normalizeDateString(t.dueDate),
        })),
      );
    }

    if (hour !== null) {
      // Filter by time if task has a specific time
      return dateTasks.filter((task) => {
        if (task.dueTime) {
          const taskHour = parseInt(task.dueTime.split(":")[0]);
          return taskHour === hour;
        }
        // If no specific time, show in 9 AM slot
        return hour === 9;
      });
    }
    return dateTasks;
  };

  const formatTime = (hour) => {
    if (hour === 0) return "12 AM";
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return "12 PM";
    return `${hour - 12} PM`;
  };

  // Enhanced date validation
  const validateDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(date.getTime())) {
      return {
        isValid: false,
        error: "Please select a valid date.",
        type: "invalid",
      };
    }

    if (date < today) {
      return {
        isValid: false,
        error: "Cannot create tasks on past dates.",
        type: "past_due",
      };
    }

    return { isValid: true, type: "valid" };
  };

  const handleDateClick = (date) => {
    if (date) {
      const dateStr = formatDateString(date);
      const tasksForDate = getTasksForDate(date);

      // Check if date is in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const clickedDate = new Date(date);
      clickedDate.setHours(0, 0, 0, 0);
      const isPast = clickedDate < today;

      if (isPast) {
        // Past date: only allow filtering if tasks exist, block task creation
        if (tasksForDate.length > 0 && onDueDateFilter) {
          setSelectedDate(dateStr);
          onDueDateFilter("specific_date", dateStr);
        }
        return;
      }

      // Validate the selected date
      const validation = validateDate(dateStr);

      if (!validation.isValid) {
        showErrorToast(validation.error);
        return;
      }

      setSelectedDate(dateStr);

      if (tasksForDate.length > 0) {
        // Filter tasks in All Tasks table by this specific date
        if (onDueDateFilter) {
          onDueDateFilter("specific_date", dateStr);
        }
      } else {
        // Call the parent's onDateSelect to open create task drawer if no existing tasks
        if (onDateSelect) {
          onDateSelect(dateStr);
        }
      }
    }
  };

  const handleTaskClick = (task) => {
    // Handle both task objects and task IDs
    const taskId = task.id || task._id || task;
    onTaskClick(taskId);
  };

  // Google Calendar Integration Functions
  const handleGoogleCalendarConnect = async () => {
    try {
      setGoogleCalendarStatus("connecting");

      // Check if Google Calendar is properly configured
      const clientId ="798343498792-8pb6s3n9771km4c87di18d4qiprv6obd.apps.googleusercontent.com";

      if (!clientId || clientId === "your-google-client-id") {
        setGoogleCalendarStatus("error");
        showErrorToast(
          "Google Calendar is not configured. Contact administrator.",
        );
        return;
      }

      // Store current tasks and calendar state before redirect
      const calendarData = {
        tasks: tasksWithDueDates,
        currentDate: currentDate.toISOString(),
        viewMode,
        redirectUrl: window.location.href,
      };

      // Store in localStorage for when user returns
      localStorage.setItem("taskCalendarData", JSON.stringify(calendarData));

      // Real Google OAuth implementation
      const redirectUri = encodeURIComponent(
        `${window.location.origin}/google-calendar-callback`,
      );
      console.log("redirect url check ", redirectUri)
      const scope = encodeURIComponent(
        "https://www.googleapis.com/auth/calendar",
      );

      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${redirectUri}&` +
        `response_type=code&` +
        `scope=${scope}&` +
        `access_type=offline&` +
        `prompt=consent`;

      // Open Google Calendar auth in new window
      const authWindow = window.open(
        authUrl,
        "google-calendar-auth",
        "width=500,height=600,scrollbars=yes,resizable=yes",
      );

      if (!authWindow) {
        setGoogleCalendarStatus("error");
        showErrorToast("Popup blocked. Allow popups for this site.");
        return;
      }

      // Listen for auth completion
      const checkClosed = setInterval(() => {
        if (authWindow.closed) {
          clearInterval(checkClosed);
          // Check if auth was successful
          checkGoogleCalendarConnection();
        }
      }, 1000);

      // Listen for messages from the popup
      const messageListener = (event) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.success) {
          clearInterval(checkClosed);
          setIsGoogleCalendarConnected(true);
          setGoogleCalendarStatus("connected");
          window.removeEventListener("message", messageListener);
          showSuccessToast("Google Calendar connected");
        } else if (event.data.error) {
          clearInterval(checkClosed);
          setGoogleCalendarStatus("error");
          window.removeEventListener("message", messageListener);
          showErrorToast(`Failed to connect: ${event.data.error}`);
        }
      };

      window.addEventListener("message", messageListener);

      // Cleanup if window is closed without completion
      setTimeout(() => {
        if (authWindow.closed) {
          clearInterval(checkClosed);
          window.removeEventListener("message", messageListener);
          setGoogleCalendarStatus("disconnected");
        }
      }, 300000); // 5 minutes timeout
    } catch (error) {
      console.error("Google Calendar connection error:", error);
      setGoogleCalendarStatus("error");
      showErrorToast(`Failed to connect to Google Calendar: ${error.message}`);
    }
  };

  const checkGoogleCalendarConnection = async () => {
    try {
      // Check with backend API for real connection status
      const response = await fetch("/api/google-calendar/status", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setIsGoogleCalendarConnected(data.connected);
        setGoogleCalendarStatus(data.connected ? "connected" : "disconnected");

        // If connected, optionally sync tasks
        if (data.connected) {
          await syncTasksWithGoogleCalendar({ access_token: true });
        }
      } else {
        setGoogleCalendarStatus("disconnected");
      }
    } catch (error) {
      console.error("Error checking Google Calendar connection:", error);
      // Fallback to check localStorage for development
      const storedAuth = localStorage.getItem("googleCalendarAuth");
      if (storedAuth) {
        const authData = JSON.parse(storedAuth);
        if (authData.access_token || authData.connected) {
          setIsGoogleCalendarConnected(true);
          setGoogleCalendarStatus("connected");
          return;
        }
      }
      setGoogleCalendarStatus("disconnected");
    }
  };

  const syncTasksWithGoogleCalendar = async (authData) => {
    try {
      // Real API call to sync tasks with Google Calendar
      const response = await fetch("/api/google-calendar/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          tasks: tasksWithDueDates,
          googleAuth: authData,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Tasks synced with Google Calendar:", result);
        return result;
      } else {
        const errorData = await response.json();
        console.error("Failed to sync tasks with Google Calendar");

        // Send email notification for sync errors
        await sendSyncErrorNotification(errorData);
        setSyncErrors((prev) => [
          ...prev,
          {
            timestamp: new Date().toISOString(),
            error: errorData.message || "Sync failed",
            type: "google_calendar_sync",
          },
        ]);
      }
    } catch (error) {
      console.error("Error syncing tasks with Google Calendar:", error);

      // Send email notification for sync errors
      await sendSyncErrorNotification(error);
      setSyncErrors((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          error: error.message,
          type: "google_calendar_sync",
        },
      ]);

      // For development, just log the sync attempt
      console.log(
        "Development mode: Would sync",
        tasksWithDueDates.length,
        "tasks to Google Calendar",
      );
    }
  };

  // Send email notification for sync errors
  const sendSyncErrorNotification = async (error) => {
    try {
      await fetch("/api/notifications/sync-error", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          error: error.message || "External sync error",
          timestamp: new Date().toISOString(),
          service: "Google Calendar",
        }),
      });
    } catch (notificationError) {
      console.error("Failed to send error notification:", notificationError);
    }
  };

  // Export calendar as iCal feed (org-wide) - Client-side generation
  const exportOrgCalendar = async () => {
    setIsExporting(true);

    try {
      // Generate iCal content on the client side
      const icalContent = generateICalContent(tasksWithDueDates);

      // Create and download the file
      const blob = new Blob([icalContent], {
        type: "text/calendar;charset=utf-8",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `org-calendar-${new Date().toISOString().split("T")[0]}.ics`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log("Calendar exported successfully");
      showSuccessToast("Calendar exported");
    } catch (error) {
      console.error("Error exporting calendar:", error);
      showErrorToast("Unable to export calendar");
    } finally {
      setIsExporting(false);
    }
  };

  // Generate iCal format content
  const generateICalContent = (tasks) => {
    const now = new Date();
    const timestamp =
      now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    let icalContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//TaskSetu//Calendar Export//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:TaskSetu Organization Calendar`,
      "X-WR-TIMEZONE:UTC",
      "X-WR-CALDESC:Tasks and deadlines from TaskSetu",
    ];

    tasks.forEach((task, index) => {
      if (!task.dueDate) return;

      const dueDate = new Date(task.dueDate);
      if (isNaN(dueDate.getTime())) return;

      // Format date for iCal (YYYYMMDD)
      const dueDateStr = dueDate.toISOString().split("T")[0].replace(/-/g, "");
      const uid = `task-${task.id || index}-${timestamp}@tasksetu.com`;

      // Determine event type and priority
      const priority =
        task.priority === "high" ? "1" : task.priority === "medium" ? "5" : "9";
      const status = task.completed ? "COMPLETED" : "CONFIRMED";

      icalContent.push(
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${timestamp}`,
        `DTSTART;VALUE=DATE:${dueDateStr}`,
        `DTEND;VALUE=DATE:${dueDateStr}`,
        `SUMMARY:${task.title || "Untitled Task"}`,
        `DESCRIPTION:${task.description || "Task from TaskSetu"}${task.assignee ? `\\nAssigned to: ${task.assignee}` : ""}`,
        `PRIORITY:${priority}`,
        `STATUS:${status}`,
        `CATEGORIES:${task.type || "Task"}`,
        task.completed ? `COMPLETED:${timestamp}` : "",
        "END:VEVENT",
      );
    });

    icalContent.push("END:VCALENDAR");
    return icalContent.filter((line) => line.length > 0).join("\r\n");
  };

  // Generate iCal feed URL for external calendar subscriptions
  const getICalFeedUrl = () => {
    // For now, show instruction to user since we're using client-side generation
    const instruction = `To subscribe to this calendar:
1. Export the calendar using the export button
2. Import the downloaded .ics file into your calendar app
3. For live updates, re-export and re-import periodically

Note: Live feed URLs require server-side implementation.`;

    showSuccessToast(instruction);
    console.log("iCal feed URL requested - showing manual instructions");
    return null;
  };

  const disconnectGoogleCalendar = async () => {
    try {
      // Call backend to disconnect Google Calendar
      const response = await fetch("/api/google-calendar/disconnect", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        localStorage.removeItem("googleCalendarAuth");
        setIsGoogleCalendarConnected(false);
        setGoogleCalendarStatus("disconnected");
        showSuccessToast("Google Calendar disconnected");
      } else {
        console.error("Failed to disconnect from server");
        // Still disconnect locally
        localStorage.removeItem("googleCalendarAuth");
        setIsGoogleCalendarConnected(false);
        setGoogleCalendarStatus("disconnected");
      }
    } catch (error) {
      console.error("Error disconnecting Google Calendar:", error);
      // Fallback to local disconnect
      localStorage.removeItem("googleCalendarAuth");
      setIsGoogleCalendarConnected(false);
      setGoogleCalendarStatus("disconnected");
    }
  };

  // Check Google Calendar connection on component mount
  React.useEffect(() => {
    checkGoogleCalendarConnection();
  }, []);

  const getPriorityColor = (priority) => {
    const colors = {
      Low: "bg-green-100 text-green-800 border-green-300",
      Medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
      High: "bg-orange-100 text-orange-800 border-orange-300",
      Urgent: "bg-red-100 text-red-800 border-red-300",
    };
    return colors[priority] || "bg-gray-100 text-gray-800 border-gray-300";
  };

  // New function for task type color coding (Google Calendar style)
  const getTaskTypeColor = (task) => {
    // Check if task is overdue
    const today = formatDateString(new Date());
    const isOverdue = task.dueDate < today && task.status !== "completed";

    if (isOverdue) {
      return "bg-red-100 text-red-800 border-red-500"; // Overdue = Light Red with Red border
    }

    if (task.isApprovalTask) {
      return "bg-purple-100 text-purple-800 border-purple-500"; // Approval = Light Purple with Purple border
    }

    if (task.type === "milestone") {
      return "bg-yellow-100 text-yellow-800 border-yellow-500"; // Milestone = Light Yellow with Yellow border
    }

    return "bg-blue-100 text-blue-800 border-blue-500"; // Normal = Light Blue with Blue border
  };

  // Function to get completed task styling
  const getCompletedTaskStyle = (task) => {
    if (task.status === "completed") {
      return "opacity-60 line-through";
    }
    return "";
  };

  const getTaskTypeIcon = (task) => {
    if (task.isApprovalTask) return "A";
    if (task.isRecurring || task.recurringFromTaskId) return "R";
    if (task.type === "milestone") return "M";
    return "T";
  };

  // TaskEventBar component for displaying tasks like Google Calendar events
  const TaskEventBar = ({ task, onClick, size = "normal" }) => {
    console.log("Rendering TaskEventBar for task:", task.title, "size:", size);

    const baseClasses =
      "rounded-sm cursor-pointer hover:opacity-90 transition-all duration-200 flex items-center font-medium border-l-4 shadow-sm overflow-hidden";
    const completedClasses = getCompletedTaskStyle(task);
    const typeColor = getTaskTypeColor(task);

    // Consistent sizing for different views
    const sizeClasses =
      size === "small"
        ? "text-xs px-1.5 py-0.5 h-5 min-h-[20px]"
        : "text-sm px-3 py-2 h-6 min-h-[24px]";

    // Get task type icon (single character for small view)
    const getTaskTypeIcon = () => {
      if (task.isApprovalTask) return size === "small" ? "A" : "🟣";
      if (task.type === "milestone") return size === "small" ? "M" : "⭐";
      if (task.isRecurring || task.recurringFromTaskId)
        return size === "small" ? "R" : "🔄";
      return size === "small" ? "T" : "";
    };

    // Get priority color for border
    const getPriorityBorderColor = () => {
      switch (task.priority?.toLowerCase()) {
        case "urgent":
          return "border-l-red-500";
        case "high":
          return "border-l-orange-500";
        case "medium":
          return "border-l-yellow-500";
        case "low":
          return "border-l-green-500";
        default:
          return "border-l-blue-500";
      }
    };

    return (
      <div
        className={`${baseClasses} ${sizeClasses} ${typeColor} ${completedClasses} ${getPriorityBorderColor()}`}
        onClick={(e) => {
          e.stopPropagation();
          onClick(task);
        }}
        title={`${task.title} - ${task.priority} Priority - Assigned to: ${task.assignee || "Unassigned"} - ${task.status} (${task.progress || 0}%)`}
      >
        <div className="flex items-center w-full min-w-0 gap-1">
          {/* Task type icon */}
          {size === "small" && (
            <span className="text-xs font-bold flex-shrink-0 opacity-75">
              {getTaskTypeIcon()}
            </span>
          )}

          {/* Task title */}
          <span
            className="text-xs font-medium truncate flex-1 leading-tight"
            title={task.title}
          >
            {size === "normal" && getTaskTypeIcon()}
            {task.title}
          </span>

          {/* Progress indicator for normal size */}
          {size === "normal" &&
            task.progress !== undefined &&
            task.progress > 0 && (
              <span className="text-xs opacity-75 ml-auto whitespace-nowrap flex-shrink-0">
                {task.progress}%
              </span>
            )}
        </div>
      </div>
    );
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="calendar-container bg-white border border-gray-200 rounded-none">
      {/* Calendar Header */}
      <div className="calendar-header p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">
              📅 Tasks Calendar
            </h2>
            <span className="text-sm text-gray-500">
              Showing {tasksWithDueDates.length} tasks with due dates
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Export Calendar Button (Admin only) */}
            <Button
              variant="primary"
              className="h-8 flex items-center gap-2 bg-green-600 hover:bg-green-700"
              onClick={exportOrgCalendar}
              disabled={isExporting}
              title="Export organization calendar as iCal file"
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
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {isExporting ? "Exporting..." : "Export Calendar"}
            </Button>

            {/* iCal Feed URL */}
            <Button
              variant="primary"
              className="h-8 flex items-center gap-2"
              onClick={() => {
                getICalFeedUrl(); // This will show instructions to the user
              }}
              title="Get instructions for calendar subscription"
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
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.102m0 0l4-4a4 4 0 105.656-5.656l-4 4a4 4 0 01-5.656 0z"
                />
              </svg>
              Copy Feed URL
            </Button>

            {/* Google Calendar Integration Button */}
            {!isGoogleCalendarConnected ? (
              <Button
                variant="primary"
                className={`h-8 flex items-center gap-2 ${
                  googleCalendarStatus === "connecting"
                    ? "bg-gray-400 cursor-not-allowed"
                    : googleCalendarStatus === "error"
                      ? "bg-red-100 text-red-700 hover:bg-red-200 border border-red-300"
                      : ""
                }`}
                onClick={() => handleGoogleCalendarConnect()}
                disabled={googleCalendarStatus === "connecting"}
                title={
                  googleCalendarStatus === "error"
                    ? "Google Calendar integration needs configuration"
                    : "Connect to Google Calendar to sync your tasks"
                }
              >
                {googleCalendarStatus === "connecting" ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Connecting...</span>
                  </>
                ) : googleCalendarStatus === "error" ? (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>Setup Required</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" />
                    </svg>
                    <span>Connect Google Calendar</span>
                  </>
                )}
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-800 rounded-sm text-sm">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Google Calendar Connected</span>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-8 text-xs px-3 font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      title="Disconnect Google Calendar"
                    >
                      Disconnect
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect Google Calendar?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to disconnect your Google Calendar? Tasks will no longer sync automatically.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={disconnectGoogleCalendar} className="bg-red-600 hover:bg-red-700 text-white">
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {/* Configuration Help Link */}
            {googleCalendarStatus === "error" && (
              <Button
                variant="ghost"
                className="text-xs text-blue-600 hover:text-blue-800 underline h-auto p-0"
                onClick={() => {
                  showSuccessToast(
                    "See documentation for Google Calendar setup",
                  );
                }}
                title="Click for setup instructions"
              >
                Setup Guide
              </Button>
            )}

            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </Button>
            )}
          </div>
        </div>

        {/* Sync Error Notifications */}
        {syncErrors.length > 0 && (
          <div className="mt-4 space-y-2">
            {syncErrors.slice(-3).map((error, index) => (
              <div
                key={index}
                className="bg-red-50 border border-red-200 rounded-sm p-3 flex items-start justify-between"
              >
                <div className="flex items-start gap-2">
                  <svg
                    className="w-5 h-5 text-red-500 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-red-800">
                      Sync Error
                    </div>
                    <div className="text-sm text-red-700">{error.error}</div>
                    <div className="text-xs text-red-600">
                      {new Date(error.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setSyncErrors((prev) =>
                      prev.filter(
                        (_, i) => i !== syncErrors.length - 3 + index,
                      ),
                    )
                  }
                  className="text-red-400 hover:text-red-600"
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
            ))}
            {syncErrors.length > 3 && (
              <div className="text-xs text-gray-500 text-center">
                {syncErrors.length - 3} more errors. Email notifications have
                been sent.
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (viewMode === "month") navigateMonth(-1);
                else if (viewMode === "week") navigateWeek(-1);
                else navigateDay(-1);
              }}
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Button>

            <h3 className="text-lg font-medium text-gray-900">
              {viewMode === "month" &&
                `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
              {viewMode === "week" &&
                `Week of ${getWeekDays(currentDate)[0].toLocaleDateString()}`}
              {viewMode === "day" &&
                currentDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
            </h3>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (viewMode === "month") navigateMonth(1);
                else if (viewMode === "week") navigateWeek(1);
                else navigateDay(1);
              }}
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
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-8"
              onClick={() => setCurrentDate(new Date())}
            >
              Today
            </Button>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="h-8"
            >
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="day">Day</option>
            </select>
          </div>
        </div>
      </div>

      {/* Calendar Body */}
      <div className="calendar-body p-4">
        {viewMode === "month" && (
          <div className="calendar-grid">
            {/* Debug info */}
            <div className="mb-2 text-xs text-gray-500">
              Total tasks with due dates: {tasksWithDueDates.length}
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-medium text-gray-500 py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
              {getDaysInMonth(currentDate).map((date, index) => {
                const tasksForDate = getTasksForDate(date);
                const isToday =
                  date && date.toDateString() === new Date().toDateString();
                const isPastDate =
                  date &&
                  (() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const d = new Date(date);
                    d.setHours(0, 0, 0, 0);
                    return d < today;
                  })();

                return (
                  <div
                    key={index}
                    className={`
                      h-32 p-2 border rounded-none relative flex flex-col
                      ${
                        date
                          ? isPastDate
                            ? tasksForDate.length > 0
                              ? "bg-gray-50 cursor-pointer hover:bg-gray-100 hover:border-gray-300"
                              : "bg-gray-50 cursor-not-allowed opacity-60"
                            : "bg-white hover:bg-blue-50 cursor-pointer hover:border-blue-300"
                          : "bg-gray-50 border-gray-100"
                      }
                      ${isToday ? "border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-200" : "border-gray-100"}
                      transition-all duration-200
                    `}
                    onClick={() => handleDateClick(date)}
                    title={
                      date
                        ? isPastDate
                          ? tasksForDate.length > 0
                            ? `${tasksForDate.length} task${tasksForDate.length !== 1 ? "s" : ""} on ${date.toDateString()} - Click to view`
                            : `Past date - Cannot create tasks`
                          : tasksForDate.length > 0
                            ? `${tasksForDate.length} task${tasksForDate.length !== 1 ? "s" : ""} due on ${date.toDateString()} - Click to view or add more`
                            : `Click to create task for ${date.toDateString()}`
                        : ""
                    }
                  >
                    {date && (
                      <>
                        {/* Date number header - fixed height */}
                        <div className="flex items-center justify-between mb-1 h-6">
                          <div
                            className={`text-sm font-medium relative ${
                              isToday
                                ? "text-blue-700 font-bold"
                                : "text-gray-900"
                            }`}
                          >
                            {isToday ? (
                              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                                {date.getDate()}
                              </div>
                            ) : (
                              date.getDate()
                            )}
                          </div>
                          {isToday && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          )}
                        </div>

                        {/* Tasks container - flexible height with scroll */}
                        <div className="flex-1 overflow-hidden">
                          {/* Task count indicator */}
                          {tasksForDate.length > 0 && (
                            <div className="text-xs text-gray-500 mb-1 font-medium">
                              {tasksForDate.length} task
                              {tasksForDate.length !== 1 ? "s" : ""}
                            </div>
                          )}

                          {/* Tasks list */}
                          <div className="space-y-1 h-full">
                            {tasksForDate.length === 0 ? (
                              <div className="h-full flex items-center justify-center">
                                <div className="text-xs text-gray-400 text-center">
                                  Click to add task
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* Show first 3 tasks */}
                                {tasksForDate.slice(0, 3).map((task) => (
                                  <TaskEventBar
                                    key={task.id}
                                    task={task}
                                    onClick={handleTaskClick}
                                    size="small"
                                  />
                                ))}

                                {/* Show "more" indicator if there are more than 3 tasks */}
                                {tasksForDate.length > 3 && (
                                  <div
                                    className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-sm border cursor-pointer hover:bg-gray-200 transition-colors text-center font-medium"
                                    title={`View all ${tasksForDate.length} tasks for this date`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const dateStr = formatDateString(date);
                                      if (onDueDateFilter) {
                                        onDueDateFilter(
                                          "specific_date",
                                          dateStr,
                                        );
                                      }
                                    }}
                                  >
                                    +{tasksForDate.length - 3} more
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === "week" && (
          <div className="week-view h-[600px] flex flex-col">
            {/* Fixed header row */}
            <div className="grid grid-cols-8 gap-1 bg-white border-b border-gray-200 sticky top-0 z-10">
              {/* Time column header */}
              <div className="text-center text-sm font-medium text-gray-500 py-3 bg-gray-50">
                Time
              </div>

              {/* Day headers */}
              {getWeekDays(currentDate).map((day, index) => {
                const isToday =
                  day.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={index}
                    className={`text-center text-sm font-medium py-3 border-b-2 relative bg-white ${
                      isToday
                        ? "text-blue-700 bg-gradient-to-b from-blue-50 to-blue-100 border-blue-500 shadow-md"
                        : "text-gray-500 border-gray-200"
                    }`}
                  >
                    {isToday && (
                      <div className="absolute top-1 right-2 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    )}
                    <div className={`${isToday ? "font-bold" : ""}`}>
                      {dayNames[day.getDay()]}
                    </div>
                    <div
                      className={`${isToday ? "font-bold text-xl" : "text-lg"}`}
                    >
                      {isToday && (
                        <div className="inline-flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-full text-sm font-bold mb-1">
                          {day.getDate()}
                        </div>
                      )}
                      {!isToday && day.getDate()}
                    </div>
                    {isToday && (
                      <div className="text-xs text-blue-600 font-semibold">
                        Today
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Scrollable time slots */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-8 gap-1">
                {/* Time slots */}
                {Array.from({ length: 24 }, (_, hour) => (
                  <React.Fragment key={hour}>
                    {/* Time label */}
                    <div className="text-xs text-gray-500 py-2 px-2 border-r bg-gray-50 sticky left-0 z-10">
                      {formatTime(hour)}
                    </div>

                    {/* Day columns */}
                    {getWeekDays(currentDate).map((day, dayIndex) => {
                      const tasksForHour = getTasksForDateAndTime(day, hour);
                      const isToday =
                        day.toDateString() === new Date().toDateString();
                      const isCurrentHour =
                        isToday && new Date().getHours() === hour;
                      const isPastDay = (() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const d = new Date(day);
                        d.setHours(0, 0, 0, 0);
                        return d < today;
                      })();

                      return (
                        <div
                          key={`${hour}-${dayIndex}`}
                          className={`min-h-[60px] p-1 border transition-all duration-200 relative ${
                            isPastDay
                              ? tasksForHour.length > 0
                                ? "bg-gray-50 border-gray-200 cursor-pointer hover:bg-gray-100"
                                : "bg-gray-50 border-gray-200 cursor-not-allowed opacity-60"
                              : isToday
                                ? "bg-blue-50 border-blue-200 hover:bg-blue-100 cursor-pointer"
                                : "bg-white border-gray-100 hover:bg-blue-50 cursor-pointer"
                          } ${
                            isCurrentHour
                              ? "bg-blue-100 border-blue-300 shadow-md ring-1 ring-blue-200"
                              : ""
                          }`}
                          onClick={() => handleDateClick(day)}
                          title={
                            isPastDay
                              ? tasksForHour.length > 0
                                ? `${tasksForHour.length} task(s) - Click to view`
                                : "Past date"
                              : `${formatTime(hour)} on ${day.toDateString()} - Click to create task`
                          }
                        >
                          {isCurrentHour && (
                            <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                          )}
                          {isToday && !isCurrentHour && (
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-blue-300"></div>
                          )}
                          <div className="space-y-1">
                            {tasksForHour.map((task) => (
                              <TaskEventBar
                                key={task.id}
                                task={task}
                                onClick={handleTaskClick}
                                size="small"
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        )}

        {viewMode === "day" && (
          <div className="day-view h-[600px] flex flex-col">
            {/* Fixed day header */}
            <div className="text-center py-4 border-b border-gray-200 mb-3 bg-white sticky top-0 z-10">
              <div className="text-lg font-semibold text-gray-900">
                {currentDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {getTasksForDate(currentDate).length} tasks scheduled
              </div>
            </div>

            {/* Scrollable time slots */}
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-1 max-w-md mx-auto">
                {Array.from({ length: 24 }, (_, hour) => {
                  const tasksForHour = getTasksForDateAndTime(
                    currentDate,
                    hour,
                  );
                  const isCurrentHour =
                    new Date().getHours() === hour &&
                    currentDate.toDateString() === new Date().toDateString();
                  const isDayPast = (() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const d = new Date(currentDate);
                    d.setHours(0, 0, 0, 0);
                    return d < today;
                  })();

                  return (
                    <div
                      key={hour}
                      className={`flex border border-gray-200 rounded-sm overflow-hidden hover:shadow-sm transition-shadow ${
                        isCurrentHour
                          ? "border-blue-300 bg-blue-50"
                          : isDayPast
                            ? "bg-gray-50"
                            : "bg-white"
                      }`}
                    >
                      {/* Time label */}
                      <div
                        className={`w-20 p-3 text-sm font-medium border-r border-gray-200 flex items-center justify-center ${
                          isCurrentHour
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-50 text-gray-600"
                        }`}
                      >
                        {formatTime(hour)}
                      </div>

                      {/* Tasks area */}
                      <div className="flex-1 p-3 min-h-[60px]">
                        {tasksForHour.length > 0 ? (
                          <div className="space-y-2">
                            {tasksForHour.map((task) => (
                              <TaskEventBar
                                key={task.id}
                                task={task}
                                onClick={handleTaskClick}
                                size="normal"
                              />
                            ))}
                          </div>
                        ) : isDayPast ? (
                          <div className="h-full flex items-center justify-center text-gray-300 text-sm cursor-not-allowed">
                            —
                          </div>
                        ) : (
                          <div
                            className="h-full flex items-center justify-center text-gray-400 text-sm cursor-pointer hover:text-gray-600 transition-colors"
                            onClick={() => handleDateClick(currentDate)}
                            title={`Click to create task for ${formatTime(hour)}`}
                          >
                            + Add task for {formatTime(hour)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="calendar-footer p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div>
              <span>Today</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
              <span>Urgent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-100 border border-orange-300 rounded"></div>
              <span>High</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded"></div>
              <span>Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
              <span>Low</span>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {viewMode === "month" &&
              "Click on tasks to view details • Click empty dates to create tasks"}
            {viewMode === "week" &&
              "Click on tasks to view details • Click time slots to create tasks"}
            {viewMode === "day" &&
              "Click on tasks to view details • Click time slots to create tasks"}
          </div>
        </div>
        {(viewMode === "week" || viewMode === "day") && (
          <div className="mt-2 text-xs text-gray-500 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-white border border-gray-300 rounded text-xs flex items-center justify-center font-bold">
                T
              </span>
              <span>Task</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-white border border-gray-300 rounded text-xs flex items-center justify-center font-bold">
                A
              </span>
              <span>Approval</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-white border border-gray-300 rounded text-xs flex items-center justify-center font-bold">
                R
              </span>
              <span>Recurring</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-white border border-gray-300 rounded text-xs flex items-center justify-center font-bold">
                M
              </span>
              <span>Milestone</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
