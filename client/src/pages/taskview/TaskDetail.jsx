import React, { useState, useEffect } from "react";
import { useSubtask } from "../../contexts/SubtaskContext";
import { useRoute, useLocation } from "wouter";
import { useActiveRole } from "../../components/RoleSwitcher";
import { useQueryClient } from "@tanstack/react-query";
import { useTaskPriorities } from "@/hooks/useTaskPriorities";
import { getPriorityOptions } from "@/utils/priorityUtils";
import { format } from "date-fns";
import axios from "axios";
import { canAssignToOthers } from "../../utils/taskPermissions";
import {
  ClipboardList,
  CheckSquare,
  MessageCircle,
  Activity,
  Paperclip,
  Link,
  Plus,
  Trash2,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  Download,
  X,
  XCircle,
  Calendar,
  User,
  Tag,
  AlertCircle as AlertIcon,
  ThumbsUp,
  Reply,
  Send,
  Smile,
  FileText,
  Upload,
  Cloud,
  Filter,
  CheckCircle2,
  Edit,
  UserPlus,
  Zap,
  Bell,
  Loader,
  Pen,
  Search,
  Check,
} from "lucide-react";
import CoreInfoPanel from "./CoreInfoPanel";
import SubtasksPanel from "./SubtasksPanel";
import AttachedFormsTab from "./AttachedFormsTab";
import ApprovalActionsPanel from "./ApprovalActionsPanel";
import SubtaskForm from "../../components/forms/SubtaskForm";
import FormSubmissionsModal from "../../components/forms/FormSubmissionsModal";
import FormSubmissionModal from "../../components/forms/FormSubmissionModal";
import SafeHtml from "../../components/common/SafeHtml";
import "../../components/forms/FormsStyles.css";
import {
  ReassignTaskModal,
  SnoozeTaskModal,
  MarkRiskModal,
  MitigationModal,
  MarkDoneModal,
} from "../../components/modals/TaskModals";
import "../../components/modals/ModalStyles.css";
import StatusDropdown from "./StatusDropdown";
import PriorityDropdown from "./PriorityDropdown";
import AssigneeSelector from "./AssigneeSelector";
import { EditableTitle, EditableTextArea } from "./EditableComponents";
import { TaskComments } from "../../components/tasks/TaskComments";
import TaskAttachments from "../newComponents/TaskAttachments";
import { useShowToast } from "../../utils/ToastMessage";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import useLicense from "../../hooks/useLicense";
import UpgradeRequiredModal from "../../components/modals/UpgradeRequiredModal";
import "./TaskView.css";
import "./DetailedView.css";

export default function TaskDetail({ taskId: propTaskId, onClose }) {
  const queryClient = useQueryClient();
  const { openSubtaskDrawer } = useSubtask();
  const { showSuccessToast, showErrorToast } = useShowToast();
  const { checkFeature } = useLicense();
  const [, params] = useRoute("/tasks/:taskId");
  const taskId = propTaskId || params?.taskId;

  // Get dynamic priority options
  const { data: taskPriorities = [] } = useTaskPriorities();
  const priorityOptions = getPriorityOptions(taskPriorities);

  console.log("DEBUG - TaskDetail taskId:", taskId);

  // Initialize active tab from query string to avoid first paint on Core Info
  const initialTab = (() => {
    try {
      const search =
        typeof window !== "undefined" ? window.location?.search || "" : "";
      const params = new URLSearchParams(search);
      const tab = params.get("tab");
      // Dynamic valid tabs - exclude subtasks for subtasks themselves
      const validTabs = new Set([
        "core-info",
        "comments",
        "activity",
        "files",
        "linked",
      ]);
      if (tab && validTabs.has(tab)) return tab;
    } catch {}
    return "core-info";
  })();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [location, setLocation] = useLocation();
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [showMitigationModal, setShowMitigationModal] = useState(false);
  const [showCreateSubtaskDrawer, setShowCreateSubtaskDrawer] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDoneModal, setShowDoneModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [moreInfo, setMoreInfo] = useState(false);

  // Time Estimate State
  const [isEditingTimeEstimate, setIsEditingTimeEstimate] = useState(false);
  const [timeEstimateInput, setTimeEstimateInput] = useState("");

  // Description Edit State
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState("");

  // Tags Edit State
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [tagsInput, setTagsInput] = useState("");

  // Due Date Edit State
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [dueDateInput, setDueDateInput] = useState("");

  // Progress State
  const [isEditingProgress, setIsEditingProgress] = useState(false);
  const [progressInput, setProgressInput] = useState("");

  // Form submission modal state
  const [showFormSubmissionsModal, setShowFormSubmissionsModal] =
    useState(false);
  const [showFormSubmissionModal, setShowFormSubmissionModal] = useState(false);
  const [selectedFormData, setSelectedFormData] = useState(null);
  const [unlinkConfirm, setUnlinkConfirm] = useState({
    isOpen: false,
    form: null,
  });

  // API Integration State
  const [task, setTask] = useState(null);
  const [rawTaskData, setRawTaskData] = useState(null); // Store raw API data for forms
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Activity Feed State
  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState(null);
  const [activityFilter, setActivityFilter] = useState("all");

  // Helper function to safely get priority label with fallback for invalid priorities
  const getPriorityLabelSafe = (priority) => {
    if (!priority) return "Unknown";

    // Find matching priority option in the available priorities
    const priorityCode = String(priority).toLowerCase().trim();
    const foundPriority = priorityOptions.find(
      (p) => String(p.value).toLowerCase().trim() === priorityCode,
    );

    // Return label if found, otherwise return capitalized priority code
    if (foundPriority && foundPriority.label) {
      return foundPriority.label;
    }

    // Fallback: capitalize the priority code itself
    return String(priority).charAt(0).toUpperCase() + String(priority).slice(1);
  };

  // Fetch task data from API
  const fetchTaskData = async () => {
    if (!taskId) {
      setError("No task ID provided");
      setLoading(false);
      return;
    }

    try {
      console.log("DEBUG - Fetching task data for ID:", taskId);
      setLoading(true);

      const token = localStorage.getItem("token");
      const response = await axios.get(`/api/tasks/${taskId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        const apiData = response.data.data;
        console.log("DEBUG - Received API data:", apiData);

        // Find the task data - it could be directly in data or in roles.employee array
        let taskData = null;
        let subtasksData = [];

        if (apiData.roles && apiData.roles.employee) {
          // Find the task in the employee array by matching the taskId
          const taskWithSubtasks = apiData.roles.employee.find(
            (task) =>
              task._doc._id === taskId || task._doc._id.toString() === taskId,
          );

          if (taskWithSubtasks) {
            taskData = taskWithSubtasks._doc;
            subtasksData = taskWithSubtasks.subtasks || [];
          }
        } else if (apiData._id || apiData.id) {
          // Direct task data
          taskData = apiData;
          subtasksData = apiData.subtasks || [];
        }

        if (!taskData) {
          throw new Error("Task not found in API response");
        }

        console.log("DEBUG - Found task data:", taskData);
        console.log("DEBUG - Task assignedTo:", taskData.assignedTo);
        console.log("DEBUG - Task createdBy:", taskData.createdBy);
        console.log("DEBUG - Found subtasks data:", subtasksData);

        // Map the API response to the component's expected format
        const mappedTask = {
          id: taskData._id || taskData.id,
          _id: taskData._id,
          title: taskData.title || "Untitled Task",
          description: taskData.description || "No description provided",
          status:
            taskData.approvalStatus === "approved"
              ? "APPROVED"
              : taskData.approvalStatus === "rejected"
                ? "REJECTED"
                : taskData.status?.toUpperCase() || "TODO",
          priority: taskData.priority || "medium",
          assignee: taskData.assignedTo
            ? `${taskData.assignedTo.firstName || taskData.assignedTo.name || ""} ${taskData.assignedTo.lastName || ""}`.trim()
            : "Unassigned",
          assigneeId:
            taskData.assignedTo?._id ||
            taskData.assignedTo?.id ||
            taskData.assignedTo?._doc?._id ||
            null,
          dueDate: taskData.dueDate
            ? new Date(taskData.dueDate)
                .toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
                .replace(",", "")
            : "No due date",
          startDate: taskData.startDate
            ? new Date(taskData.startDate)
                .toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
                .replace(",", "")
            : "No start date",
          timeEstimate: taskData.timeEstimate || "Not specified",
          tags: taskData.tags || [],
          createdBy: taskData.createdBy
            ? `${taskData.createdBy.firstName || taskData.createdBy.name || ""} ${taskData.createdBy.lastName || ""}`.trim()
            : "Unknown",
          creatorId:
            taskData.createdBy?._id ||
            taskData.createdBy?.id ||
            taskData.createdBy?._doc?._id ||
            null,
          createdAt: taskData.createdAt
            ? new Date(taskData.createdAt)
                .toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
                .replace(",", "")
            : "Unknown",
          updatedAt: taskData.updatedAt
            ? new Date(taskData.updatedAt)
                .toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
                .replace(",", "")
            : "Unknown",
          snoozedUntil: taskData.snoozeUntil || null,
          snoozeNote: taskData.snoozeReason || null,
          taskType:
            taskData.taskType === "regular"
              ? "Regular Task"
              : taskData.taskType || "Regular Task",
          isRisky: taskData.isRisk || false,
          riskNote: taskData.riskReason || "",
          parentTask: taskData.parentTask || null,
          parentTaskId: taskData.parentTaskId || null,
          visibility:
            taskData.visibility === "private"
              ? "Private"
              : taskData.visibility || "Private",
          colorCode: taskData.colorCode || "#007bff",
          subtasks: subtasksData.map((subtask) => ({
            id: subtask._id,
            _id: subtask._id,
            title: subtask.title,
            description: subtask.description,
            status: subtask.status?.toUpperCase() || "TODO",
            priority: subtask.priority || "medium",
            assignee: subtask.assignedTo
              ? `${subtask.assignedTo.firstName} ${subtask.assignedTo.lastName}`.trim()
              : "Unassigned",
            assigneeId: subtask.assignedTo?._id || null,
            dueDate: subtask.dueDate
              ? new Date(subtask.dueDate)
                  .toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                  .replace(",", "")
              : "No due date",
            createdBy: subtask.createdBy
              ? `${subtask.createdBy.firstName} ${subtask.createdBy.lastName}`.trim()
              : "Unknown",
            createdAt: subtask.createdAt,
            parentTaskId: subtask.parentTaskId,
            tags: subtask.tags || [],
          })),
          linkedItems: taskData.linkedTasks || [],
          linkedToMilestone: taskData.linkedToMilestone || null,
          collaborators: taskData.collaborators || [], // Keep original objects with id field, don't convert to strings!
          contributors: taskData.contributors || [], // Keep original objects
          forms: [],
          attachments: taskData.attachments || [],
          // Additional fields from API
          progress: taskData.progress || 0,
          completedAt: taskData.completedAt,
          isSnooze: taskData.isSnooze || false,
          isRisk: taskData.isRisk || false,
          category: taskData.category || "",
          taskTypeAdvanced: taskData.taskTypeAdvanced || "simple",
          mainTaskType: taskData.mainTaskType || "regular",
          isSubtask: taskData.isSubtask || false,
          isRecurring:
            taskData.isRecurring || taskData.mainTaskType === "recurring",
          order: taskData.order || 0,
          approvalStatus: taskData.approvalStatus || null,
          isApprovalTask: taskData.isApprovalTask || false,
          approvers: taskData.approvers || [],
          createdByRole: taskData.createdByRole || [],
          assignedToRole: taskData.assignedToRole || null,
        };

        console.log("DEBUG - Mapped task subtasks:", mappedTask.subtasks);
        console.log(
          "DEBUG - Subtasks count:",
          mappedTask.subtasks ? mappedTask.subtasks.length : "undefined",
        );
        console.log("🔍 DEBUG - Mapped task creatorId check:", {
          rawCreatedBy: taskData.createdBy,
          mappedCreatorId: mappedTask.creatorId,
          mappedCreatedBy: mappedTask.createdBy,
          assigneeId: mappedTask.assigneeId,
          assignee: mappedTask.assignee,
        });
        console.log("🔍 DEBUG - Contributors loaded:", {
          rawContributors: taskData.contributors,
          mappedContributors: mappedTask.contributors,
          isRecurring:
            mappedTask.mainTaskType === "recurring" || taskData.isRecurring,
          contributorIds: mappedTask.contributors?.map((c) => ({
            id: c?._id || c?.id || c,
            email: c?.email,
            firstName: c?.firstName,
          })),
        });

        setTask(mappedTask);
        setRawTaskData(taskData); // Store raw data for form access
        setError(null);
      } else {
        throw new Error(response.data.message || "Failed to fetch task");
      }
    } catch (err) {
      console.error("Error fetching task:", err);
      setError(
        err.response?.data?.message || err.message || "Failed to load task",
      );
    } finally {
      setLoading(false);
    }
  };

  // Fetch comments for the task or subtask
  const fetchComments = async () => {
    try {
      const baseUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      console.log("DEBUG - fetchComments called for:", {
        taskId,
        task,
        isSubtask: task?.parentTask,
      });

      let apiUrl;

      // Check if this is a subtask by looking for parentTask
      if (task?.parentTask || task?.parentTaskId) {
        let parentTaskId;

        if (task.parentTask) {
          if (typeof task.parentTask === "object" && task.parentTask !== null) {
            parentTaskId = task.parentTask._id || task.parentTask.id;
          } else if (typeof task.parentTask === "string") {
            parentTaskId = task.parentTask;
          }
        }

        // Fallback to parentTaskId if not found yet
        if (!parentTaskId && task.parentTaskId) {
          if (
            typeof task.parentTaskId === "object" &&
            task.parentTaskId !== null
          ) {
            parentTaskId = task.parentTaskId._id || task.parentTaskId.id;
          } else if (typeof task.parentTaskId === "string") {
            parentTaskId = task.parentTaskId;
          }
        }

        // Final validation
        if (!parentTaskId || typeof parentTaskId !== "string") {
          console.error(
            "ERROR: Invalid parentTaskId for fetchComments:",
            parentTaskId,
          );
          setCommentsError("Cannot fetch comments: Invalid parent task ID");
          return;
        }

        apiUrl = `/api/tasks/${parentTaskId}/subtasks/${taskId}/comments`;
        console.log("DEBUG - Fetching subtask comments from:", apiUrl);
      } else {
        apiUrl = `/api/tasks/${taskId}/comments`;
        console.log("DEBUG - Fetching task comments from:", apiUrl);
      }

      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log("DEBUG - Comments API response:", result);
        // Handle new API response structure
        if (result.success && result.data && result.data.comments) {
          const fetchedComments = result.data.comments;
          setComments(fetchedComments);

          // Calculate total comments including replies
          const totalCount =
            result.data.pagination?.totalCommentsWithReplies ||
            fetchedComments.reduce((count, comment) => {
              return count + 1 + (comment.replies?.length || 0);
            }, 0);
          setCommentsCount(totalCount);

          console.log("DEBUG - Comments updated:", {
            topLevelComments: fetchedComments.length,
            totalWithReplies: totalCount,
          });
        } else if (Array.isArray(result)) {
          // Fallback for old format
          setComments(result);
          setCommentsCount(result.length);
        } else {
          setComments([]);
          setCommentsCount(0);
        }
      } else {
        console.error(
          "Failed to fetch comments:",
          response.status,
          response.statusText,
        );
        setComments([]);
        setCommentsCount(0);
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
      setComments([]);
    }
  };

  // Fetch activities for the task
  const fetchActivities = async () => {
    if (!taskId) return;

    try {
      setActivitiesLoading(true);
      const baseUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      const token = localStorage.getItem("token");

      console.log("DEBUG - Fetching activities for task:", taskId);

      const response = await fetch(`/api/tasks/${taskId}/activities?limit=50`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log("DEBUG - Activities API response:", result);

        if (result.success && result.data && result.data.activities) {
          const fetchedActivities = result.data.activities;

          // Format activities for display
          const formattedActivities = fetchedActivities.map((activity) => {
            console.log("🔍 [ACTIVITY FORMATTING] Processing activity:", {
              type: activity.type,
              hasData: !!activity.data,
              data: activity.data,
            });

            // Enhance description with specific change details if available
            let enhancedDescription = activity.description;

            // Check for estimate change activity
            if (
              activity.type === "task_time_estimate_changed" &&
              activity.data
            ) {
              const { oldValue, newValue, taskTitle } = activity.data;
              if (oldValue !== undefined && newValue !== undefined) {
                enhancedDescription = `Task "${taskTitle}" estimate changed from ${oldValue} hours to ${newValue} hours`;
                console.log(
                  "⏱️ [ESTIMATE CHANGE] Formatted estimate activity:",
                  enhancedDescription,
                );
              }
            }

            // Check for status change activity
            if (activity.type === "task_status_changed" && activity.data) {
              const { oldValue, newValue, taskTitle } = activity.data;
              if (oldValue !== undefined && newValue !== undefined) {
                enhancedDescription = `Task "${taskTitle}" status changed from "${oldValue}" to "${newValue}"`;
                console.log(
                  "🔄 [STATUS CHANGE] Formatted status activity:",
                  enhancedDescription,
                );
              }
            }

            // Check for priority change activity
            if (activity.type === "task_priority_changed" && activity.data) {
              const { oldValue, newValue, taskTitle } = activity.data;
              if (oldValue !== undefined && newValue !== undefined) {
                enhancedDescription = `Task "${taskTitle}" priority changed from "${oldValue}" to "${newValue}"`;
                console.log(
                  "⚡ [PRIORITY CHANGE] Formatted priority activity:",
                  enhancedDescription,
                );
              }
            }

            return {
              id: activity._id,
              type: activity.type,
              description: enhancedDescription,
              icon: activity.metadata?.icon || "📝",
              category: activity.metadata?.category || "general",
              user: activity.user
                ? {
                    id: activity.user._id,
                    name:
                      activity.user.name ||
                      `${activity.user.firstName || ""} ${activity.user.lastName || ""}`.trim(),
                    email: activity.user.email,
                    avatar: activity.user.avatar,
                  }
                : null,
              timestamp: activity.createdAt,
              relatedId: activity.relatedId,
              relatedType: activity.relatedType,
              metadata: activity.metadata || {},
              data: activity.data || {}, // Include raw data for debugging
            };
          });

          setActivities(formattedActivities);
          setActivitiesError(null);
          console.log(
            "DEBUG - Activities updated:",
            formattedActivities.length,
          );
        } else {
          setActivities([]);
          setActivitiesError("No activities found");
        }
      } else {
        console.error(
          "Failed to fetch activities:",
          response.status,
          response.statusText,
        );
        setActivities([]);
        setActivitiesError("Failed to load activities");
      }
    } catch (error) {
      console.error("Error fetching activities:", error);
      setActivities([]);
      setActivitiesError(error.message || "Failed to load activities");
    } finally {
      setActivitiesLoading(false);
    }
  };

  // Fetch data when component mounts or taskId changes
  useEffect(() => {
    fetchTaskData();
    if (taskId) {
      fetchComments();
      fetchActivities(); // Add activity fetching
    }
  }, [taskId]);

  // Control body scroll when drawer opens
  useEffect(() => {
    if (onClose) {
      // Only when drawer is open (has onClose prop)
      document.body.classList.add("drawer-open");
      return () => {
        document.body.classList.remove("drawer-open");
      };
    }
  }, [onClose]);

  // Sync tab selection from query string, e.g. ?tab=subtasks
  useEffect(() => {
    // Wouter's location doesn't include the query string, so use window.location.search
    const search = window.location?.search || "";
    if (!search) return;
    const params = new URLSearchParams(search);
    const tab = params.get("tab");
    if (tab) {
      // Allow only known tabs - dynamic based on task type
      // Determine if subtasks tab should be available
      const taskType = task?.taskType?.toLowerCase() || "";
      const mainTaskType = task?.mainTaskType?.toLowerCase() || "";
      const isMilestone =
        taskType.includes("milestone") ||
        mainTaskType === "milestone" ||
        task?.type === "milestone";
      const isApproval =
        taskType.includes("approval") ||
        mainTaskType === "approval" ||
        task?.isApprovalTask;
      const isSubtask = task?.parentTaskId;

      // Build valid tabs list - exclude subtasks for subtasks, milestones, and approval tasks
      const baseTabs = ["core-info", "comments", "activity", "files", "linked"];
      const validTabs = new Set(
        isSubtask || isMilestone || isApproval
          ? baseTabs
          : [...baseTabs, "subtasks"],
      );

      if (validTabs.has(tab)) {
        setActiveTab(tab);
      }
    }
  }, [
    location,
    task?.parentTaskId,
    task?.taskType,
    task?.mainTaskType,
    task?.type,
    task?.isApprovalTask,
  ]);

  // Get current user from authentication context or localStorage
  const [currentUser, setCurrentUser] = useState(null);
  const { activeRole } = useActiveRole(); // Get active role from context

  // Fetch current user data
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const token = localStorage.getItem("token");
        if (token) {
          const response = await fetch(`/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const userData = await response.json();
            console.log("DEBUG - Current user data:", userData);

            // Use activeRole from context, fallback to first role from API
            const userRole =
              activeRole ||
              (Array.isArray(userData.data?.role)
                ? userData.data.role[0]
                : userData.data?.role) ||
              (Array.isArray(userData.role)
                ? userData.role[0]
                : userData.role) ||
              "employee";

            console.log(
              "DEBUG - Final user role:",
              userRole,
              "activeRole:",
              activeRole,
            );

            const currentUserObj = {
              id: userData.data?._id || userData._id,
              _id: userData.data?._id || userData._id,
              firstName: userData.data?.firstName || userData.firstName,
              lastName: userData.data?.lastName || userData.lastName,
              name:
                userData.data?.name ||
                userData.name ||
                `${userData.data?.firstName || userData.firstName} ${userData.data?.lastName || userData.lastName}`,
              email: userData.data?.email || userData.email,
              role: userRole, // Use single role string, not array
            };

            console.log("🔍 DEBUG - Setting currentUser:", {
              id: currentUserObj.id,
              _id: currentUserObj._id,
              email: currentUserObj.email,
              role: currentUserObj.role,
            });

            setCurrentUser(currentUserObj);
          } else {
            // Fallback to mock user if API fails
            setCurrentUser({
              id: "1",
              _id: "1",
              firstName: "Current",
              lastName: "User",
              name: "Current User",
              email: "current@company.com",
              role: activeRole || "employee", // Use activeRole or default
            });
          }
        } else {
          // No token - use mock user
          setCurrentUser({
            id: "1",
            _id: "1",
            firstName: "Current",
            lastName: "User",
            name: "Current User",
            email: "current@company.com",
            role: activeRole || "employee", // Use activeRole or default
          });
        }
      } catch (error) {
        console.error("Error fetching current user:", error);
        // Fallback to mock user
        setCurrentUser({
          id: "1",
          _id: "1",
          firstName: "Current",
          lastName: "User",
          name: "Current User",
          email: "current@company.com",
          role: activeRole || "employee", // Use activeRole or default
        });
      }
    };

    fetchCurrentUser();
  }, [activeRole]); // Refetch when activeRole changes  // Helper function to determine user permissions based on role

  // Helper function to check if user is mentioned in any comment
  const isUserMentionedInTask = (userId, task) => {
    if (!task.comments || !Array.isArray(task.comments)) {
      console.log("DEBUG - isUserMentionedInTask: No comments or not an array");
      return false;
    }

    // Normalize user ID - handle both string and object formats, trim whitespace
    const userIdStr = (userId?.toString?.() || String(userId) || "").trim();

    console.log("DEBUG - isUserMentionedInTask: Starting check", {
      userId: userIdStr,
      totalComments: task.comments.length,
    });

    // Check all comments and their replies for mentions
    for (const comment of task.comments) {
      // Check main comment mentions
      if (comment.mentions && Array.isArray(comment.mentions)) {
        console.log("DEBUG - Checking mentions in comment:", {
          commentId: comment._id,
          mentionsCount: comment.mentions.length,
        });

        for (const mention of comment.mentions) {
          // Normalize mention ID - check both id and _id fields, trim whitespace
          const mentionId = (
            mention?.id?.toString?.() ||
            mention?._id?.toString?.() ||
            String(mention?.id || mention?._id) ||
            ""
          ).trim();
          const matches = mentionId === userIdStr;

          console.log("DEBUG - Checking mention match:", {
            mentionObject: mention,
            mentionIdRaw: mention?.id || mention?._id,
            mentionIdNormalized: mentionId,
            userIdNormalized: userIdStr,
            matches,
          });

          if (matches) {
            console.log("✅ DEBUG - User IS MENTIONED in comment!");
            return true;
          }
        }
      }

      // Check reply mentions (if replies are stored in comment.replies)
      if (comment.replies && Array.isArray(comment.replies)) {
        for (const reply of comment.replies) {
          if (reply.mentions && Array.isArray(reply.mentions)) {
            console.log("DEBUG - Checking mentions in reply:", {
              replyId: reply._id,
              mentionsCount: reply.mentions.length,
            });

            for (const mention of reply.mentions) {
              const mentionId = (
                mention?.id?.toString?.() ||
                mention?._id?.toString?.() ||
                String(mention?.id || mention?._id) ||
                ""
              ).trim();
              const matches = mentionId === userIdStr;

              console.log("DEBUG - Checking reply mention match:", {
                mentionObject: mention,
                mentionIdRaw: mention?.id || mention?._id,
                mentionIdNormalized: mentionId,
                userIdNormalized: userIdStr,
                matches,
              });

              if (matches) {
                console.log("✅ DEBUG - User IS MENTIONED in reply!");
                return true;
              }
            }
          }
        }
      }
    }

    console.log("❌ DEBUG - User is NOT mentioned in any comment");
    return false;
  };

  const getUserPermissions = (user, task, role = null) => {
    if (!user || !task) {
      console.log("DEBUG - getUserPermissions: Missing user or task");
      return { canAdd: false, canEdit: false, canDelete: false, canView: true };
    }

    console.log("DEBUG - getUserPermissions FULL TASK OBJECT:", {
      taskId: task._id || task.id,
      taskCollaborators: task.collaborators,
      taskContributors: task.contributors,
      collaboratorsLength: task.collaborators?.length,
      contributorsLength: task.contributors?.length,
      firstCollaborator: task.collaborators?.[0],
      taskCreatedBy: task.createdBy,
      taskAssignedTo: task.assignedTo,
    });

    // Use provided role or fall back to user.role
    const userRole = role || user.role;

    console.log("DEBUG - getUserPermissions:", {
      userRole,
      providedRole: role,
      fallbackRole: user.role,
      taskId: task._id,
      userId: user.id,
      userIdType: typeof user.id,
      taskAssigneeId: task.assigneeId,
      taskCreatorId: task.creatorId,
      taskAssignedTo: task.assignedTo,
      taskCreatedBy: task.createdBy,
    });

    // Normalize IDs for comparison - handle multiple field formats
    const userId = (
      user.id?.toString?.() ||
      user.id?.toString?.() ||
      String(user.id || user._id)
    ).trim();
    const taskAssignedToId = (
      task.assignedTo?._id?.toString?.() ||
      task.assignedTo?.id?.toString?.() ||
      task.assigneeId?.toString?.() ||
      ""
    ).trim();
    const taskCreatedById = (
      task.createdBy?._id?.toString?.() ||
      task.createdBy?.id?.toString?.() ||
      task.creatorId?.toString?.() ||
      ""
    ).trim();

    console.log("DEBUG - ID normalization:", {
      userIdRaw: user.id,
      userIdNormalized: userId,
      taskAssignedToRaw: task.assignedTo,
      taskAssignedToNormalized: taskAssignedToId,
      taskCreatedByRaw: task.createdBy,
      taskCreatedByNormalized: taskCreatedById,
    });

    const isTaskAssignee = taskAssignedToId === userId;
    const isTaskCreator = taskCreatedById === userId;

    // Check if user is tagged as contributor in this specific task
    const isTaggedContributor =
      task.contributors &&
      task.contributors.some((c) => {
        const contributorId =
          c?.id?.toString() || c?._id?.toString() || c?.toString();
        console.log("DEBUG - Checking contributor match:", {
          contributorRaw: c,
          contributorIdExtracted: contributorId,
          userIdForComparison: userId,
          matches: contributorId === userId,
        });
        return contributorId === userId;
      });

    // Check if user is mentioned in task or tagged as collaborator
    const isCollaboratorInTask =
      task.collaborators &&
      Array.isArray(task.collaborators) &&
      task.collaborators.some((c) => {
        const collaboratorId = (
          c?.id?.toString?.() ||
          c?._id?.toString?.() ||
          String(c?.id || c?._id) ||
          ""
        ).trim();
        const matches = collaboratorId === userId;
        console.log("DEBUG - Checking collaborator match:", {
          collaboratorObject: c,
          collaboratorIdRaw: c?.id || c?._id,
          collaboratorIdNormalized: collaboratorId,
          userIdForComparison: userId,
          matches,
          collaboratorType: typeof c,
          collaboratorKeys: c ? Object.keys(c) : "N/A",
        });
        return matches;
      });

    // Check if user is mentioned in comments
    const isMentionedInComments = isUserMentionedInTask(userId, task);

    // Check if user is designated as an approver for this task
    const isApprover = (task.approvers || []).some((approver) => {
      const approverId =
        approver && typeof approver === "object"
          ? approver.id?.toString() || approver._id?.toString()
          : approver?.toString();
      return approverId === userId;
    });

    console.log("DEBUG - Permission checks:", {
      isTaskAssignee,
      isTaskCreator,
      isTaggedContributor,
      isCollaboratorInTask,
      isApprover,
      isMentionedInComments,
      userId,
      taskAssignedToId,
      taskCreatedById,
      userRole,
      collaboratorsArray: task.collaborators,
      collaboratorsLength: task.collaborators?.length,
      commentsCount: task.comments?.length,
    });
    // Role-based permissions according to specifications:
    // 1. employee (Normal User) - only own tasks
    // 2. manager - own tasks + subordinates' tasks
    // 3. contributor - tagged/mentioned tasks only (contextual role)
    // 4. org_admin (Company Admin) - all company tasks
    // 5. tasksetu-admin - platform level (all tasks)

    // Tasksetu Admin (platform level) - highest priority
    if (userRole === "tasksetu-admin" || userRole === "super-admin") {
      return {
        canAdd: true,
        canEdit: true, // Can edit any comment
        canDelete: true, // Can delete any comment
        canView: true,
        canModerate: true,
        canAttachFiles: true,
        canMention: true,
      };
    }

    // Company Admin (org_admin) - all company tasks
    if (
      userRole === "org_admin" ||
      userRole === "company-admin" ||
      userRole === "admin"
    ) {
      return {
        canAdd: true,
        canEdit: true, // Can edit own comments
        canDelete: true, // Can delete own comments + moderate
        canView: true,
        canModerate: true, // Can moderate others' comments
        canAttachFiles: true,
        canMention: true,
      };
    }

    // Approver check - any approver has access to the task comments and attachments
    if (isApprover) {
      console.log(
        "✅ DEBUG - Permission GRANTED: User is an approver of this task",
      );
      return {
        canAdd: true,
        canEdit: true, // Can edit own comments
        canDelete: true, // Can delete own comments
        canView: true,
        canModerate: false,
        canAttachFiles: true,
        canMention: true,
      };
    }

    // Manager - own tasks + subordinates' tasks
    if (userRole === "manager") {
      // Check if this is own task or subordinate's task
      const isOwnTask = isTaskAssignee || isTaskCreator;
      const hasEmployeeCreator = Array.isArray(task.createdByRole)
        ? task.createdByRole.includes("employee")
        : task.createdByRole === "employee";

      const isSubordinateTask =
        task.assignedToRole === "employee" || hasEmployeeCreator;

      if (
        isOwnTask ||
        isSubordinateTask ||
        isTaggedContributor ||
        isCollaboratorInTask
      ) {
        return {
          canAdd: true,
          canEdit: true, // Can edit own comments
          canDelete: true, // Can delete own comments
          canView: true,
          canModerate: false,
          canAttachFiles: true,
          canMention: true,
        };
      }
    }

    // Employee (Normal User) - only own tasks or when tagged as contributor or mentioned
    if (
      userRole === "employee" ||
      userRole === "normal-user" ||
      userRole === "user" ||
      !userRole
    ) {
      const isOwnTask = isTaskAssignee || isTaskCreator;

      console.log(
        "%c ✨ EMPLOYEE PERMISSION CHECK",
        "color: #FFD700; font-weight: bold; font-size: 14px;",
        {
          userRole,
          isOwnTask,
          isTaskAssignee,
          isTaskCreator,
          isTaggedContributor,
          isCollaboratorInTask,
          isMentioned: isMentionedInComments,
          shouldGrantPermission:
            isOwnTask ||
            isTaggedContributor ||
            isCollaboratorInTask ||
            isMentionedInComments,
        },
      );

      if (
        isOwnTask ||
        isTaggedContributor ||
        isCollaboratorInTask ||
        isMentionedInComments
      ) {
        console.log(
          "✅ DEBUG - Permission GRANTED: Employee own task or contributor/collaborator/mentioned",
        );
        return {
          canAdd: true,
          canEdit: true, // Can edit own comments only
          canDelete: true, // Can delete own comments only
          canView: true,
          canModerate: false,
          canAttachFiles: true,
          canMention: true,
        };
      }
    }

    // Individual User - only own tasks or when tagged as collaborator
    if (userRole === "individual") {
      const isOwnTask = isTaskAssignee || isTaskCreator;

      console.log("DEBUG - Individual user permission check:", {
        isOwnTask,
        isCollaboratorInTask,
        userRole,
        isTaskAssignee,
        isTaskCreator,
      });

      if (isOwnTask || isCollaboratorInTask) {
        console.log(
          "DEBUG - Permission granted: Individual user own task or collaborator",
        );
        return {
          canAdd: true,
          canEdit: true, // Can edit own comments only
          canDelete: true, // Can delete own comments only
          canView: true,
          canModerate: false,
          canAttachFiles: true,
          canMention: false, // Individual users cannot mention others
        };
      }
    }

    // Contributor role (contextual) - only when tagged/mentioned/collaborator
    console.log("DEBUG - Checking contextual contributor role:", {
      isTaggedContributor,
      isCollaboratorInTask,
      isMentionedInComments,
      shouldGrantPermission:
        isTaggedContributor || isCollaboratorInTask || isMentionedInComments,
    });

    if (isTaggedContributor || isCollaboratorInTask || isMentionedInComments) {
      console.log(
        "✅ DEBUG - Permission GRANTED: Contextual contributor/collaborator/mentioned",
      );
      return {
        canAdd: true,
        canEdit: true, // Can edit own comments only
        canDelete: true, // Can delete own comments only
        canView: true,
        canModerate: false,
        canAttachFiles: true, // Contributors can attach files
        canMention: true,
      };
    }

    console.log(
      "DEBUG - Permission denied: No matching conditions for role:",
      userRole,
    );
    // Default - view only (for tasks user has no permission to comment on)
    return {
      canAdd: false,
      canEdit: false,
      canDelete: false,
      canView: true,
      canModerate: false,
      canAttachFiles: false,
      canMention: false,
    };
  };

  // List of users for mentions (loaded dynamically in TaskComments)
  const [users] = useState([]);

  // Comments state managed from API
  const [comments, setComments] = useState([]);
  const [commentsCount, setCommentsCount] = useState(0);

  // Comment handlers
  const handleAddComment = async (commentData) => {
    try {
      console.log("🔍 [COMMENT DEBUG] Step 1: handleAddComment called");
      console.log("📦 [COMMENT DEBUG] Step 2: Comment Data:", commentData);
      console.log("📋 [COMMENT DEBUG] Step 3: Task Data:", { taskId, task });
      console.log("🏷️ [COMMENT DEBUG] Step 4: Task Type:", {
        isSubtask: task?.isSubtask,
        hasParentTask: !!task?.parentTask,
        hasParentTaskId: !!task?.parentTaskId,
        parentTask: task?.parentTask,
        parentTaskId: task?.parentTaskId,
      });

      const baseUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      let apiUrl;

      // Check if this is a subtask
      if (task?.parentTask || task?.parentTaskId) {
        // Extract parent task ID properly - handle both object and string formats
        let parentTaskId;

        console.log("🔎 [COMMENT DEBUG] Step 5: Extracting Parent Task ID");
        console.log("📌 [COMMENT DEBUG] task.parentTask:", task.parentTask);
        console.log(
          "📌 [COMMENT DEBUG] task.parentTask type:",
          typeof task.parentTask,
        );
        console.log("📌 [COMMENT DEBUG] task.parentTaskId:", task.parentTaskId);
        console.log(
          "📌 [COMMENT DEBUG] task.parentTaskId type:",
          typeof task.parentTaskId,
        );

        if (task.parentTask) {
          if (typeof task.parentTask === "object" && task.parentTask !== null) {
            parentTaskId = task.parentTask._id || task.parentTask.id;
            console.log(
              "✅ [COMMENT DEBUG] Step 6: Extracted from object - parentTaskId:",
              parentTaskId,
            );
          } else if (typeof task.parentTask === "string") {
            parentTaskId = task.parentTask;
            console.log(
              "✅ [COMMENT DEBUG] Step 6: Used string directly - parentTaskId:",
              parentTaskId,
            );
          }
        }

        // Fallback to parentTaskId if not found yet
        if (!parentTaskId && task.parentTaskId) {
          if (
            typeof task.parentTaskId === "object" &&
            task.parentTaskId !== null
          ) {
            parentTaskId = task.parentTaskId._id || task.parentTaskId.id;
            console.log(
              "✅ [COMMENT DEBUG] Step 6: Extracted from parentTaskId object:",
              parentTaskId,
            );
          } else if (typeof task.parentTaskId === "string") {
            parentTaskId = task.parentTaskId;
            console.log(
              "✅ [COMMENT DEBUG] Step 6: Used parentTaskId string:",
              parentTaskId,
            );
          }
        }

        // Final validation - ensure it's a string
        if (!parentTaskId || typeof parentTaskId !== "string") {
          console.error("❌ [COMMENT DEBUG] ERROR: Invalid parentTaskId:", {
            parentTaskId,
            type: typeof parentTaskId,
            taskParentTask: task.parentTask,
            taskParentTaskId: task.parentTaskId,
          });
          showErrorToast(
            "Error: Cannot find parent task ID for subtask comment",
          );
          return;
        }

        console.log(
          "🎯 [COMMENT DEBUG] Step 7: Final parentTaskId:",
          parentTaskId,
        );
        console.log(
          "🎯 [COMMENT DEBUG] Step 7: Final parentTaskId type:",
          typeof parentTaskId,
        );
        console.log("🎯 [COMMENT DEBUG] Step 7: subtaskId (taskId):", taskId);

        apiUrl = `/api/tasks/${parentTaskId}/subtasks/${taskId}/comments`;
        console.log(
          "🌐 [COMMENT DEBUG] Step 8: Constructed URL for subtask:",
          apiUrl,
        );
      } else {
        apiUrl = `/api/tasks/${taskId}/comments`;
        console.log(
          "🌐 [COMMENT DEBUG] Step 8: Constructed URL for regular task:",
          apiUrl,
        );
      }

      // Prepare request body - use FormData if attachments are present
      let requestBody;
      let requestHeaders = {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      };

      if (commentData.attachments && commentData.attachments.length > 0) {
        // Use FormData for file uploads
        const formData = new FormData();
        formData.append("content", commentData.content);

        if (commentData.mentions && commentData.mentions.length > 0) {
          formData.append("mentions", JSON.stringify(commentData.mentions));
        }

        if (commentData.parentId) {
          formData.append("parentId", commentData.parentId);
        }

        // Append files
        commentData.attachments.forEach((file) => {
          formData.append("attachments", file);
        });

        requestBody = formData;
        // Don't set Content-Type for FormData - browser will set it with boundary
      } else {
        // Use JSON for text-only comments
        requestHeaders["Content-Type"] = "application/json";
        requestBody = JSON.stringify({
          content: commentData.content,
          mentions: commentData.mentions || [],
          parentId: commentData.parentId || null,
        });
      }

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: requestHeaders,
        body: requestBody,
      });

      if (response.ok) {
        const result = await response.json();
        console.log("DEBUG - Comment added successfully:", result);

        // 🔔 Invalidate notifications cache to show comment/mention notifications immediately
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        showSuccessToast("Comment added successfully");
        // Refresh comments and activities
        await fetchComments();
        await fetchActivities();
      } else {
        // Handle specific status codes
        if (response.status === 413) {
          showErrorToast(
            "File(s) too large. Maximum size allowed is 2MB per attachment.",
          );
          return;
        }

        // Try to parse error details if possible
        try {
          const errorData = await response.json();
          console.error("Failed to add comment:", errorData);
          showErrorToast(errorData.message || response.statusText);
        } catch (parseError) {
          console.error("Failed to parse error response:", parseError);
          showErrorToast("Server error: " + response.status);
        }
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      showErrorToast("Error adding comment: " + error.message);
    }
  };

  const handleReplyToComment = async (commentId, replyData) => {
    try {
      console.log("DEBUG - handleReplyToComment called with:", {
        commentId,
        replyData,
      });
      const baseUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

      let apiUrl;
      // Check if this is a subtask
      if (task?.parentTask || task?.parentTaskId || task?.isSubtask) {
        // Extract parent task ID properly - handle both object and string formats
        let parentTaskId;

        if (task.parentTask) {
          if (typeof task.parentTask === "object" && task.parentTask !== null) {
            parentTaskId = task.parentTask._id || task.parentTask.id;
          } else if (typeof task.parentTask === "string") {
            parentTaskId = task.parentTask;
          }
        }

        // Fallback to parentTaskId if not found yet
        if (!parentTaskId && task.parentTaskId) {
          if (
            typeof task.parentTaskId === "object" &&
            task.parentTaskId !== null
          ) {
            parentTaskId = task.parentTaskId._id || task.parentTaskId.id;
          } else if (typeof task.parentTaskId === "string") {
            parentTaskId = task.parentTaskId;
          }
        }

        // Final validation
        if (!parentTaskId || typeof parentTaskId !== "string") {
          console.error("ERROR: Invalid parentTaskId for reply:", parentTaskId);
          showErrorToast("Cannot find parent task ID for subtask reply");
          return;
        }

        apiUrl = `/api/tasks/${parentTaskId}/subtasks/${taskId}/comments/${commentId}/reply`;
        console.log("DEBUG - Adding subtask reply to:", apiUrl, {
          parentTaskId,
        });
      } else {
        apiUrl = `/api/tasks/${taskId}/comments/${commentId}/reply`;
        console.log("DEBUG - Adding task reply to:", apiUrl);
      }

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          content: replyData.content,
          mentions: replyData.mentions || [],
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("DEBUG - Reply added successfully:", result);

        // Refresh comments and activities to show the new reply and update count
        await fetchComments();
        await fetchActivities();

        showSuccessToast("Reply added successfully");
      } else {
        if (response.status === 413) {
          showErrorToast("Reply too large. Maximum size allowed is 2MB.");
          return;
        }
        try {
          const errorData = await response.json();
          console.error("Failed to add reply:", errorData);
          showErrorToast(errorData.message || response.statusText);
        } catch (parseError) {
          showErrorToast("Server error: " + response.status);
        }
      }
    } catch (error) {
      console.error("Error adding reply:", error);
      showErrorToast("Error adding reply: " + error.message);
    }
  };

  const handleEditComment = async (commentId, commentData, isReply = false) => {
    try {
      const baseUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

      let apiUrl;
      // Check if this is a subtask
      if (task?.parentTask || task?.parentTaskId) {
        // Extract parent task ID properly - handle both object and string formats
        let parentTaskId;

        if (task.parentTask) {
          if (typeof task.parentTask === "object" && task.parentTask !== null) {
            parentTaskId = task.parentTask._id || task.parentTask.id;
          } else if (typeof task.parentTask === "string") {
            parentTaskId = task.parentTask;
          }
        }

        // Fallback to parentTaskId if not found yet
        if (!parentTaskId && task.parentTaskId) {
          if (
            typeof task.parentTaskId === "object" &&
            task.parentTaskId !== null
          ) {
            parentTaskId = task.parentTaskId._id || task.parentTaskId.id;
          } else if (typeof task.parentTaskId === "string") {
            parentTaskId = task.parentTaskId;
          }
        }

        // Final validation
        if (!parentTaskId || typeof parentTaskId !== "string") {
          console.error("ERROR: Invalid parentTaskId for edit:", parentTaskId);
          showErrorToast(
            "Error: Cannot find parent task ID for subtask comment",
          );
          return;
        }

        apiUrl = `/api/tasks/${parentTaskId}/subtasks/${taskId}/comments/${commentId}`;
        console.log("DEBUG - Editing subtask comment at:", apiUrl, {
          parentTaskId,
        });
      } else {
        apiUrl = `/api/tasks/${taskId}/comments/${commentId}`;
        console.log("DEBUG - Editing task comment at:", apiUrl);
      }

      console.log("🔄 [EDIT] Step 9: Sending PUT request to:", apiUrl);
      console.log("📤 [EDIT] Step 10: Request body:", {
        content: commentData.content,
        mentions: commentData.mentions || [],
      });

      const response = await fetch(apiUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          content: commentData.content,
          mentions: commentData.mentions || [],
        }),
      });

      console.log("📡 [EDIT] Step 11: Response status:", response.status);

      if (response.ok) {
        const result = await response.json();
        console.log("✅ [EDIT] Step 12: Comment edited successfully:", result);
        console.log("🔍 [EDIT] Step 13: Comments BEFORE refresh:", comments);

        // Refresh comments and activities
        await fetchComments();
        console.log("🔍 [EDIT] Step 14: Comments AFTER refresh:", comments);

        await fetchActivities();

        const successMessage = isReply
          ? "Reply edited successfully"
          : "Comment edited successfully";
        showSuccessToast(successMessage);
      } else {
        if (response.status === 413) {
          showErrorToast("Comment too large. Maximum size allowed is 2MB.");
          return;
        }
        try {
          const errorData = await response.json();
          console.error("❌ [EDIT] Failed to edit comment:", errorData);
          showErrorToast(errorData.message || response.statusText);
        } catch (parseError) {
          showErrorToast("Server error: " + response.status);
        }
      }
    } catch (error) {
      console.error("Error editing comment:", error);
      showErrorToast("Error editing comment: " + error.message);
    }
  };

  const handleDeleteComment = async (commentId, isReply = false) => {
    try {
      const baseUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

      let apiUrl;
      // Check if this is a subtask
      if (task?.parentTask || task?.parentTaskId) {
        // Extract parent task ID properly - handle both object and string formats
        let parentTaskId;

        if (task.parentTask) {
          if (typeof task.parentTask === "object" && task.parentTask !== null) {
            parentTaskId = task.parentTask._id || task.parentTask.id;
          } else if (typeof task.parentTask === "string") {
            parentTaskId = task.parentTask;
          }
        }

        // Fallback to parentTaskId if not found yet
        if (!parentTaskId && task.parentTaskId) {
          if (
            typeof task.parentTaskId === "object" &&
            task.parentTaskId !== null
          ) {
            parentTaskId = task.parentTaskId._id || task.parentTaskId.id;
          } else if (typeof task.parentTaskId === "string") {
            parentTaskId = task.parentTaskId;
          }
        }

        // Final validation
        if (!parentTaskId || typeof parentTaskId !== "string") {
          console.error(
            "ERROR: Invalid parentTaskId for delete:",
            parentTaskId,
          );
          showErrorToast(
            "Error: Cannot find parent task ID for subtask comment",
          );
          return;
        }

        apiUrl = `/api/tasks/${parentTaskId}/subtasks/${taskId}/comments/${commentId}`;
        console.log("DEBUG - Deleting subtask comment at:", apiUrl, {
          parentTaskId,
        });
      } else {
        apiUrl = `/api/tasks/${taskId}/comments/${commentId}`;
      }

      const response = await fetch(apiUrl, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        console.log("DEBUG - Comment deleted successfully");

        // Refresh comments and activities
        await fetchComments();
        await fetchActivities();
        const successMessage = isReply
          ? "Reply deleted successfully"
          : "Comment deleted successfully";
        showSuccessToast(successMessage);
      } else {
        const errorData = await response.json();
        console.error("Failed to delete comment:", errorData);
        showErrorToast("Failed to delete comment: " + errorData.message);
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
      showErrorToast("Error deleting comment: " + error.message);
    }
  };

  // Helper function to check if task type allows subtasks
  // ✅ Only regular and recurring tasks can have subtasks
  const shouldShowSubtasksTab = () => {
    // Don't show subtasks tab if this is a subtask itself
    if (task?.parentTaskId) return false;

    const taskType = task?.taskType?.toLowerCase() || "";
    const mainTaskType = task?.mainTaskType?.toLowerCase() || "";
    const type = task?.type?.toLowerCase() || "";

    // ✅ Only show for regular and recurring tasks
    const isRegular =
      taskType === "regular" ||
      mainTaskType === "regular" ||
      type === "regular";
    const isRecurring =
      taskType === "recurring" ||
      mainTaskType === "recurring" ||
      type === "recurring";

    console.log("DEBUG - shouldShowSubtasksTab:", {
      taskType,
      mainTaskType,
      type,
      isRegular,
      isRecurring,
      activeRole,
      shouldShow: isRegular || isRecurring,
    });

    return isRegular || isRecurring;
  };

  // Helper function to check if Linked Items tab should be shown
  // ✅ Only milestone tasks can have linked items
  const shouldShowLinkedItemsTab = () => {
    if (!task) return false;

    const taskType = task?.taskType?.toLowerCase() || "";
    const mainTaskType = task?.mainTaskType?.toLowerCase() || "";
    const type = task?.type?.toLowerCase() || "";

    // ✅ Only show linked items tab for milestone tasks
    const isMilestone =
      taskType === "milestone" ||
      mainTaskType === "milestone" ||
      type === "milestone";

    console.log("DEBUG - shouldShowLinkedItemsTab:", {
      taskType,
      mainTaskType,
      type,
      isMilestone,
    });

    return isMilestone;
  };

  // Helper function to check if Attached Forms tab should be shown
  // ✅ Show if task or any subtask has attached forms
  const shouldShowAttachedFormsTab = () => {
    if (!task || !rawTaskData) return false;

    // Check if main task has attached form
    if (rawTaskData.attached_form_version_id) return true;

    // Check if any subtask has attached form
    if (rawTaskData.subtasks && rawTaskData.subtasks.length > 0) {
      return rawTaskData.subtasks.some((st) => st.attached_form_version_id);
    }

    return false;
  };

  const tabs = [
    { id: "core-info", label: "Core Info", icon: ClipboardList, hasIcon: true },
    // Only show subtasks tab for regular and recurring tasks (not for subtasks, milestones, or approval tasks)
    ...(shouldShowSubtasksTab()
      ? [
          {
            id: "subtasks",
            label: "Subtasks",
            icon: CheckSquare,
            count: task?.subtasks?.length || 0,
            hasIcon: true,
          },
        ]
      : []),
    {
      id: "comments",
      label: "Comments",
      icon: MessageCircle,
      count: commentsCount,
      hasIcon: true,
    },
    { id: "files", label: "Files & Links", icon: Paperclip, hasIcon: true },
    { id: "activity", label: "Activity Feed", icon: Activity, hasIcon: true },

    // ✅ Only show Linked Items tab for milestone tasks
    ...(shouldShowLinkedItemsTab()
      ? [
          {
            id: "linked",
            label: "Linked Items",
            icon: Link,
            count: task?.linkedItems?.length || 0,
            hasIcon: true,
          },
        ]
      : []),
    // ✅ Show Attached Forms tab if task or subtasks have forms
    ...(shouldShowAttachedFormsTab()
      ? [
          {
            id: "forms",
            label: "Attached Forms",
            icon: FileText,
            hasIcon: true,
          },
        ]
      : []),
  ];

  console.log("DEBUG - Tabs subtask count:", task?.subtasks?.length);

  const now = new Date();
  const snoozedUntil = task?.snoozedUntil ? new Date(task.snoozedUntil) : null;
  const isSnoozed = snoozedUntil && snoozedUntil > now;

  // Debug logging
  console.log("DEBUG - Permission Check Inputs:", {
    currentUserExists: !!currentUser,
    currentUserId: currentUser?.id,
    currentUserRole: currentUser?.role,
    activeRole: activeRole,
    taskExists: !!task,
    taskId: task?._id,
    taskCollaborators: task?.collaborators?.length || 0,
  });

  // Enhanced permission checks - use actual user role-based permissions
  // ⚠️ IMPORTANT: Pass comments with task object so mention checking works!
  const taskWithComments = task ? { ...task, comments } : null;

  const commentPermissions =
    currentUser && taskWithComments
      ? getUserPermissions(currentUser, taskWithComments, activeRole)
      : {
          canAdd: false,
          canEdit: false,
          canDelete: false,
          canView: true,
          canModerate: false,
          canAttachFiles: false,
          canMention: false,
        };

  console.log("✅ DEBUG - Comment Permissions Result:", {
    source: currentUser && task ? "getUserPermissions()" : "fallback",
    permissions: commentPermissions,
    currentUserRole: currentUser?.role,
    activeRole: activeRole,
    taskId: task?._id,
  });

  // Map permissions from getUserPermissions to expected properties
  const permissions = {
    canView: commentPermissions.canView || true,
    canEdit: commentPermissions.canEdit || false,
    canReassign:
      currentUser &&
      task &&
      (currentUser.id?.toString() === task.creatorId?.toString() ||
        currentUser.id?.toString() === task.createdBy?._id?.toString() ||
        currentUser.role === "org_admin" ||
        currentUser.role === "admin" ||
        currentUser.role === "tasksetu-admin" ||
        activeRole === "admin" ||
        activeRole === "manager"),
    canDelete:
      currentUser &&
      task &&
      (currentUser.id?.toString() === task.creatorId?.toString() ||
        currentUser.id?.toString() === task.createdBy?._id?.toString() ||
        currentUser.role === "org_admin" ||
        currentUser.role === "admin" ||
        currentUser.role === "tasksetu-admin" ||
        activeRole === "admin" ||
        activeRole === "manager"),
    canComment: commentPermissions.canAdd, // Map canAdd to canComment
    canAdd: commentPermissions.canAdd, // For TaskComments component
    canAddFiles: commentPermissions.canAttachFiles,
    canChangeStatus:
      currentUser &&
      task &&
      (currentUser.id?.toString() === task.assigneeId?.toString() ||
        currentUser.id?.toString() === task.creatorId?.toString() ||
        currentUser.role === "manager" ||
        currentUser.role === "org_admin" ||
        currentUser.role === "admin" ||
        currentUser.role === "tasksetu-admin" ||
        activeRole === "admin" ||
        activeRole === "manager"),
    canMention: commentPermissions.canMention,
    canModerate: commentPermissions.canModerate,
  };

  console.log("DEBUG - Final Permissions Object:", permissions);

  // Loading state
  if (loading) {
    return (
      <div className="task-view-container task-detail-page min-h-screen overflow-x-hidden px-3 sm:px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <Loader className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-lg text-gray-600">Loading task details...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="task-view-container task-detail-page min-h-screen overflow-x-hidden px-3 sm:px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500" />
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Failed to Load Task
              </h3>
              <p className="text-gray-600 mb-3">{error}</p>
              <Button variant="primary" className="h-9" onClick={fetchTaskData}>
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No task found state
  if (!task) {
    return (
      <div className="task-view-container task-detail-page min-h-screen overflow-x-hidden px-3 sm:px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="w-12 h-12 text-yellow-500" />
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Task Not Found
              </h3>
              <p className="text-gray-600">
                The requested task could not be found or you don't have
                permission to view it.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleStatusChange = async (newStatus, notes = null) => {
    const taskId = task?.id || task?._id;

    if (!taskId) {
      console.error("TaskDetail: Task ID not found for status update");
      showErrorToast("Task ID not found. Cannot update status.");
      return;
    }

    // ❌ Block status change for completed tasks
    if (task?.status === "DONE") {
      showErrorToast(
        "Task is already completed. Completed tasks cannot be edited.",
      );
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      console.log(
        `TaskDetail: Updating task ${taskId} status to ${newStatus}`,
        {
          taskTitle: task?.title || "Unknown",
          fromStatus: task?.status,
          toStatus: newStatus,
        },
      );

      const payload = { status: newStatus };
      if (newStatus === "DONE") {
        payload.progress = 100;
      }
      if (notes !== null) {
        payload.notes = notes;
      }

      const response = await axios.patch(
        `/api/tasks/${taskId}/status`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      console.log("TaskDetail: Status update successful:", response.data);

      // 🔔 Invalidate notifications cache to show new notifications immediately
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });

      // Update local state after successful API call
      setTask({
        ...task,
        status: newStatus,
        progress: newStatus === "DONE" ? 100 : task.progress,
      });

      // Refresh activities to show the status change
      fetchActivities();

      // Trigger color update events
      const statusEvent = new CustomEvent("taskStatusUpdated", {
        detail: {
          taskId: taskId,
          newStatus: newStatus,
          immediate: true,
        },
      });
      window.dispatchEvent(statusEvent);

      const colorEvent = new CustomEvent("taskColorUpdated", {
        detail: {
          taskId: taskId,
          newStatus: newStatus,
        },
      });
      window.dispatchEvent(colorEvent);
    } catch (error) {
      console.error("TaskDetail: Error updating status:", error);

      let errorMessage = "Failed to update task status";
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 401) {
        errorMessage = "Authentication failed. Please login again.";
      } else if (error.response?.status === 403) {
        errorMessage = "You do not have permission to update this task.";
      } else if (error.response?.status === 404) {
        errorMessage = "Task not found.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      showErrorToast(errorMessage);
    }
  };

  const handlePriorityChange = async (newPriority) => {
    // ❌ Block priority change for completed tasks
    if (task?.status === "DONE") {
      showErrorToast("Task is already completed. Priority cannot be changed.");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const taskIdToUpdate = task?._id || task?.id;

      console.log("⚡ Updating task priority:", {
        taskId: taskIdToUpdate,
        newPriority,
      });

      // Update via API
      const response = await axios.put(
        `/api/tasks/${taskIdToUpdate}`,
        { priority: newPriority },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.success) {
        // Update local state
        setTask({ ...task, priority: newPriority });
        showSuccessToast(`Priority changed to ${newPriority}`);

        // Refetch to ensure sync
        await fetchTaskData();
      }
    } catch (error) {
      console.error("❌ Error updating priority:", error);
      showErrorToast(error.response?.data?.message || error.message);
    }
  };

  const handleCreateSubtask = (subtaskData) => {
    const newSubtask = {
      id: Date.now(),
      ...subtaskData,
      parentTaskId: task.id,
      createdBy: currentUser.name,
      createdAt: new Date().toISOString(),
    };

    const updatedSubtasks = [...(task.subtasks || []), newSubtask];
    setTask({ ...task, subtasks: updatedSubtasks });
    setShowCreateSubtaskDrawer(false);

    // 🔔 Invalidate notifications cache to show subtask notification immediately
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });

    // Refresh activities to show subtask creation
    fetchActivities();
  };

  const handleMarkDone = () => {
    setShowDoneModal(true);
  };

  const handleCancelTask = async (reason) => {
    try {
      await handleStatusChange("CANCELLED", reason);
      setShowCancelModal(false);
    } catch (error) {
      console.error("❌ Error cancelling task:", error);
      showErrorToast("Unable to cancel task");
    }
  };

  const handleReassignTask = async (assigneeData) => {
    try {
      const token = localStorage.getItem("token");
      const taskIdToReassign = task?._id || task?.id;

      console.log("🔄 DEBUG - Reassigning task:", {
        taskIdToReassign,
        assigneeData,
        assigneeId: assigneeData.assigneeId,
        taskTitle: task?.title,
        endpoint: `/api/tasks/${taskIdToReassign}`,
        method: "PUT",
      });

      const response = await axios.put(
        `/api/tasks/${taskIdToReassign}`,
        {
          assignedTo: assigneeData.assigneeId || assigneeData,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.success) {
        console.log("Task reassigned successfully");

        // Update local state
        const updatedAssignee = assigneeData.assigneeName || "Reassigned User";
        setTask({
          ...task,
          assignee: updatedAssignee,
          assigneeId: assigneeData.assigneeId || assigneeData,
        });

        // Close modal
        setShowReassignModal(false);

        // Refresh task data to get latest info
        await fetchTaskData();
        await fetchActivities();

        showSuccessToast("Task reassigned");
      }
    } catch (error) {
      console.error("Error reassigning task:", error);
      showErrorToast(error.response?.data?.message || error.message);
    }
  };

  const handleSnoozeTask = async (snoozeData) => {
    try {
      // ❌ Block snooze for completed tasks
      if (task?.status === "DONE") {
        showErrorToast(
          "Task is already completed. Completed tasks cannot be snoozed.",
        );
        setShowSnoozeModal(false);
        return;
      }

      const token = localStorage.getItem("token");
      const taskIdToSnooze = task?._id || task?.id;

      console.log("⏰ Snoozing task:", taskIdToSnooze, "until:", snoozeData);

      // Prepare snooze data
      const snoozeUntil =
        snoozeData?.snoozeUntil || new Date(Date.now() + 3600000).toISOString();
      const reason =
        snoozeData?.reason ||
        snoozeData?.snoozeReason ||
        snoozeData?.snoozeNote ||
        "Task snoozed";

      console.log("DEBUG - Snooze request payload:", { snoozeUntil, reason });

      // Use correct endpoint: /api/tasks/:id/snooze
      const response = await axios.patch(
        `/api/tasks/${taskIdToSnooze}/snooze`,
        {
          snoozeUntil,
          reason,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.success) {
        console.log("✅ Task snoozed successfully");

        // Update local state
        setTask({
          ...task,
          isSnooze: true,
          snoozedUntil: snoozeUntil,
          snoozeNote: reason,
          snoozeUntil: snoozeUntil,
          snoozeReason: reason,
        });

        // Close modal
        setShowSnoozeModal(false);

        // Refresh task data and activities
        await fetchTaskData();
        await fetchActivities();

        showSuccessToast("Task snoozed");
      }
    } catch (error) {
      console.error("❌ Error snoozing task:", error);
      showErrorToast(error.response?.data?.message || error.message);
    }
  };

  const handleUnsnoozeTask = async () => {
    try {
      const token = localStorage.getItem("token");
      const taskIdToUnsnooze = task?._id || task?.id;

      console.log("⏰ Unsnoozing task:", taskIdToUnsnooze);

      // Use correct endpoint: /api/tasks/:id/unsnooze
      const response = await axios.patch(
        `/api/tasks/${taskIdToUnsnooze}/unsnooze`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.success) {
        console.log("✅ Task unsnoozed successfully");

        // Update local state
        setTask({
          ...task,
          isSnooze: false,
          snoozedUntil: null,
          snoozeNote: null,
          snoozeUntil: null,
          snoozeReason: null,
        });

        // Refresh task data and activities
        await fetchTaskData();
        await fetchActivities();

        showSuccessToast("Task woken up");
      }
    } catch (error) {
      console.error("❌ Error unsnoozing task:", error);
      showErrorToast(error.response?.data?.message || error.message);
    }
  };

  const handleMarkRisk = async (riskData) => {
    try {
      // ❌ Block mark as risk for completed tasks
      if (task?.status === "DONE") {
        showErrorToast(
          "Task is already completed. Completed tasks cannot be marked as risk.",
        );
        setShowRiskModal(false);
        return;
      }

      const token = localStorage.getItem("token");
      const taskIdToMark = task?._id || task?.id;

      const riskReason =
        riskData?.riskReason ||
        riskData?.riskNote ||
        riskData ||
        "Task requires attention";
      const riskLevel = riskData?.riskLevel || "medium";

      console.log(
        "⚠️ Marking task as risk:",
        taskIdToMark,
        "with note:",
        riskReason,
      );
      console.log("DEBUG - Risk request payload:", { riskLevel, riskReason });

      // Use correct endpoint: /api/tasks/:id/mark-risk
      const response = await axios.patch(
        `/api/tasks/${taskIdToMark}/mark-risk`,
        {
          riskLevel,
          riskReason,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.success) {
        console.log("✅ Task marked as risk successfully");

        // Update local state
        setTask({
          ...task,
          isRisk: true,
          isRisky: true,
          riskNote: riskReason,
          riskReason: riskReason,
          riskLevel: riskLevel,
        });

        // Notify AllTasks list to update its local state immediately
        window.dispatchEvent(
          new CustomEvent("taskRiskUpdated", {
            detail: {
              taskId: taskIdToMark,
              isRisk: true,
              riskLevel,
              riskReason,
            },
          }),
        );

        // Close modal
        setShowRiskModal(false);

        // Refresh task data and activities
        await fetchTaskData();
        await fetchActivities();

        showSuccessToast("Task marked as risk");
      }
    } catch (error) {
      console.error("❌ Error marking task as risk:", error);
      showErrorToast(error.response?.data?.message || error.message);
    }
  };

  const handleUnmarkRisk = async (reason) => {
    try {
      const token = localStorage.getItem("token");
      const taskIdToUnmark = task?._id || task?.id;

      console.log(
        "✅ Unmarking task as risk (mitigated):",
        taskIdToUnmark,
        "Reason:",
        reason,
      );

      const response = await axios.patch(
        `/api/tasks/${taskIdToUnmark}/unmark-risk`,
        { mitigationReason: reason },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.data.success) {
        showSuccessToast("Task risk marked as mitigated");

        // Notify AllTasks list to update its local state immediately
        window.dispatchEvent(
          new CustomEvent("taskRiskUpdated", {
            detail: {
              taskId: taskIdToUnmark,
              isRisk: false,
              riskLevel: null,
              riskReason: null,
            },
          }),
        );

        // Refresh todo items
        fetchTaskData();
        fetchActivities();
      }
    } catch (err) {
      console.error("Error unmarking risk:", err);
      showErrorToast(
        err.response?.data?.message || err.message || "Failed to unmark risk",
      );
    }
  };

  const handleExportTask = () => {
    try {
      console.log("Exporting task:", task);

      // Create a formatted text version of the task
      const taskExport = `
TASK DETAILS
============
Title: ${task.title}
Status: ${task.status}
Priority: ${task.priority}
Assignee: ${task.assignee}
Created By: ${task.createdBy}
Due Date: ${task.dueDate}
Created: ${task.createdAt}
Updated: ${task.updatedAt}

DESCRIPTION
===========
${task.description}

TAGS
====
${task.tags?.join(", ") || "No tags"}

SUBTASKS (${task.subtasks?.length || 0})
========
${task.subtasks?.map((st, idx) => `${idx + 1}. ${st.title} - ${st.status}`).join("\n") || "No subtasks"}

COLLABORATORS
=============
${task.collaborators?.join(", ") || "No collaborators"}
      `.trim();

      // Create a blob and download
      const blob = new Blob([taskExport], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `task-${task.id || task._id}-${task.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showSuccessToast("Task exported");
    } catch (error) {
      console.error("Error exporting task:", error);
      showErrorToast(error.message || "Unable to export task");
    }
  };

  // Handler for opening form submission modal
  const handleOpenFormSubmission = (formData) => {
    console.log("🔵 Opening form submission modal:", formData);
    console.log("🔵 Modal state before:", showFormSubmissionModal);
    setSelectedFormData(formData);
    setShowFormSubmissionModal(true);
    console.log("🔵 Modal state set to true");
  };

  const handleCloseFormSubmission = (submitted) => {
    console.log("🔴 Closing form submission modal");
    setShowFormSubmissionModal(false);
    setSelectedFormData(null);

    // Refresh task data if form was submitted
    if (submitted) {
      fetchTaskData();
    }
  };

  const handleTimeEstimateUpdate = async () => {
    // ❌ Block time estimate update for completed or cancelled tasks
    if (task?.status === "DONE" || task?.status === "CANCELLED") {
      const msg = task?.status === "DONE" ? "completed" : "cancelled";
      showErrorToast(
        `Task is already ${msg}. Time estimate cannot be changed.`,
      );
      setIsEditingTimeEstimate(false);
      return;
    }

    // If empty or invalid, reset to 0
    let newValue = parseFloat(timeEstimateInput);
    if (isNaN(newValue) || newValue < 0) newValue = 0;

    try {
      const token = localStorage.getItem("token");
      const taskIdToUpdate = task?._id || task?.id;

      // Update backend
      await axios.patch(
        `/api/tasks/${taskIdToUpdate}`,
        { timeEstimate: newValue },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      // Update local state
      setTask((prev) => ({ ...prev, timeEstimate: newValue }));
      setIsEditingTimeEstimate(false);
      showSuccessToast("Time estimate updated");

      // Immediately refresh activity feed to show the change
      console.log(
        "🔄 [TIME ESTIMATE] Fetching activities immediately after update...",
      );
      await fetchActivities();
    } catch (error) {
      console.error("Error updating time estimate:", error);
      showErrorToast("Failed to update time estimate");
      // Revert if failed (optional, but good UX)
      setTimeEstimateInput(task.timeEstimate?.toString() || "0");
    }
  };

  const handleProgressUpdate = async () => {
    if (task?.status === "DONE" || task?.status === "CANCELLED") {
      setIsEditingProgress(false);
      return;
    }

    let newValue = parseInt(progressInput, 10);
    if (isNaN(newValue) || newValue < 0) newValue = 0;
    if (newValue > 95) newValue = 95;

    try {
      const token = localStorage.getItem("token");
      const taskIdToUpdate = task?._id || task?.id;

      await axios.patch(
        `/api/tasks/${taskIdToUpdate}`,
        { progress: newValue },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      setTask((prev) => ({ ...prev, progress: newValue }));
      setIsEditingProgress(false);
      showSuccessToast("Progress updated");
    } catch (error) {
      console.error("Error updating progress:", error);
      showErrorToast("Failed to update progress");
      setProgressInput(task.progress?.toString() || "0");
    }
  };

  const handleDescriptionUpdate = async () => {
    if (task?.status === "DONE" || task?.status === "CANCELLED") {
      const msg = task?.status === "DONE" ? "completed" : "cancelled";
      showErrorToast(`Task is already ${msg}. Description cannot be changed.`);
      setIsEditingDescription(false);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const taskIdToUpdate = task?._id || task?.id;

      await axios.put(
        `/api/tasks/${taskIdToUpdate}`,
        { description: descriptionInput },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      setTask((prev) => ({ ...prev, description: descriptionInput }));
      setIsEditingDescription(false);
      showSuccessToast("Description updated");
      await fetchActivities();
    } catch (error) {
      console.error("Error updating description:", error);
      showErrorToast("Failed to update description");
    }
  };

  const handleTagsUpdate = async () => {
    if (task?.status === "DONE" || task?.status === "CANCELLED") {
      const msg = task?.status === "DONE" ? "completed" : "cancelled";
      showErrorToast(`Task is already ${msg}. Tags cannot be changed.`);
      setIsEditingTags(false);
      return;
    }

    const newTags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const token = localStorage.getItem("token");
      const taskIdToUpdate = task?._id || task?.id;

      await axios.put(
        `/api/tasks/${taskIdToUpdate}`,
        { tags: newTags },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      setTask((prev) => ({ ...prev, tags: newTags }));
      setIsEditingTags(false);
      showSuccessToast("Tags updated");
      await fetchActivities();
    } catch (error) {
      console.error("Error updating tags:", error);
      showErrorToast("Failed to update tags");
    }
  };

  const handleDueDateUpdate = async () => {
    if (task?.status === "DONE" || task?.status === "CANCELLED") {
      const msg = task?.status === "DONE" ? "completed" : "cancelled";
      showErrorToast(`Task is already ${msg}. Due date cannot be changed.`);
      setIsEditingDueDate(false);
      return;
    }

    // Validate: due date cannot be in the past
    if (dueDateInput) {
      // dueDateInput is stored as UTC (Z is appended by server), so compare against UTC now
      const selectedUTC = new Date(dueDateInput + "Z");
      const nowUTC = new Date();
      if (selectedUTC < nowUTC) {
        showErrorToast("Due date cannot be set to a past date or time.");
        return;
      }
    }

    try {
      const token = localStorage.getItem("token");
      const taskIdToUpdate = task?._id || task?.id;

      const dueDateValue = dueDateInput || null;

      await axios.put(
        `/api/tasks/${taskIdToUpdate}`,
        { dueDate: dueDateValue },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      await fetchTaskData();
      setIsEditingDueDate(false);
      showSuccessToast("Due date updated");
      await fetchActivities();
    } catch (error) {
      console.error("Error updating due date:", error);
      showErrorToast("Failed to update due date");
    }
  };
  return (
    <div className="task-view-container task-detail-page min-h-screen overflow-x-hidden [&_.card]:!rounded-sm [&_input:not([type='checkbox']):not([type='radio'])]:!rounded-sm [&_select]:!rounded-sm [&_textarea]:!rounded-sm [&_.form-input]:!rounded-sm [&_.form-select]:!rounded-sm [&_.form-textarea]:!rounded-sm [&_button:not(.rounded-full)]:!rounded-sm [&_table]:!rounded-sm [&_.bg-white.border]:!rounded-sm [&_.rounded-sm]:!rounded-sm [&_.rounded-md]:!rounded-sm [&_.rounded-lg]:!rounded-sm [&_.rounded-xl]:!rounded-sm [&_.rounded-2xl]:!rounded-sm [&_.rounded]:!rounded-sm [&_.rounded-r-lg]:!rounded-r-sm [&_.rounded-r-md]:!rounded-r-sm [&_.rounded-none]:!rounded-sm">
      {/* 4.14 Task Header Bar - Enhanced for visibility and quick actions as per specifications */}
      <div className="task-header-section bg-white border-b px-2 sm:px-4 lg:px-6 py-3 sm:py-4 shadow-sm">
        <div className="flex flex-col gap-3 mb-3">
          {/* Top Row: Title + Status/Priority + Assignee */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            {/* Left: Title */}
            <div className="flex-1 min-w-0">
              <h1
                className="text-xl sm:text-2xl font-bold text-gray-900 break-words sm:truncate sm:leading-tight leading-snug"
                title={task.title}
              >
                {task.title}
              </h1>
            </div>

            {/* Right: Quick Status Info */}
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-start sm:justify-end w-full sm:w-auto">
              <span
                className={`status-badge ${task.status?.toLowerCase()} px-3 py-1.5 rounded-none text-[12px] font-black uppercase tracking-wider border`}
              >
                {task.status}
              </span>

              {/* Priority*/}
              <span
                className={`priority-badge ${task.priority?.toLowerCase()} px-3 py-1.5 rounded-none text-[12px] font-black uppercase tracking-wider border`}
              >
                {task.priority}
              </span>

              {/* ✅ Snooze Indicator */}
              {isSnoozed && (
                <span className="px-3 py-1.5 rounded-none text-[12px] font-black uppercase tracking-wider border bg-emerald-50 border-emerald-200 text-emerald-700 flex items-center gap-1.5">
                  <Clock size={12} className="inline" />
                  Snoozed until{" "}
                  {snoozedUntil?.toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
              )}

              {/* ✅ Risk Indicator */}
              {task.isRisk && (
                <span className="px-3 py-1.5 rounded-none text-[12px] font-black uppercase tracking-wider border bg-red-50 border-red-200 text-red-700 flex items-center gap-1.5">
                  <AlertTriangle size={12} className="inline" />
                  At Risk
                </span>
              )}
            </div>
          </div>

          {/* Second Row: Assignee + Tags */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-wrap">
            {/* Assignee */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-none bg-blue-500 text-white flex items-center justify-center flex-shrink-0">
                <User size={12} className="font-bold" />
              </div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                Assignee:
              </span>
              <span className="text-sm font-bold text-blue-900">
                {task.assignee || "Unassigned"}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="action-buttons-group rounded-none border border-slate-200 p-2 sm:p-3 mb-2 sm:mb-3">
          <div className="flex flex-wrap items-center gap-2 w-full">
            {task?.status === "CANCELLED" ? null : (
              <>
                {!task.isSubtask &&
                  shouldShowSubtasksTab() &&
                  (() => {
                    const isRecurringTask =
                      task.isRecurring || task.mainTaskType === "recurring";

                    const isContributor =
                      isRecurringTask &&
                      task.contributors?.some((contributor) => {
                        const contribId =
                          contributor?._id?.toString() ||
                          contributor?.id?.toString() ||
                          String(contributor);
                        const userId =
                          currentUser?.id?.toString?.() ||
                          currentUser?.id?.toString?.() ||
                          String(currentUser?.id || currentUser?._id);
                        return contribId === userId;
                      });

                    const createdByUserId =
                      task?.createdBy?._id?.toString?.() ||
                      task?.createdBy?.toString?.() ||
                      String(task?.createdBy);
                    const assignedToUserId =
                      task?.assignedTo?._id?.toString?.() ||
                      task?.assignedTo?.toString?.() ||
                      String(task?.assignedTo);
                    const currentUserId =
                      currentUser?.id?.toString?.() ||
                      String(currentUser?.id || currentUser?._id);

                    const isCreatorOrAssignee =
                      createdByUserId === currentUserId ||
                      assignedToUserId === currentUserId;

                    const canCreateSubtask =
                      !isContributor || isCreatorOrAssignee;
                    const isTaskDone = task?.status === "DONE";

                    return canCreateSubtask ? (
                      <Button
                        variant="primary"
                        className="h-8 px-3 text-[11px] font-bold"
                        onClick={() => {
                          if (task?.status === "DONE") {
                            showErrorToast(
                              "Cannot create subtask: Task is already completed.",
                            );
                            return;
                          }
                          if (task?.isSubtask === true || task?.parentTaskId) {
                            showErrorToast(
                              "Nested subtasks are not allowed. Only 1 level of hierarchy is supported.",
                            );
                            return;
                          }
                          if (
                            task?.taskType === "approval" ||
                            task?.isApprovalTask === true
                          ) {
                            showErrorToast(
                              "Subtasks are not allowed for Approval tasks.",
                            );
                            return;
                          }
                          if (
                            task?.taskType === "quick" ||
                            task?.isQuickTask === true
                          ) {
                            showErrorToast(
                              "Subtasks are not allowed for Quick tasks.",
                            );
                            return;
                          }
                          if (!checkFeature("TASK_SUB")) {
                            setShowUpgradeModal(true);
                            return;
                          }

                          openSubtaskDrawer(task, null, fetchTaskData);
                        }}
                      >
                        <Plus size={14} /> Subtask
                      </Button>
                    ) : null;
                  })()}

                {(() => {
                  const showReassign =
                    activeRole !== "individual" &&
                    currentUser?.id === task?.creatorId;
                  const isTaskDone = task?.status === "DONE";
                  return showReassign &&
                    task?.status !== "APPROVED" &&
                    task?.status !== "REJECTED" ? (
                    <Button
                      variant="outline"
                      className="h-8 px-3 border-slate-300 hover:bg-white text-[11px] font-bold"
                      onClick={() => setShowReassignModal(true)}
                      disabled={isTaskDone}
                      style={
                        isTaskDone
                          ? { opacity: 0.5, cursor: "not-allowed" }
                          : {}
                      }
                    >
                      <Users size={14} /> Reassign
                    </Button>
                  ) : null;
                })()}

                {/* Utility Actions - Right */}
                {(() => {
                  const isRecurringTask =
                    task.isRecurring || task.mainTaskType === "recurring";

                  const isContributor =
                    isRecurringTask &&
                    task.contributors?.some((contributor) => {
                      const contribId =
                        contributor?._id?.toString() ||
                        contributor?.id?.toString() ||
                        String(contributor);
                      const userId =
                        currentUser?.id?.toString?.() ||
                        currentUser?.id?.toString?.() ||
                        String(currentUser?.id || currentUser?._id);
                      return contribId === userId;
                    });

                  const createdByUserId =
                    task?.createdBy?._id?.toString?.() ||
                    task?.createdBy?.toString?.() ||
                    String(task?.createdBy);
                  const assignedToUserId =
                    task?.assignedTo?._id?.toString?.() ||
                    task?.assignedTo?.toString?.() ||
                    String(task?.assignedTo);
                  const currentUserId =
                    currentUser?.id?.toString?.() ||
                    String(currentUser?.id || currentUser?._id);

                  const isCreatorOrAssignee =
                    createdByUserId === currentUserId ||
                    assignedToUserId === currentUserId;

                  const canSnooze = !isContributor || isCreatorOrAssignee;
                  const isMilestoneTask = task?.mainTaskType === "milestone";
                  const isTaskDone = task?.status === "DONE";

                  return canSnooze &&
                    !isMilestoneTask &&
                    task?.status !== "REJECTED" &&
                    task?.status !== "APPROVED" ? (
                    isSnoozed ? (
                      <Button
                        variant="outline"
                        className="h-8 px-3 border-emerald-400 text-emerald-700 hover:bg-emerald-50 text-[11px] font-bold"
                        onClick={handleUnsnoozeTask}
                        disabled={isTaskDone}
                        style={
                          isTaskDone
                            ? { opacity: 0.5, cursor: "not-allowed" }
                            : {}
                        }
                      >
                        <Clock size={14} /> Wake Up
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="h-8 px-3 border-slate-300 hover:bg-white text-[11px] font-bold"
                        onClick={() => setShowSnoozeModal(true)}
                        disabled={isTaskDone}
                        style={
                          isTaskDone
                            ? { opacity: 0.5, cursor: "not-allowed" }
                            : {}
                        }
                      >
                        <Clock size={14} /> Snooze
                      </Button>
                    )
                  ) : null;
                })()}

                {(() => {
                  const isRecurringTask =
                    task.isRecurring || task.mainTaskType === "recurring";

                  const isContributor =
                    isRecurringTask &&
                    task.contributors?.some((contributor) => {
                      const contribId =
                        contributor?._id?.toString() ||
                        contributor?.ikid?.toString() ||
                        String(contributor);
                      const userId =
                        currentUser?.id?.toString?.() ||
                        currentUser?.id?.toString?.() ||
                        String(currentUser?.id || currentUser?._id);
                      return contribId === userId;
                    });

                  const createdByUserId =
                    task?.createdBy?._id?.toString?.() ||
                    task?.createdBy?.toString?.() ||
                    String(task?.createdBy);
                  const assignedToUserId =
                    task?.assignedTo?._id?.toString?.() ||
                    task?.assignedTo?.toString?.() ||
                    String(task?.assignedTo);
                  const currentUserId =
                    currentUser?.id?.toString?.() ||
                    String(currentUser?.id || currentUser?._id);

                  const isCreatorOrAssignee =
                    createdByUserId === currentUserId ||
                    assignedToUserId === currentUserId;

                  const canMarkRisk =
                    isCreatorOrAssignee ||
                    !isContributor ||
                    [
                      "individual",
                      "employee",
                      "manager",
                      "admin",
                      "org_admin",
                    ].includes(activeRole);
                  const isMilestoneTask = task?.mainTaskType === "milestone";
                  const isTaskDone = task?.status === "DONE";

                  return canMarkRisk &&
                    !isMilestoneTask &&
                    task?.status !== "REJECTED" &&
                    task?.status !== "APPROVED" ? (
                    task?.isRisk ? (
                      <Button
                        variant="outline"
                        className="h-8 px-3 border-emerald-400 text-emerald-700 hover:bg-emerald-50 text-[11px] font-bold"
                        onClick={() => setShowMitigationModal(true)}
                        disabled={isTaskDone}
                        style={
                          isTaskDone
                            ? { opacity: 0.5, cursor: "not-allowed" }
                            : {}
                        }
                      >
                        <CheckCircle size={14} /> Mark as Mitigated
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="h-8 px-3 border-yellow-400 text-yellow-700 hover:bg-yellow-50 text-[11px] font-bold"
                        onClick={() => setShowRiskModal(true)}
                        disabled={isTaskDone}
                        style={
                          isTaskDone
                            ? { opacity: 0.5, cursor: "not-allowed" }
                            : {}
                        }
                      >
                        <AlertTriangle size={14} /> Mark as Risk
                      </Button>
                    )
                  ) : null;
                })()}

                {(() => {
                  const isMilestoneTask = task?.mainTaskType === "milestone";
                  const incompleteLinked = isMilestoneTask
                    ? (task?.linkedItems || []).filter(
                        (lt) =>
                          lt.status !== "DONE" && lt.status !== "CANCELLED",
                      )
                    : [];
                  const milestoneBlocked =
                    isMilestoneTask && incompleteLinked.length > 0;
                  const isDone = task?.status === "DONE";
                  const isDisabled = isDone || milestoneBlocked;

                  const isApprovalTask =
                    rawTaskData?.isApprovalTask || task?.isApprovalTask;
                  const currentUserId =
                    currentUser?.id?.toString() || currentUser?._id?.toString();
                  const isApprover =
                    isApprovalTask &&
                    rawTaskData?.approvers?.some((a) => {
                      const id =
                        typeof a === "string"
                          ? a
                          : a._id?.toString() || a?.id?.toString();
                      return id === currentUserId;
                    });

                  if (
                    isApprover ||
                    task?.isApprovalTask ||
                    task?.status === "REJECTED" ||
                    task?.status === "APPROVED"
                  )
                    return null;

                  return (
                    <Button
                      variant="primary"
                      className="h-8 px-3 bg-green-600 hover:bg-green-700 text-[11px] font-bold w-full sm:w-auto"
                      onClick={handleMarkDone}
                      disabled={isDisabled}
                      style={
                        isDisabled
                          ? { opacity: 0.5, cursor: "not-allowed" }
                          : {}
                      }
                      title={
                        milestoneBlocked
                          ? `Cannot mark milestone as Done. ${incompleteLinked.length} linked task(s) are still pending.`
                          : ""
                      }
                    >
                      <CheckCircle size={14} /> Mark as Done
                      {milestoneBlocked && (
                        <span className="text-[9px] ml-1 opacity-80">
                          ({incompleteLinked.length} linked pending)
                        </span>
                      )}
                    </Button>
                  );
                })()}

                {(() => {
                  const isRecurringTask =
                    task.isRecurring || task.mainTaskType === "recurring";

                  const isContributor =
                    isRecurringTask &&
                    task.contributors?.some((contributor) => {
                      const contribId =
                        contributor?._id?.toString() ||
                        contributor?.id?.toString() ||
                        String(contributor);
                      const userId =
                        currentUser?.id?.toString?.() ||
                        currentUser?.id?.toString?.() ||
                        String(currentUser?.id || currentUser?._id);
                      return contribId === userId;
                    });

                  const createdByUserId =
                    task?.createdBy?._id?.toString?.() ||
                    task?.createdBy?.toString?.() ||
                    String(task?.createdBy);
                  const assignedToUserId =
                    task?.assignedTo?._id?.toString?.() ||
                    task?.assignedTo?.toString?.() ||
                    String(task?.assignedTo);
                  const currentUserId =
                    currentUser?.id?.toString?.() ||
                    String(currentUser?.id || currentUser?._id);

                  const isCreatorOrAssignee =
                    createdByUserId === currentUserId ||
                    assignedToUserId === currentUserId;

                  const canCancelByRole = !isContributor || isCreatorOrAssignee;
                  const isTaskDone = task?.status === "DONE";

                  return canCancelByRole &&
                    task?.status !== "REJECTED" &&
                    task?.status !== "APPROVED" ? (
                    <Button
                      variant="destructive"
                      className="h-8 px-3 text-[11px] font-bold"
                      onClick={() => setShowCancelModal(true)}
                      disabled={isTaskDone}
                      style={
                        isTaskDone
                          ? { opacity: 0.5, cursor: "not-allowed" }
                          : {}
                      }
                      title="Cancel this task"
                    >
                      <X size={14} /> Cancel
                    </Button>
                  ) : null;
                })()}
              </>
            )}
            {/* ✅ Export button always enabled */}
            <Button
              variant="outline"
              className="h-8 px-3 ml-auto border-slate-300 hover:bg-white text-[11px] font-bold"
              onClick={handleExportTask}
            >
              <Download size={14} /> Export
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="task-tabs px-2 sm:px-4 lg:px-6">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
                style={{ padding: "12px", gap: "4px", minHeight: "42px" }}
              >
                <IconComponent className="tab-icon" size={16} />
                <span className="tab-label">{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="tab-count">{tab.count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Main Content Area */}
        <div className="task-content w-full max-w-[100vw] px-2 sm:px-4 lg:px-6 py-2 sm:py-3">
          {activeTab === "core-info" && (
            <div className="core-info-view space-y-2 sm:space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:gap-3">
                {/* Task Description Card - Full Width */}
                <div className="bg-white rounded-none border border-gray-200 overflow-hidden transition-all">
                  <div className="bg-slate-50/50 px-4 sm:px-6 py-2 sm:py-2.5 border-b border-gray-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-blue-100 rounded-none text-blue-600 shrink-0">
                        <ClipboardList size={12} />
                      </div>
                      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                        Task Description
                      </h3>
                    </div>
                    {!isEditingDescription &&
                      task.status !== "DONE" &&
                      task.status !== "CANCELLED" &&
                      task.approvalStatus !== "approved" &&
                      task.approvalStatus !== "rejected" && (
                        <button
                          onClick={() => {
                            setDescriptionInput(
                              task.description === "No description provided"
                                ? ""
                                : task.description.replace(/<[^>]*>/g, ""),
                            );
                            setIsEditingDescription(true);
                          }}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200 rounded-none transition-colors"
                        >
                          <Edit size={10} /> Edit
                        </button>
                      )}
                  </div>

                  <div className="p-3 sm:p-4">
                    {isEditingDescription ? (
                      <div className="space-y-2">
                        <textarea
                          value={descriptionInput}
                          onChange={(e) => setDescriptionInput(e.target.value)}
                          className="w-full min-h-[100px] px-3 py-2 text-sm border border-gray-300 rounded-none focus:ring-1 focus:ring-blue-500 focus:border-transparent resize-vertical"
                          placeholder="Enter task description..."
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleDescriptionUpdate}
                            className="px-3 py-1.5 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 border border-blue-600 rounded-none transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setIsEditingDescription(false);
                              setDescriptionInput("");
                            }}
                            className="px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-300 rounded-none transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="prose prose-slate max-w-none text-sm sm:text-base">
                        {task.description &&
                        task.description !== "No description provided" ? (
                          <SafeHtml
                            html={task.description}
                            className="task-description-content text-slate-600 leading-relaxed text-sm sm:text-base"
                          />
                        ) : (
                          <p className="text-slate-400 italic">
                            No description provided for this task. Add more
                            details to help your team understand the goal.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {task.subtasks && task.subtasks.length > 0 && (
                  <div className="bg-white rounded-none border border-gray-200 overflow-hidden transition-all">
                    <div className="bg-slate-50/50 px-4 sm:px-6 py-2 sm:py-2.5 border-b border-gray-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-purple-100 rounded-none text-purple-600 shrink-0">
                          <CheckSquare size={20} />
                        </div>
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                          Subtasks
                        </h3>
                      </div>
                      <span className="bg-purple-50 text-purple-600 px-3 py-1 rounded-none text-xs font-bold border border-purple-100">
                        {task.subtasks.length} Items
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="space-y-3">
                        {task.subtasks.map((subtask, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-none border border-gray-100 hover:bg-white transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">
                                {subtask.title}
                              </p>
                              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">
                                {subtask.status || "TODO"} •{" "}
                                {subtask.assignee || "Unassigned"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Second Row: Tags, Core Metrics, Quick Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
                  {/* Collaborators, Contributors & Tags Section */}
                  <div className="bg-white rounded-none border border-gray-200 overflow-hidden transition-all h-full">
                    <div className="bg-slate-50/50 px-4 sm:px-6 py-2 sm:py-2.5 border-b border-gray-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-cyan-100 rounded-none text-cyan-600 shrink-0">
                          <Users size={12} />
                        </div>
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                          {currentUser?.role !== "individual"
                            ? "Team & Tags"
                            : "Tags"}
                        </h3>
                      </div>
                    </div>
                    <div className="p-3 sm:p-4 space-y-3">
                      {/* Show Collaborators and Contributors ONLY for org users (manager, org_admin, employee) */}
                      {currentUser?.role !== "individual" && (
                        <>
                          {/* Collaborators */}
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-3">
                              Collaborators
                            </p>
                            {task.collaborators &&
                            task.collaborators.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {task.collaborators.map((collaborator, idx) => (
                                  <span
                                    key={idx}
                                    className="bg-blue-50 text-blue-700 px-3 py-1 rounded-none text-[11px] font-bold border border-blue-100 flex items-center gap-1"
                                  >
                                    <Users size={12} />
                                    {typeof collaborator === "string"
                                      ? collaborator
                                      : `${collaborator.firstName || ""} ${collaborator.lastName || ""}`.trim() ||
                                        "Unknown"}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[11px] text-gray-400 italic">
                                No collaborators assigned
                              </p>
                            )}
                          </div>

                          {/* Contributors (for Recurring Tasks) */}
                          {task.contributors &&
                            task.contributors.length > 0 && (
                              <div className="border-t border-gray-100 pt-4">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-3">
                                  Contributors
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {task.contributors.map((contributor, idx) => (
                                    <span
                                      key={idx}
                                      className="bg-orange-50 text-orange-700 px-3 py-1 rounded-none text-[11px] font-bold border border-orange-100 flex items-center gap-1"
                                    >
                                      <CheckCircle size={12} />
                                      {typeof contributor === "string"
                                        ? contributor
                                        : `${contributor.firstName || ""} ${contributor.lastName || ""}`.trim() ||
                                          "Unknown"}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                          {/* Tags border separator for org users */}
                          {task.contributors &&
                            task.contributors.length > 0 && (
                              <div className="border-t border-gray-100 pt-4"></div>
                            )}
                        </>
                      )}

                      {/* Tags - Show for all user types (hidden for approval tasks) */}
                      {task?.isApprovalTask ||
                      task?.taskType === "approval" ? null : (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                              Tags
                            </p>
                            {!isEditingTags &&
                              task.status !== "DONE" &&
                              task.status !== "CANCELLED" &&
                              task.approvalStatus !== "approved" &&
                              task.approvalStatus !== "rejected" && (
                                <button
                                  onClick={() => {
                                    setTagsInput(task.tags?.join(", ") || "");
                                    setIsEditingTags(true);
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200 rounded-none transition-colors"
                                >
                                  <Edit size={10} /> Edit
                                </button>
                              )}
                          </div>
                          {isEditingTags ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={tagsInput}
                                onChange={(e) => setTagsInput(e.target.value)}
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Enter tags separated by commas"
                                autoFocus
                              />
                              <p className="text-[9px] text-slate-400">
                                Separate tags with commas
                              </p>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={handleTagsUpdate}
                                  className="px-3 py-1.5 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 border border-blue-600 rounded-none transition-colors"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setIsEditingTags(false);
                                    setTagsInput("");
                                  }}
                                  className="px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-300 rounded-none transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {task.tags && task.tags.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {task.tags.map((tag, idx) => (
                                    <span
                                      key={idx}
                                      className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-none text-[11px] font-bold border border-indigo-100 flex items-center gap-1"
                                    >
                                      <Tag size={12} />#{tag}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-gray-400 italic">
                                  No tags assigned
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Core Metrics Card */}
                  <div className="bg-white rounded-none border border-gray-200 p-3 sm:p-4 transition-all h-full">
                    <div className="flex items-center gap-2 mb-3 text-slate-400">
                      <Zap size={16} />
                      <h3 className="text-xs font-bold uppercase tracking-widest">
                        Core Metrics
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {/* Due Date */}
                      <div className="flex items-start gap-3 group py-1">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-rose-50 text-rose-600 rounded-none transition-colors group-hover:bg-rose-600 group-hover:text-white shrink-0">
                          <AlertIcon size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5">
                            Due Date
                          </p>
                          <div className="flex flex-wrap gap-2 items-center">
                            {isEditingDueDate ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="datetime-local"
                                  value={dueDateInput}
                                  min={new Date().toISOString().slice(0, 16)}
                                  onChange={(e) =>
                                    setDueDateInput(e.target.value)
                                  }
                                  onBlur={handleDueDateUpdate}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      handleDueDateUpdate();
                                    if (e.key === "Escape") {
                                      setIsEditingDueDate(false);
                                      setDueDateInput("");
                                    }
                                  }}
                                  autoFocus
                                  className="px-1 py-0.5 text-xs border border-blue-300 rounded-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            ) : (
                              <div
                                className={`flex items-center gap-1.5 px-1 -ml-1 rounded-none transition-colors ${task.status === "DONE" || task.status === "CANCELLED" || task.isRecurring ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                                onClick={() => {
                                  if (
                                    task.status === "DONE" ||
                                    task.status === "CANCELLED" ||
                                    task.approvalStatus === "approved" ||
                                    task.approvalStatus === "rejected" ||
                                    task.isRecurring
                                  )
                                    return;
                                  // Pre-fill with stored value as-is (server stores what user enters)
                                  const rawDate = rawTaskData?.dueDate
                                    ? rawTaskData.dueDate.slice(0, 16)
                                    : new Date().toISOString().slice(0, 16);
                                  setDueDateInput(rawDate);
                                  setIsEditingDueDate(true);
                                }}
                                title={
                                  task.status === "DONE"
                                    ? "Cannot edit completed task"
                                    : task.status === "CANCELLED"
                                      ? "Cannot edit cancelled task"
                                      : task.approvalStatus === "approved"
                                        ? "Cannot edit approved task"
                                        : task.approvalStatus === "rejected"
                                          ? "Cannot edit rejected task"
                                          : task.isRecurring
                                            ? "Cannot edit due date of recurring tasks"
                                            : "Click to edit due date"
                                }
                              >
                                <span className="text-sm font-bold text-slate-900 leading-tight border-b border-dashed border-slate-300">
                                  {rawTaskData?.dueDate
                                    ? (() => {
                                        const d = new Date(rawTaskData.dueDate);
                                        return d
                                          .toLocaleString("en-GB", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            hour12: true,
                                            timeZone: "UTC",
                                          })
                                          .replace(",", "");
                                      })()
                                    : "No due date"}
                                </span>
                                {!task.isRecurring && (
                                  <Pen
                                    size={10}
                                    className="text-slate-400 opacity-90 transition-opacity"
                                  />
                                )}
                                {rawTaskData?.dueDate &&
                                  (() => {
                                    const dueDate = new Date(
                                      rawTaskData.dueDate,
                                    );
                                    const today = new Date();
                                    const diffDays = Math.ceil(
                                      (dueDate.getTime() - today.getTime()) /
                                        (1000 * 60 * 60 * 24),
                                    );
                                    if (diffDays < 0)
                                      return (
                                        <span className="inline-flex items-center bg-rose-100 text-rose-700 px-2.5 py-1 rounded-none text-[10px] font-black italic border border-rose-200 uppercase leading-none">
                                          OVERDUE {Math.abs(diffDays)}d
                                        </span>
                                      );
                                    if (diffDays === 0)
                                      return (
                                        <span className="inline-flex items-center bg-amber-100 text-amber-700 px-2.5 py-1 rounded-none text-[10px] font-black border border-amber-200 uppercase tracking-tight leading-none">
                                          DUE TODAY
                                        </span>
                                      );
                                    return (
                                      <span className="inline-flex items-center bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-none text-[10px] font-black border border-emerald-200 uppercase tracking-tight leading-none">
                                        {diffDays} days left
                                      </span>
                                    );
                                  })()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Task Identity */}
                      <div className="flex items-start gap-3 group border-t border-slate-100 pt-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-none transition-colors group-hover:bg-indigo-600 group-hover:text-white shrink-0">
                          <Tag size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5">
                            Classification
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-none text-[10px] font-bold uppercase tracking-tighter border border-slate-200">
                              {task.taskType || "Regular"}
                            </span>
                            {task.category && (
                              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-none text-[10px] font-bold uppercase tracking-tighter border border-blue-200">
                                {task.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Priority Control */}
                      <div className="flex items-start gap-3 group border-t border-slate-100 pt-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-orange-50 text-orange-600 rounded-none transition-colors group-hover:bg-orange-600 group-hover:text-white shrink-0">
                          <AlertTriangle size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-2">
                            Priority Level
                          </p>
                          <div className="flex items-center gap-2">
                            <select
                              value={task.priority || "medium"}
                              onChange={(e) =>
                                handlePriorityChange(e.target.value)
                              }
                              disabled={
                                task.status === "DONE" ||
                                task.status === "CANCELLED" ||
                                task.approvalStatus === "approved" ||
                                task.approvalStatus === "REJECTED"
                              }
                              className={`h-[24px] min-h-[24px] max-h-[24px] box-border px-2 pr-6 py-0 rounded-none text-[10px] leading-none font-bold border transition-all mt-[-2px]
                                ${task.status === "DONE" || task.status === "CANCELLED" || task.approvalStatus === "approved" || task.approvalStatus === "REJECTED" ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
                                ${
                                  task.priority?.toLowerCase() === "low"
                                    ? "bg-green-50 border-green-200 text-green-700"
                                    : task.priority?.toLowerCase() === "medium"
                                      ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                                      : task.priority?.toLowerCase() === "high"
                                        ? "bg-orange-50 border-orange-200 text-orange-700"
                                        : "bg-red-50 border-red-200 text-red-700"
                                }`}
                              style={{
                                height: "24px",
                                minHeight: "24px",
                                maxHeight: "24px",
                                paddingTop: "0px",
                                paddingBottom: "0px",
                                lineHeight: 1,
                              }}
                            >
                              {priorityOptions.map((p) => (
                                <option key={p.value} value={p.value}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Estimated Time */}
                      {/* <div className="flex items-center gap-3 group border-t border-slate-50">
                        <div className="w-10 h-10 flex items-center justify-center bg-amber-50 text-amber-600 rounded-none transition-colors group-hover:bg-amber-600 group-hover:text-white">
                          <Clock size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5">Estimated Time</p>
                          <p className="text-base font-bold text-slate-800 truncate">{task.timeEstimate || 'Not specified'}</p>
                        </div>
                      </div> */}
                    </div>
                  </div>

                  {/* Quick Info Card - Metadata */}
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-none border border-gray-200 p-4 sm:p-5 transition-all h-full">
                    <div className="flex items-center gap-2 mb-3 text-slate-600">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-none bg-slate-200 text-slate-700 text-xs font-bold">
                        ℹ
                      </span>
                      <h3 className="text-xs font-bold uppercase tracking-widest">
                        Quick
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {/* Visibility + By */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none flex-shrink-0 w-16">
                            Visibility
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-none text-[10px] font-bold border ${
                              task.visibility === "PRIVATE"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : task.visibility === "SHARED"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-green-50 text-green-700 border-green-200"
                            }`}
                          >
                            {task.visibility || "Public"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none flex-shrink-0 w-16">
                            By
                          </span>
                          <span className="text-[10px] font-medium text-slate-700 bg-white px-2 py-1 rounded-none border border-slate-150 inline-block truncate">
                            {task.createdBy || "System"}
                          </span>
                        </div>
                      </div>

                      {/* Color + Created */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none flex-shrink-0 w-16">
                            Color
                          </span>
                          {task.colorCode ? (
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="w-4 h-4 rounded-none border-2 border-slate-300 shadow-sm"
                                style={{ backgroundColor: task.colorCode }}
                              ></div>
                              <span className="text-[10px] font-medium text-slate-600 truncate">
                                {task.colorCode}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-500">
                              N/A
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none flex-shrink-0 w-16">
                            Created
                          </span>
                          <span className="text-[10px] font-medium text-slate-600">
                            {rawTaskData?.createdAt
                              ? (() => {
                                  const d = new Date(rawTaskData.createdAt);
                                  return d
                                    .toLocaleString("en-GB", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hour12: true,
                                    })
                                    .replace(",", "");
                                })()
                              : "N/A"}
                          </span>
                        </div>
                      </div>

                      {/* Estimate + Updated - hide Estimate for approval tasks */}
                      <div className="flex items-center justify-between gap-3">
                        {task?.isApprovalTask ||
                        task?.taskType === "approval" ? null : (
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none flex-shrink-0 w-16">
                              Estimate
                            </span>
                            <div className="min-w-0">
                              {isEditingTimeEstimate ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    value={timeEstimateInput}
                                    onChange={(e) =>
                                      setTimeEstimateInput(e.target.value)
                                    }
                                    onBlur={handleTimeEstimateUpdate}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter")
                                        handleTimeEstimateUpdate();
                                      if (e.key === "Escape") {
                                        setIsEditingTimeEstimate(false);
                                        setTimeEstimateInput(
                                          task.timeEstimate?.toString() || "0",
                                        );
                                      }
                                    }}
                                    autoFocus
                                    className="w-16 px-1 py-0.5 text-[10px] border border-blue-300 rounded-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                  <span className="text-[10px] text-slate-500">
                                    hrs
                                  </span>
                                </div>
                              ) : (
                                <div
                                  className={`flex items-center gap-1 px-1 -ml-1 rounded-none transition-colors group ${task.status === "DONE" || task.status === "CANCELLED" ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-slate-100"}`}
                                  onClick={() => {
                                    if (
                                      task.status === "DONE" ||
                                      task.status === "CANCELLED"
                                    )
                                      return;
                                    setTimeEstimateInput(
                                      task.timeEstimate?.toString() || "0",
                                    );
                                    setIsEditingTimeEstimate(true);
                                  }}
                                  title={
                                    task.status === "DONE"
                                      ? "Cannot edit completed task"
                                      : task.status === "CANCELLED"
                                        ? "Cannot edit cancelled task"
                                        : "Click to edit estimate"
                                  }
                                >
                                  <span className="text-[10px] font-medium text-slate-700 border-b border-dashed border-slate-300">
                                    {task.timeEstimate != null &&
                                    task.timeEstimate !== "" &&
                                    task.timeEstimate !== "Not specified"
                                      ? task.timeEstimate
                                      : 0}{" "}
                                    hrs
                                  </span>
                                  <Pen
                                    size={10}
                                    className="text-slate-400 opacity-90 transition-opacity"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none flex-shrink-0 w-16">
                            Updated
                          </span>
                          <span className="text-[10px] font-medium text-slate-600">
                            {rawTaskData?.updatedAt
                              ? (() => {
                                  const d = new Date(rawTaskData.updatedAt);
                                  return d
                                    .toLocaleString("en-GB", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hour12: true,
                                    })
                                    .replace(",", "");
                                })()
                              : "N/A"}
                          </span>
                        </div>
                      </div>

                      {/* Parent Task + Linked Items - hide for approval tasks */}
                      {task?.isApprovalTask ||
                      task?.taskType === "approval" ? null : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none flex-shrink-0 w-16">
                              Parent
                            </span>
                            <span className="text-[10px] font-medium text-slate-600 truncate">
                              {task.parentTask
                                ? typeof task.parentTask === "string"
                                  ? task.parentTask
                                  : task.parentTask?.title ||
                                    task.parentTask?.name ||
                                    "Unknown"
                                : "None"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none flex-shrink-0 w-16">
                              Linked
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-none text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                              {task.linkedItems?.length || 0}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Sub-tasks Count + Progress Control - hide subtasks for approval tasks */}
                      <div className="flex items-center gap-18 justify-between pt-2 border-t border-slate-100">
                        {task?.isApprovalTask ||
                        task?.taskType === "approval" ? null : (
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none flex-shrink-0 w-16">
                              Subtasks
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-none text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              {task.subtasks?.length || 0}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 flex-1 justify-end">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none flex-shrink-0 w-16">
                            Progress
                          </span>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {task.status === "DONE" ||
                            task.approvalStatus === "approved" ? (
                              <div className="flex items-center gap-2 w-full">
                                <div className="flex-1 max-w-[80px] h-2 bg-slate-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500 w-full"></div>
                                </div>
                                <span className="text-[10px] font-bold text-emerald-600">
                                  100%
                                </span>
                              </div>
                            ) : task.approvalStatus === "rejected" ? (
                              <div className="flex items-center gap-2 w-full">
                                <div className="flex-1 max-w-[80px] h-2 bg-slate-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-red-500 w-full"></div>
                                </div>
                                <span className="text-[10px] font-bold text-red-600">
                                  100%
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 w-full">
                                <div className="flex-1 max-w-[80px] h-2 bg-slate-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500 transition-all duration-300"
                                    style={{
                                      width: `${Math.min(task.progress || 0, 95)}%`,
                                    }}
                                  ></div>
                                </div>
                                {isEditingProgress ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      max="95"
                                      value={progressInput}
                                      onChange={(e) => {
                                        let val = parseInt(e.target.value, 10);
                                        if (isNaN(val)) val = 0;
                                        if (val > 95) val = 95;
                                        if (val < 0) val = 0;
                                        setProgressInput(val.toString());
                                      }}
                                      onBlur={handleProgressUpdate}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter")
                                          handleProgressUpdate();
                                        if (e.key === "Escape") {
                                          setIsEditingProgress(false);
                                          setProgressInput(
                                            task.progress?.toString() || "0",
                                          );
                                        }
                                      }}
                                      autoFocus
                                      className="w-12 px-1 py-0 text-[10px] border border-blue-300 rounded-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                    <span className="text-[10px] text-slate-500">
                                      %
                                    </span>
                                  </div>
                                ) : (
                                  <div
                                    className={`flex items-center gap-1 cursor-pointer group hover:bg-slate-100 px-1 -ml-1 rounded-none transition-colors ${task.status === "CANCELLED" ? "opacity-60 cursor-not-allowed" : ""}`}
                                    onClick={() => {
                                      if (task.status === "CANCELLED") return;
                                      setProgressInput(
                                        task.progress?.toString() || "0",
                                      );
                                      setIsEditingProgress(true);
                                    }}
                                    title={
                                      task.status === "CANCELLED"
                                        ? "Cannot edit cancelled task"
                                        : "Click to edit progress"
                                    }
                                  >
                                    <span className="text-[10px] font-medium text-slate-700 border-b border-dashed border-slate-300">
                                      {task.progress || 0}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      %
                                    </span>
                                    <Pen
                                      size={10}
                                      className="text-slate-400 opacity-90 transition-opacity"
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ❌ Cancellation Reason — shown only when task is CANCELLED */}
                {task.status === "CANCELLED" && (
                  <div className="bg-white rounded-none border border-red-200 overflow-hidden transition-all">
                    <div className="bg-red-50 px-4 sm:px-6 py-2 sm:py-2.5 border-b border-red-100 flex items-center gap-3">
                      <div className="p-2 bg-red-100 rounded-none text-red-600 shrink-0">
                        <X size={12} />
                      </div>
                      <h3 className="text-sm font-bold text-red-700 uppercase tracking-wider">
                        Cancellation Reason
                      </h3>
                    </div>
                    <div className="p-3 sm:p-4">
                      {rawTaskData?.cancelNotes ? (
                        <p className="text-sm text-slate-700 leading-relaxed">
                          {rawTaskData.cancelNotes}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-400 italic">
                          No cancellation reason provided.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Subtask Details - Show if this is a subtask */}
                {task.isSubtask && task.parentTask && (
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-none border border-amber-200 p-4 sm:p-5 transition-all">
                    <div className="flex items-center gap-2 mb-3 text-amber-700">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-none bg-amber-200 text-amber-800 text-xs font-bold">
                        ↗
                      </span>
                      <h3 className="text-xs font-bold uppercase tracking-widest">
                        Parent Task
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {/* Parent Task Title */}
                      <div className="flex items-start gap-2">
                        <span className="text-[9px] font-bold text-amber-600 uppercase tracking-widest leading-tight mt-0.5 flex-shrink-0 w-16">
                          Title
                        </span>
                        <span className="text-[10px] font-bold text-amber-900 bg-white px-2 py-1 rounded-none border border-amber-200 inline-block">
                          {typeof task.parentTask === "string"
                            ? task.parentTask
                            : task.parentTask?.title ||
                              task.parentTask?.name ||
                              "Unknown"}
                        </span>
                      </div>

                      {/* Parent Task Status */}
                      {task.parentTask?.status && (
                        <div className="flex items-start gap-2">
                          <span className="text-[9px] font-bold text-amber-600 uppercase tracking-widest leading-tight mt-0.5 flex-shrink-0 w-16">
                            Status
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-none text-[9px] font-bold border ${
                              task.parentTask.status?.toUpperCase() ===
                                "DONE" ||
                              task.parentTask.status?.toUpperCase() ===
                                "COMPLETED"
                                ? "bg-green-100 text-green-700 border-green-200"
                                : task.parentTask.status?.toUpperCase() ===
                                    "IN_PROGRESS"
                                  ? "bg-blue-100 text-blue-700 border-blue-200"
                                  : "bg-gray-100 text-gray-700 border-gray-200"
                            }`}
                          >
                            {task.parentTask?.status || "TODO"}
                          </span>
                        </div>
                      )}

                      {/* Parent Task Assignee */}
                      {task.parentTask?.assignedTo && (
                        <div className="flex items-start gap-2">
                          <span className="text-[9px] font-bold text-amber-600 uppercase tracking-widest leading-tight mt-0.5 flex-shrink-0 w-16">
                            Assigned
                          </span>
                          <span className="text-[10px] font-medium text-amber-800 bg-white px-2 py-1 rounded-none border border-amber-200 inline-block">
                            {typeof task.parentTask.assignedTo === "string"
                              ? task.parentTask.assignedTo
                              : `${task.parentTask.assignedTo?.firstName || ""} ${task.parentTask.assignedTo?.lastName || ""}`.trim() ||
                                "Unassigned"}
                          </span>
                        </div>
                      )}

                      {/* Parent Task Due Date */}
                      {task.parentTask?.dueDate && (
                        <div className="flex items-start gap-2">
                          <span className="text-[9px] font-bold text-amber-600 uppercase tracking-widest leading-tight mt-0.5 flex-shrink-0 w-16">
                            Due
                          </span>
                          <span className="text-[10px] font-medium text-amber-900">
                            {new Date(
                              task.parentTask.dueDate,
                            ).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <>
          {/* Approval Actions Panel */}
          {rawTaskData?.isApprovalTask && currentUser && (
            <ApprovalActionsPanel
              task={rawTaskData}
              currentUser={currentUser}
              onApprovalUpdate={fetchTaskData}
            />
          )}

          {/* Detailed View Panel */}
          {moreInfo && (
            <div className="detailed-view-panel">
              <div className="detailed-view-header">
                <h3>Detailed View</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMoreInfo(false)}
                >
                  <X size={20} />
                </Button>
              </div>
              <div className="details-two-card-grid">
                {/* First Card: Top Three Cards Combined */}
                <div className="detail-card combined-card">
                  <div className="detail-header">
                    <ClipboardList size={16} className="detail-icon" />
                    <h4>Task Details</h4>
                  </div>
                  <div className="detail-content">
                    <div className="detail-row">
                      <span className="detail-label">Type:</span>
                      <span className="detail-value">{task.taskType}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Color Code:</span>
                      <span className="detail-value">
                        {(() => {
                          const typeColors = {
                            regular: {
                              color: "#3B82F6",
                            },
                            recurring: {
                              color: "#a855f7",
                            },
                            milestone: {
                              color: "#10b981",
                            },
                            approval: {
                              color: "#f59e0b",
                            },
                          };
                          const typeKey = (task.taskType || "")
                            .toLowerCase()
                            .replace(/ .*/, "");
                          const color =
                            typeColors[typeKey]?.color ||
                            task.colorCode ||
                            task.color ||
                            "#007bff";
                          return (
                            <span
                              style={{
                                display: "inline-block",
                                width: 20,
                                height: 20,
                                borderRadius: "50%",
                                background: color,
                                border: "1px solid #ccc",
                                verticalAlign: "middle",
                              }}
                            />
                          );
                        })()}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Visibility:</span>
                      <span className="detail-value">{task.visibility}</span>
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">Due Date:</span>
                      <span className="detail-value">{task.dueDate}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Time Estimate:</span>
                      <span className="detail-value">{task.timeEstimate}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Created By:</span>
                      <span className="detail-value">{task.createdBy}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Created:</span>
                      <span className="detail-value">{task.createdAt}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Last Updated:</span>
                      <span className="detail-value">{task.updatedAt}</span>
                    </div>
                  </div>
                </div>
                {/* Second Card: Bottom Three Cards Combined */}
                <div className="detail-card combined-card">
                  <div className="detail-header">
                    <Users size={16} className="detail-icon" />
                    <h4>Assignment, Tags & Hierarchy</h4>
                  </div>
                  <div className="detail-content">
                    <div className="detail-row">
                      <span className="detail-label">Assignee:</span>
                      <span className="detail-value">{task.assignee}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Current Status:</span>
                      <span
                        className={`detail-value status-badge ${task.status.toLowerCase()}`}
                      >
                        {task.status}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Priority:</span>
                      <span
                        className={`detail-value priority-badge ${task.priority.toLowerCase()}`}
                      >
                        {task.priority}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Collaborators:</span>
                      <div className="collaborators-list">
                        {task.collaborators && task.collaborators.length > 0 ? (
                          task.collaborators.map((collaborator, index) => (
                            <span key={index} className="collaborator-name">
                              {typeof collaborator === "string"
                                ? collaborator
                                : `${collaborator.firstName || ""} ${collaborator.lastName || ""}`.trim() ||
                                  collaborator.name ||
                                  "Unknown"}
                            </span>
                          ))
                        ) : (
                          <span className="detail-value">No collaborators</span>
                        )}
                      </div>
                    </div>
                    {/* 🔄 Contributors for Recurring Tasks - Section 4.3 */}
                    {task.contributors && task.contributors.length > 0 && (
                      <div className="detail-row">
                        <span className="detail-label">Contributors:</span>
                        <div className="collaborators-list">
                          {task.contributors.map((contributor, index) => (
                            <span key={index} className="contributor-name">
                              {typeof contributor === "string"
                                ? contributor
                                : `${contributor.firstName || ""} ${contributor.lastName || ""}`.trim() ||
                                  contributor.name ||
                                  "Unknown"}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="detail-row">
                      <span className="detail-label">Tags:</span>
                      <div className="tags-list">
                        {task.tags && task.tags.length > 0 ? (
                          task.tags.map((tag, index) => (
                            <span key={index} className="tag">
                              #{tag}
                            </span>
                          ))
                        ) : (
                          <span className="detail-value">No tags</span>
                        )}
                      </div>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Parent Task:</span>
                      <span className="detail-value">
                        {task?.parentTaskTitle ||
                          task?.parentTask?.title ||
                          task?.parentTaskId?.title ||
                          "None"}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Sub-tasks Count:</span>
                      <span className="detail-value">
                        {task.subtasks ? task.subtasks.length : 0}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Linked Items:</span>
                      <span className="detail-value">
                        {task.linkedItems ? task.linkedItems.length : 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Attached Forms */}
              {(() => {
                // Collect all forms from task and subtasks
                const allForms = [];

                // Check if main task has attached form (from raw API data)
                if (rawTaskData?.attached_form_version_id) {
                  const formVersion = rawTaskData.attached_form_version_id;
                  allForms.push({
                    taskId: task._id,
                    taskTitle: task.title,
                    isSubtask: false,
                    formVersionId:
                      typeof formVersion === "object"
                        ? formVersion._id
                        : formVersion,
                    formTitle:
                      formVersion?.snapshot_data?.title || "Untitled Form",
                    versionNumber: formVersion?.version_number || "N/A",
                    submissionStatus:
                      rawTaskData.form_submission_status || "NOT_STARTED",
                    submissionId: rawTaskData.form_submission_id,
                    publishedAt: formVersion?.published_at,
                  });
                }

                // Check if any subtask has attached form
                if (rawTaskData?.subtasks && rawTaskData.subtasks.length > 0) {
                  rawTaskData.subtasks.forEach((subtask) => {
                    if (subtask.attached_form_version_id) {
                      const formVersion = subtask.attached_form_version_id;
                      allForms.push({
                        taskId: subtask._id,
                        taskTitle: subtask.title,
                        isSubtask: true,
                        formVersionId:
                          typeof formVersion === "object"
                            ? formVersion._id
                            : formVersion,
                        formTitle:
                          formVersion?.snapshot_data?.title || "Untitled Form",
                        versionNumber: formVersion?.version_number || "N/A",
                        submissionStatus:
                          subtask.form_submission_status || "NOT_STARTED",
                        submissionId: subtask.form_submission_id,
                        publishedAt: formVersion?.published_at,
                      });
                    }
                  });
                }

                if (allForms.length === 0) return null;

                return (
                  <>
                    <div className="attached-forms-section">
                      <div className="forms-header">
                        <ClipboardList size={16} className="forms-icon" />
                        <h4>Attached Forms ({allForms.length})</h4>
                      </div>
                      {allForms.map((form, index) => (
                        <div
                          key={form.formVersionId || index}
                          className="form-item"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "12px",
                          }}
                        >
                          <div
                            style={{ flex: 1, cursor: "pointer" }}
                            onClick={() => handleOpenFormSubmission(form)}
                            title="Click to fill/view form"
                          >
                            <div className="form-details">
                              <h5
                                style={{
                                  color: "#3B82F6",
                                  textDecoration: "underline",
                                }}
                              >
                                {form.formTitle}
                              </h5>
                              <div
                                style={{
                                  display: "flex",
                                  gap: "8px",
                                  alignItems: "center",
                                  marginTop: "4px",
                                }}
                              >
                                <span className="form-type">
                                  v{form.versionNumber}
                                </span>
                                {form.isSubtask && (
                                  <span
                                    style={{ fontSize: "11px", color: "#666" }}
                                  >
                                    → {form.taskTitle}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <span
                              className={`form-status ${
                                form.submissionStatus === "COMPLETED"
                                  ? "completed"
                                  : form.submissionStatus === "IN_PROGRESS"
                                    ? "in-progress"
                                    : "not-started"
                              }`}
                            >
                              {form.submissionStatus === "COMPLETED"
                                ? "completed"
                                : form.submissionStatus === "IN_PROGRESS"
                                  ? "in progress"
                                  : "not started"}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (form.submissionStatus === "COMPLETED") {
                                  showErrorToast(
                                    "Cannot unlink form - it has already been submitted. Submissions are kept as read-only history.",
                                  );
                                } else {
                                  setUnlinkConfirm({ isOpen: true, form });
                                }
                              }}
                              disabled={form.submissionStatus === "COMPLETED"}
                              style={{
                                padding: "4px 8px",
                                fontSize: "12px",
                                color:
                                  form.submissionStatus === "COMPLETED"
                                    ? "#999"
                                    : "#dc2626",
                                background: "transparent",
                                border: `1px solid ${form.submissionStatus === "COMPLETED" ? "#ccc" : "#dc2626"}`,
                                borderRadius: "4px",
                                cursor:
                                  form.submissionStatus === "COMPLETED"
                                    ? "not-allowed"
                                    : "pointer",
                                opacity:
                                  form.submissionStatus === "COMPLETED"
                                    ? 0.5
                                    : 1,
                                transition: "all 0.2s",
                              }}
                              onMouseEnter={(e) => {
                                if (form.submissionStatus !== "COMPLETED") {
                                  e.target.style.background = "#dc2626";
                                  e.target.style.color = "white";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (form.submissionStatus !== "COMPLETED") {
                                  e.target.style.background = "transparent";
                                  e.target.style.color = "#dc2626";
                                }
                              }}
                              title={
                                form.submissionStatus === "COMPLETED"
                                  ? "Cannot unlink - form already submitted"
                                  : "Unlink form"
                              }
                            >
                              {form.submissionStatus === "COMPLETED"
                                ? "Locked"
                                : "Unlink"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <FormSubmissionModal
                      open={showFormSubmissionModal}
                      onClose={handleCloseFormSubmission}
                      formData={selectedFormData}
                      taskId={
                        selectedFormData?.isSubtask
                          ? null
                          : selectedFormData?.taskId
                      }
                      subtaskId={
                        selectedFormData?.isSubtask
                          ? selectedFormData?.taskId
                          : null
                      }
                      submissionId={null}
                      onSubmitSuccess={() => {
                        console.log("Form submitted successfully");
                        fetchTaskData();
                      }}
                    />
                  </>
                );
              })()}
            </div>
          )}
        </>

        {activeTab === "subtasks" && (
          <SubtasksPanel
            subtasks={task.subtasks}
            parentTask={task}
            currentUser={currentUser}
            refreshTask={fetchTaskData}
          />
        )}

        {activeTab === "comments" && currentUser && (
          <TaskComments
            taskId={taskId}
            task={task}
            comments={comments}
            onAddComment={handleAddComment}
            onReplyToComment={handleReplyToComment}
            onEditComment={handleEditComment}
            onDeleteComment={handleDeleteComment}
            currentUser={currentUser}
            users={users}
            permissions={commentPermissions}
          />
        )}

        {activeTab === "activity" && (
          <div className="activity-view">
            <div className="activity-header">
              <h3>Activity Feed</h3>
              <p>Track all task activities and changes</p>
              <div className="activity-controls">
                <select
                  className="activity-filter"
                  value={activityFilter}
                  onChange={(e) => setActivityFilter(e.target.value)}
                >
                  <option value="all">All Activities</option>
                  <option value="task">Task Changes</option>
                  <option value="subtask">Subtask Changes</option>
                  <option value="comment">Comments</option>
                  <option value="approval">Approvals</option>
                  <option value="file">File Operations</option>
                  {/* <option value="user">User Actions</option> */}
                </select>
                <Button
                  variant="outline"
                  className="h-9"
                  onClick={fetchActivities}
                  disabled={activitiesLoading}
                >
                  {activitiesLoading ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    "Refresh"
                  )}
                </Button>
              </div>
            </div>

            <div className="activity-list">
              {activitiesLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600">
                    Loading activities...
                  </span>
                </div>
              )}

              {activitiesError && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                    <p className="text-red-600">{activitiesError}</p>
                    <Button
                      variant="primary"
                      className="h-9 mt-2"
                      onClick={fetchActivities}
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              )}

              {!activitiesLoading &&
                !activitiesError &&
                activities.length === 0 && (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Activity className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600">No activities yet</p>
                      <p className="text-sm text-gray-500">
                        Activity will appear here as actions are performed on
                        this task
                      </p>
                    </div>
                  </div>
                )}

              {!activitiesLoading &&
                !activitiesError &&
                activities.length > 0 && (
                  <>
                    {/* Group activities by date */}
                    {(() => {
                      // Apply filter
                      const filteredActivities =
                        activityFilter === "all"
                          ? activities
                          : activities.filter(
                              (activity) =>
                                activity.category === activityFilter,
                            );

                      // Check if no results after filtering
                      if (filteredActivities.length === 0) {
                        return (
                          <div className="flex items-center justify-center py-8">
                            <div className="text-center">
                              <Activity className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                              <p className="text-gray-600">
                                No {activityFilter} activities found
                              </p>
                              <p className="text-sm text-gray-500">
                                Try selecting a different filter
                              </p>
                              <Button
                                variant="outline"
                                className="h-9 mt-3"
                                onClick={() => setActivityFilter("all")}
                              >
                                Show All Activities
                              </Button>
                            </div>
                          </div>
                        );
                      }

                      // Group by date
                      const groupedActivities = filteredActivities.reduce(
                        (groups, activity) => {
                          const date = new Date(
                            activity.timestamp,
                          ).toDateString();
                          if (!groups[date]) {
                            groups[date] = [];
                          }
                          groups[date].push(activity);
                          return groups;
                        },
                        {},
                      );

                      return (
                        <>
                          {/* Filter summary */}
                          {activityFilter !== "all" && (
                            <div className="activity-filter-info">
                              <span className="filter-badge">
                                Showing {filteredActivities.length}{" "}
                                {activityFilter}{" "}
                                {filteredActivities.length === 1
                                  ? "activity"
                                  : "activities"}
                              </span>
                              <button
                                className="clear-filter-btn"
                                onClick={() => setActivityFilter("all")}
                              >
                                Clear Filter
                              </button>
                            </div>
                          )}

                          {/* Activity groups */}
                          {Object.entries(groupedActivities)
                            .sort(([a], [b]) => new Date(b) - new Date(a))
                            .map(([date, dayActivities]) => (
                              <div key={date}>
                                <div className="activity-date">
                                  {new Date(date)
                                    .toLocaleDateString("en-GB", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })
                                    .replace(",", "")
                                    .toUpperCase()}
                                </div>

                                {dayActivities
                                  .sort(
                                    (a, b) =>
                                      new Date(b.timestamp) -
                                      new Date(a.timestamp),
                                  )
                                  .map((activity) => (
                                    <div
                                      key={activity.id}
                                      className="activity-item"
                                    >
                                      <div
                                        className={`activity-avatar ${activity.category}`}
                                      >
                                        {activity.icon}
                                      </div>
                                      <div className="activity-content">
                                        <strong>{activity.description}</strong>
                                        {activity.user && (
                                          <div className="activity-user">
                                            by{" "}
                                            {activity.user.name ||
                                              activity.user.email}
                                          </div>
                                        )}
                                        <div className="activity-time">
                                          {new Date(activity.timestamp)
                                            .toLocaleString("en-GB", {
                                              day: "2-digit",
                                              month: "short",
                                              year: "numeric",
                                              hour: "2-digit",
                                              minute: "2-digit",
                                              hour12: true,
                                            })
                                            .replace(",", "")}{" "}
                                          ⏰
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            ))}
                        </>
                      );
                    })()}
                  </>
                )}
            </div>
          </div>
        )}

        {activeTab === "files" && (
          <TaskAttachments taskId={taskId} task={task} />
        )}

        {activeTab === "linked" && (
          <LinkedTasksTab
            task={task}
            taskId={taskId}
            onRefresh={fetchTaskData}
            currentUser={currentUser}
          />
        )}

        {activeTab === "forms" && (
          <AttachedFormsTab
            task={rawTaskData}
            taskId={taskId}
            onRefresh={fetchTaskData}
          />
        )}
      </div>

      {/* Modals */}
      <SubtaskForm
        isOpen={showCreateSubtaskDrawer}
        onClose={() => setShowCreateSubtaskDrawer(false)}
        onSubmit={handleCreateSubtask}
        parentTask={task}
        mode="create"
        refreshTask={fetchTaskData}
        isOrgUser={canAssignToOthers(activeRole || "individual")}
      />

      {showCancelModal && (
        <div className="modal-overlay task-modals-square">
          <style>{`
            .modal-overlay {
              position: fixed; inset: 0; z-index: 999999;
              background: rgba(0,0,0,0.5);
              display: flex; align-items: center; justify-content: center;
            }
            .modal-container {
              background: white; border-radius: 8px;
              width: 90%; max-width: 420px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            .modal-header {
              padding: 1.25rem 1.5rem; border-bottom: 1px solid #e5e7eb;
              display: flex; align-items: center; justify-content: space-between;
            }
            .modal-header h4 { margin: 0; font-size: 1rem; font-weight: 600; }
          `}</style>
          <div className="modal-container">
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <XCircle size={20} className="text-red-500" />
                <h4>Cancel Task</h4>
              </div>
              <button
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 animate-none border-none shadow-none cursor-pointer"
                onClick={() => setShowCancelModal(false)}
              >
                <span className="text-lg text-gray-500 hover:text-red-500">
                  ✕
                </span>
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to cancel this task? Please provide a
                reason.
              </p>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:border-transparent resize-none"
                rows={3}
                placeholder="Reason for cancellation..."
              />
              <div className="flex gap-3 mt-6">
                <button
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!cancelReason.trim()}
                  onClick={() => {
                    handleCancelTask(cancelReason);
                    setShowCancelModal(false);
                    setCancelReason("");
                  }}
                >
                  Confirm Cancel
                </button>
                <button
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancelReason("");
                  }}
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ReassignTaskModal
        isOpen={showReassignModal}
        onClose={() => setShowReassignModal(false)}
        onConfirm={handleReassignTask}
        task={task}
      />

      <SnoozeTaskModal
        isOpen={showSnoozeModal}
        onClose={() => setShowSnoozeModal(false)}
        onConfirm={handleSnoozeTask}
        task={task}
      />

      <MarkRiskModal
        isOpen={showRiskModal}
        onClose={() => setShowRiskModal(false)}
        onConfirm={handleMarkRisk}
        task={task}
      />

      <MitigationModal
        isOpen={showMitigationModal}
        onClose={() => setShowMitigationModal(false)}
        onConfirm={handleUnmarkRisk}
        task={task}
      />

      <MarkDoneModal
        isOpen={showDoneModal}
        onClose={() => setShowDoneModal(false)}
        onConfirm={async () => {
          try {
            // ❌ Block mark done for already completed tasks
            if (task?.status === "DONE") {
              showErrorToast(
                "Task is already completed. No further changes allowed.",
              );
              setShowDoneModal(false);
              return;
            }

            const token = localStorage.getItem("token");
            const taskIdToComplete = task?._id || task?.id;

            console.log("✅ Marking task as done:", taskIdToComplete);

            // Map frontend status to backend status
            const statusMapping = {
              DONE: "completed",
              COMPLETED: "completed",
            };

            const payload = {
              // Backend expects uppercase status codes: OPEN, INPROGRESS, ONHOLD, DONE, CANCELLED
              status: "DONE",
              completedDate: new Date().toISOString(),
            };

            console.log("📤 Status update payload:", payload);

            // Use correct endpoint: /api/tasks/:id/status
            const response = await axios.patch(
              `/api/tasks/${taskIdToComplete}/status`,
              payload,
              {
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
              },
            );

            if (response.data && response.data.success) {
              console.log("✅ Task marked as done successfully");

              // Update local state
              setTask({
                ...task,
                status: "DONE",
                completedDate: new Date().toISOString(),
              });

              // Close modal
              setShowDoneModal(false);

              // Refresh task data and activities
              await fetchTaskData();
              await fetchActivities();

              showSuccessToast("Task marked as done");
            } else {
              throw new Error(
                response.data?.message || "Failed to update task status",
              );
            }
          } catch (error) {
            console.error("❌ Error marking task as done:", error);

            let errorMessage = "Failed to mark task as done";
            if (error.response?.data?.message) {
              errorMessage = error.response.data.message;
            } else if (error.response?.data?.incompleteSubtasks) {
              const count = error.response.data.incompleteSubtasks.length;
              errorMessage = `Cannot mark as Done. Please complete all ${count} pending subtask(s) first.`;
            }

            showErrorToast(errorMessage);
          }
        }}
        task={task}
      />

      {/* Link Item Modal - Moved to LinkedTasksTab component */}

      <UpgradeRequiredModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        featureName="Subtask"
      />
    </div>
  );
}

// LinkedTasksTab Component
function LinkedTasksTab({ task, taskId, onRefresh, currentUser }) {
  const { showSuccessToast, showErrorToast } = useShowToast();
  const [linkedTasks, setLinkedTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [availableTasks, setAvailableTasks] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [unlinkConfirm, setUnlinkConfirm] = useState({
    isOpen: false,
    form: null,
  });

  // Fetch linked tasks if this is a milestone
  useEffect(() => {
    if (task?.taskType === "Milestone" || task?.mainTaskType === "milestone") {
      fetchLinkedTasks();
    }
  }, [task, taskId]);

  const fetchLinkedTasks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `/api/milestones/${taskId}/linked-tasks`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.data.success) {
        setLinkedTasks(response.data.data.linkedTasks || []);
      }
    } catch (err) {
      console.error("Error fetching linked tasks:", err);
      setError(err.response?.data?.message || "Failed to load linked tasks");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch available tasks for linking
  const fetchAvailableTasks = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `/api/tasks/available-for-linking?excludeTaskIds=${taskId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.data.success) {
        // Use response.data.data.tasks (new API format) or response.data.data (fallback)
        const tasksToFilter = Array.isArray(response.data.data)
          ? response.data.data
          : response.data.data?.tasks || [];

        // Filter to only show regular tasks (not milestones, not already linked)
        const regularTasks = tasksToFilter.filter((t) => {
          const taskType = (t.taskType || t.mainTaskType || "").toLowerCase();
          const isRegular =
            taskType === "regular" ||
            taskType === "recurring" ||
            taskType === "subtask";
          const isNotLinked = !linkedTasks.some((lt) => lt._id === t._id);
          return isRegular && isNotLinked;
        });
        setAvailableTasks(regularTasks);
      }
    } catch (err) {
      console.error("Error fetching available tasks:", err);
      showErrorToast(err.response?.data?.message || err.message);
    }
  };

  // Toggle task selection
  const toggleTaskSelection = (id) => {
    setSelectedTaskIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((taskId) => taskId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Link selected tasks to the milestone
  const handleLinkTask = async () => {
    if (selectedTaskIds.length === 0) {
      showErrorToast("Select at least one task to link");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `/api/milestones/${taskId}/link-task`,
        { taskIds: selectedTaskIds },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.data.success) {
        showSuccessToast(`Successfully linked ${selectedTaskIds.length} tasks`);
        setShowLinkModal(false);
        setSelectedTaskIds([]);
        setSearchQuery("");
        fetchLinkedTasks(); // Refresh linked tasks
        if (onRefresh) onRefresh(); // Refresh parent task data
      }
    } catch (err) {
      console.error("Error linking tasks:", err);
      showErrorToast(err.response?.data?.message || "Failed to link tasks");
    }
  };

  // Open modal and fetch available tasks
  const handleOpenLinkModal = () => {
    setShowLinkModal(true);
    fetchAvailableTasks();
  };

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      DONE: "Completed",
      INPROGRESS: "In Progress",
      OPEN: "Open",
      PENDING: "Pending",
      CANCELLED: "Cancelled",
    };
    return statusMap[status] || "Pending";
  };

  const getItemIcon = (type) => {
    switch (type?.toLowerCase()) {
      case "task":
        return <CheckSquare size={24} />;
      case "document":
        return <FileText size={24} />;
      case "form":
        return <ClipboardList size={24} />;
      default:
        return <CheckSquare size={24} />;
    }
  };

  // Display loading state
  if (isLoading) {
    return (
      <div className="linked-view">
        <div className="linked-header">
          <div className="linked-title">
            <Link className="linked-icon" size={24} />
            <div>
              <h3>Linked Items</h3>
            </div>
          </div>
        </div>
        <div
          className="loading-state flex flex-col items-center justify-center gap-3"
          style={{ padding: "40px" }}
        >
          <Loader size={32} className="animate-spin text-blue-600" />
          <p className="text-gray-500 text-sm font-medium">Loading linked tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="linked-view">
      <div className="linked-header">
        <div className="linked-title">
          <Link className="linked-icon" size={24} />
          <div>
            <h3>Linked Items ({linkedTasks.length})</h3>
            <p>Connected tasks, documents, and resources</p>
          </div>
        </div>
        <div className="linked-controls">
          <select
            className="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option>All Types</option>
            <option>Tasks</option>
            <option>Documents</option>
            <option>Forms</option>
          </select>
          {/* ✅ Hide/Disable Link Item button - Only 'individual' users and milestone creator can link items */}
          {(() => {
            const isMilestone =
              task?.taskType === "Milestone" ||
              task?.mainTaskType === "milestone";
            const userRole = currentUser?.role;
            const isIndividual = userRole === "individual";

            // Get creator ID from the mapped task data
            const creatorId = task?.creatorId;

            // Get current user ID
            const currentUserId = currentUser?.id || currentUser?._id;

            // Check if user is creator
            const isCreator =
              creatorId &&
              currentUserId &&
              (currentUserId === creatorId ||
                currentUserId.toString() === creatorId.toString());

            // Show button if:
            // - It's a milestone AND (user is individual OR user is creator)
            const shouldShowButton = isMilestone && (isIndividual || isCreator);

            if (!shouldShowButton) {
              console.log(
                "❌ HIDING BUTTON - Not a milestone or user is not creator/individual",
              );
              return null;
            }

            console.log(
              "✅ SHOWING BUTTON - It is milestone and user is creator or individual",
            );
            return (
              <Button
                variant="primary"
                className="h-9 flex align-middle"
                onClick={handleOpenLinkModal}
              >
                <Plus size={16} className="mx-2" />
                <span>Link Item</span>
              </Button>
            );
          })()}
        </div>
      </div>

      <div className="linked-items">
        {linkedTasks.length === 0 ? (
          <div
            className="empty-state rounded-sm flex flex-col items-center justify-center gap-2"
            style={{ textAlign: "center", padding: "40px", color: "#6b7280", borderRadius: "0.125rem" }}
          >
            <Link size={48} className="mx-auto" style={{ opacity: 0.3 }} />
            <h3 className="font-semibold text-gray-700">No Linked Items</h3>
            <p className="text-sm text-gray-500">
              Click "Link Item" to connect tasks to this milestone
            </p>
          </div>
        ) : (
          linkedTasks.map((linkedTask) => (
            <div key={linkedTask._id} className="linked-item">
              <div className="item-icon">{getItemIcon("task")}</div>
              <div className="item-details">
                <strong>{linkedTask.title}</strong>
                <div className="item-meta">
                  <span className="item-type">task</span>
                  <span
                    className={`item-status ${getStatusBadgeClass(linkedTask.status)}`}
                  >
                    {getStatusBadgeClass(linkedTask.status)}
                  </span>
                  {linkedTask.dueDate && (
                    <span
                      className="flex items-center gap-1 text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium"
                      style={{ display: "inline-flex", alignItems: "center" }}
                    >
                      <Calendar
                        size={11}
                        className="inline mr-0.5 text-gray-500"
                      />
                      {format(
                        new Date(linkedTask.dueDate),
                        "MMM d, yyyy h:mm a",
                      )}
                    </span>
                  )}
                </div>
              </div>
              <div className="item-type-label">Type: task</div>
              <div className="connection-status flex">
                <Link size={20} /> Connected
              </div>
            </div>
          ))
        )}
      </div>

      {/* Link Item Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
          <div className="w-full max-w-2xl bg-white rounded-none shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-none">
                  <Link size={20} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Link Tasks</h3>
                  <p className="text-sm text-gray-500">
                    Connect multiple tasks to this milestone
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-500 hover:text-gray-700"
                onClick={() => setShowLinkModal(false)}
              >
                <X size={18} />
              </Button>
            </div>

            <div className="p-4 flex-1 overflow-hidden flex flex-col">
              <div className="relative mb-4">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search tasks by title or description..."
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex-1 overflow-y-auto min-h-[300px] border border-gray-200 rounded-none divide-y divide-gray-100 bg-white">
                {availableTasks
                  .filter(
                    (t) =>
                      t.title
                        ?.toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                      t.description
                        ?.toLowerCase()
                        .includes(searchQuery.toLowerCase()),
                  )
                  .map((availableTask) => {
                    const isSelected = selectedTaskIds.includes(
                      availableTask._id,
                    );
                    return (
                      <div
                        key={availableTask._id}
                        onClick={() => toggleTaskSelection(availableTask._id)}
                        className={`
                          group flex items-center gap-3 p-3 cursor-pointer transition-all duration-200 select-none
                          ${isSelected ? "bg-blue-50/60" : "hover:bg-gray-50"}
                        `}
                      >
                        <div
                          className={`
                          flex items-center justify-center w-5 h-5 rounded-none border transition-all duration-200
                          ${
                            isSelected
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "border-gray-300 bg-white text-transparent group-hover:border-blue-300"
                          }
                        `}
                        >
                          <Check size={12} strokeWidth={3} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span
                              className={`font-medium truncate ${isSelected ? "text-blue-900" : "text-gray-900"}`}
                            >
                              {availableTask.title}
                            </span>
                            <span
                              className={`
                              text-[10px] font-medium px-1.5 py-0.5 rounded-none uppercase tracking-wider
                              ${
                                availableTask.priority === "High"
                                  ? "bg-red-100 text-red-700"
                                  : availableTask.priority === "Medium"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-green-100 text-green-700"
                              }
                            `}
                            >
                              {availableTask.priority}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <span
                                className={`w-1.5 h-1.5 rounded-none ${
                                  availableTask.status === "Completed"
                                    ? "bg-green-500"
                                    : availableTask.status === "In Progress"
                                      ? "bg-blue-500"
                                      : "bg-gray-400"
                                }`}
                              />
                              {availableTask.status}
                            </span>
                            {availableTask.dueDate && (
                              <span className="flex items-center gap-1">
                                <Calendar size={12} />
                                {format(
                                  new Date(availableTask.dueDate),
                                  "MMM d, yyyy",
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {availableTasks.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                    <FileText size={32} className="mb-2 opacity-20" />
                    <p>No available tasks found</p>
                  </div>
                )}

                {availableTasks.length > 0 &&
                  availableTasks.filter((t) =>
                    t.title?.toLowerCase().includes(searchQuery.toLowerCase()),
                  ).length === 0 && (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                      <Search size={32} className="mb-2 opacity-20" />
                      <p>No tasks match your search</p>
                    </div>
                  )}
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50/50 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {selectedTaskIds.length > 0 ? (
                  <span className="text-blue-600 font-medium">
                    {selectedTaskIds.length} task
                    {selectedTaskIds.length !== 1 ? "s" : ""} selected
                  </span>
                ) : (
                  "Select tasks to link"
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="h-9"
                  onClick={() => {
                    setShowLinkModal(false);
                    setSelectedTaskIds([]);
                    setSearchQuery("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleLinkTask}
                  disabled={selectedTaskIds.length === 0}
                >
                  <Link size={16} className="inline mr-2" />
                  {selectedTaskIds.length > 0
                    ? `Link ${selectedTaskIds.length} Tasks`
                    : "Link Tasks"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unlink Form Confirmation Dialog */}
      <ConfirmDialog
        isOpen={unlinkConfirm.isOpen}
        title="Unlink Form?"
        description={`Remove "${unlinkConfirm.form?.formTitle}" from this ${unlinkConfirm.form?.isSubtask ? "subtask" : "task"}?`}
        confirmLabel="Unlink"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        onCancel={() => setUnlinkConfirm({ isOpen: false, form: null })}
        onConfirm={async () => {
          const form = unlinkConfirm.form;
          setUnlinkConfirm({ isOpen: false, form: null });
          try {
            const token = localStorage.getItem("token");
            const response = await fetch(
              `/api/forms/${form.formVersionId}/unlink-from-${form.isSubtask ? "subtask" : "task"}/${form.taskId}`,
              {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              },
            );
            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.message || "Failed to unlink form");
            }
            showSuccessToast("Form unlinked");
            onRefresh();
          } catch (error) {
            console.error("Error unlinking form:", error);
            showErrorToast(error.message || "Failed to unlink form");
          }
        }}
      />
    </div>
  );
}
