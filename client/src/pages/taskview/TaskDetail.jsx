import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSubtask } from "../../contexts/SubtaskContext";
import { useRoute, useLocation } from "wouter";
import { useActiveRole } from "../../components/RoleSwitcher";
import { useQueryClient } from "@tanstack/react-query";
import { useTaskPriorities } from "@/hooks/useTaskPriorities";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import { getPriorityOptions } from "@/utils/priorityUtils";
import { format } from "date-fns";
import axios from "axios";
import { canAssignToOthers, isOrgUserRole } from "../../utils/taskPermissions";
import EmailTaskConfig from "../../components/workflow/EmailTaskConfig";
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
  Lock,
  Mail,
  UserPlus,
  Zap,
  Bell,
  Loader,
  Pen,
  Search,
  Check,
  Home,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Building2,
  ArrowUpDown,
  FolderArchive,
  SlidersHorizontal,
  Play,
  RotateCcw,
  Settings,
  List,
  BarChart2,
  Info,
  LayoutDashboard,
} from "lucide-react";
import CoreInfoPanel from "./CoreInfoPanel";
import SubtasksPanel from "./SubtasksPanel";
import AttachedFormsTab from "./AttachedFormsTab";
import ApprovalActionsPanel from "./ApprovalActionsPanel";
import TaskEditModal from "../newComponents/TaskEditModal";
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

  // Get dynamic priority options from database
  const { data: taskPriorities = [] } = useTaskPriorities();
  const priorityOptions = useMemo(
    () => getPriorityOptions(taskPriorities),
    [taskPriorities],
  );

  // Dynamic task statuses from database
  const { data: dbStatusesData = [] } = useTaskStatuses();
  const dbTaskStatuses = useMemo(() => {
    const rawList = Array.isArray(dbStatusesData)
      ? dbStatusesData
      : dbStatusesData?.data || [];
    if (Array.isArray(rawList) && rawList.length > 0) {
      return rawList
        .filter((s) => s && s.active)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    return [
      {
        code: "OPEN",
        label: "Open",
        color: "#6c757d",
        allowedTransitions: ["INPROGRESS", "ONHOLD", "CANCELLED"],
      },
      {
        code: "INPROGRESS",
        label: "In Progress",
        color: "#3498db",
        allowedTransitions: ["DONE", "ONHOLD", "CANCELLED"],
      },
      {
        code: "ONHOLD",
        label: "On Hold",
        color: "#f39c12",
        allowedTransitions: ["INPROGRESS"],
      },
      {
        code: "DONE",
        label: "Completed",
        color: "#28a745",
        allowedTransitions: [],
      },
      {
        code: "CANCELLED",
        label: "Cancelled",
        color: "#dc3545",
        allowedTransitions: [],
      },
    ];
  }, [dbStatusesData]);

  // Click outside handling for dropdowns
  const statusDropdownRef = React.useRef(null);
  const priorityDropdownRef = React.useRef(null);
  const activityFilterDropdownRef = React.useRef(null);
  const [showActivityFilterDropdown, setShowActivityFilterDropdown] =
    useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(event.target)
      ) {
        setShowStatusDropdown(false);
      }
      if (
        priorityDropdownRef.current &&
        !priorityDropdownRef.current.contains(event.target)
      ) {
        setShowPriorityDropdown(false);
      }
      if (
        activityFilterDropdownRef.current &&
        !activityFilterDropdownRef.current.contains(event.target)
      ) {
        setShowActivityFilterDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  // Dropdown states for interactive pills
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Helper functions for redesigned Task Details view
  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const formatDateTimeCustom = (dateStr) => {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const formatted = d.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      return formatted
        .replace(",", "")
        .replace(/(am|pm)/i, (m) => m.toUpperCase());
    } catch (e) {
      return dateStr;
    }
  };

  const renderDueDateBadge = () => {
    const rawDate = rawTaskData?.dueDate || task?.dueDate;
    if (!rawDate) return null;
    try {
      const dueDate = new Date(rawDate);
      if (isNaN(dueDate.getTime())) return null;
      const today = new Date();
      const diffDays = Math.ceil(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays < 0) {
        return (
          <span className="bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight">
            Overdue {Math.abs(diffDays)}d
          </span>
        );
      }
      if (diffDays === 0) {
        return (
          <span className="bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight">
            Due Today
          </span>
        );
      }
      return (
        <span className="bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
          {diffDays} days left
        </span>
      );
    } catch (e) {
      return null;
    }
  };

  // Time Estimate State
  const [isEditingTimeEstimate, setIsEditingTimeEstimate] = useState(false);
  const [timeEstimateInput, setTimeEstimateInput] = useState("");

  // Description Edit State
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState("");

  // Tags Edit State
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [editableTagsList, setEditableTagsList] = useState([]);

  // Due Date Edit State
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [dueDateInput, setDueDateInput] = useState("");

  // Progress State
  const [isEditingProgress, setIsEditingProgress] = useState(false);
  const [progressInput, setProgressInput] = useState("");

  // Email Task Config Edit State
  const [isEditingEmailConfig, setIsEditingEmailConfig] = useState(false);
  const [emailConfigInput, setEmailConfigInput] = useState(null);

  // Section-specific updating/saving states (prevent full-page reload)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingPriority, setIsUpdatingPriority] = useState(false);
  const [isSavingDueDate, setIsSavingDueDate] = useState(false);
  const [isSavingTimeEstimate, setIsSavingTimeEstimate] = useState(false);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const [isSavingTags, setIsSavingTags] = useState(false);

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

  const currentStatusObj = useMemo(() => {
    const currentCode = String(task?.status || "").toUpperCase();
    return (
      dbTaskStatuses.find((s) => s.code === currentCode) || {
        code: currentCode || "OPEN",
        label:
          currentCode === "INPROGRESS" ? "In Progress" : currentCode || "Open",
        color:
          currentCode === "DONE"
            ? "#28a745"
            : currentCode === "CANCELLED"
              ? "#dc3545"
              : "#3b82f6",
      }
    );
  }, [task?.status, dbTaskStatuses]);

  // Valid status transitions according to database configuration
  const validStatusOptions = useMemo(() => {
    if (!currentStatusObj) return [];
    if (task?.status === "DONE" || task?.status === "CANCELLED") return [];

    if (
      Array.isArray(currentStatusObj.allowedTransitions) &&
      currentStatusObj.allowedTransitions.length > 0
    ) {
      return dbTaskStatuses.filter(
        (s) =>
          currentStatusObj.allowedTransitions.includes(s.code) &&
          s.code !== currentStatusObj.code,
      );
    }

    // Fallback: all active statuses except current
    return dbTaskStatuses.filter((s) => s.code !== currentStatusObj.code);
  }, [currentStatusObj, dbTaskStatuses, task?.status]);

  const currentPriorityObj = useMemo(() => {
    const code = String(task?.priority || "low").toLowerCase();
    return (
      priorityOptions.find((p) => p.value?.toLowerCase() === code) || {
        value: code,
        label: code.charAt(0).toUpperCase() + code.slice(1),
        color: "#10B981",
      }
    );
  }, [task?.priority, priorityOptions]);

  // Activity Feed State
  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState(null);
  const [activityFilter, setActivityFilter] = useState("all");
  const [taskAttachments, setTaskAttachments] = useState(null);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);

  const activityFilterOptions = [
    { value: "all", label: "All Activity" },
    { value: "task", label: "Task Changes" },
    { value: "comment", label: "Comments" },
    { value: "subtask", label: "Subtasks" },
    { value: "attachment", label: "Attachments" },
  ];

  const timelineActivities = useMemo(() => {
    let list = Array.isArray(activities) ? [...activities] : [];

    // Filter by activityFilter
    if (activityFilter !== "all") {
      list = list.filter((a) => {
        if (a.category === activityFilter) return true;
        if (
          activityFilter === "task" &&
          (a.type?.startsWith("task_") || a.type === "task_updated")
        )
          return true;
        if (activityFilter === "comment" && a.type?.includes("comment"))
          return true;
        if (activityFilter === "subtask" && a.type?.includes("subtask"))
          return true;
        if (activityFilter === "attachment" && a.type?.includes("attachment"))
          return true;
        return false;
      });
    }

    // Sort descending by timestamp
    list.sort(
      (a, b) =>
        new Date(b.timestamp || b.createdAt) -
        new Date(a.timestamp || a.createdAt),
    );

    // Check if task creation activity exists
    const hasCreation = list.some(
      (a) => a.type === "task_created" || a.type?.includes("create"),
    );
    if (
      !hasCreation &&
      task &&
      (activityFilter === "all" || activityFilter === "task")
    ) {
      list.push({
        id: "initial-task-creation",
        type: "task_created",
        description: `Task "${task.title || "Task"}" was created`,
        timestamp:
          task.createdAt || rawTaskData?.createdAt || new Date().toISOString(),
        user: {
          name:
            task.createdBy ||
            (rawTaskData?.createdBy
              ? `${rawTaskData.createdBy.firstName || ""} ${rawTaskData.createdBy.lastName || ""}`.trim()
              : "Creator"),
        },
      });
    }

    return list;
  }, [activities, activityFilter, task, rawTaskData]);

  const getActivityConfig = (activity) => {
    const type = String(activity.type || "").toLowerCase();

    if (type.includes("create") || type === "task_created") {
      return {
        title: "Task created",
        icon: <Plus size={11} strokeWidth={3} />,
        badgeBg: "bg-emerald-100 text-emerald-600",
      };
    }
    if (type.includes("status") || type === "task_status_changed") {
      return {
        title: "Status updated",
        icon: <ArrowUpDown size={11} />,
        badgeBg: "bg-blue-100 text-blue-600",
      };
    }
    if (type.includes("priority") || type === "task_priority_changed") {
      return {
        title: "Priority changed",
        icon: <BarChart2 size={11} />,
        badgeBg: "bg-amber-100 text-amber-600",
      };
    }
    if (type.includes("comment")) {
      return {
        title: "Comment added",
        icon: <MessageCircle size={11} />,
        badgeBg: "bg-purple-100 text-purple-600",
      };
    }
    if (type.includes("attachment")) {
      return {
        title: "Attachment added",
        icon: <Paperclip size={11} />,
        badgeBg: "bg-indigo-100 text-indigo-600",
      };
    }
    if (type.includes("subtask")) {
      return {
        title: "Subtask updated",
        icon: <CheckSquare size={11} />,
        badgeBg: "bg-cyan-100 text-cyan-600",
      };
    }
    if (type.includes("assign")) {
      return {
        title: "Task reassigned",
        icon: <User size={11} />,
        badgeBg: "bg-sky-100 text-sky-600",
      };
    }
    if (type.includes("snooze")) {
      return {
        title: "Task snoozed",
        icon: <Clock size={11} />,
        badgeBg: "bg-orange-100 text-orange-600",
      };
    }
    if (type.includes("risk")) {
      return {
        title: "Risk updated",
        icon: <AlertTriangle size={11} />,
        badgeBg: "bg-rose-100 text-rose-600",
      };
    }
    return {
      title: "Task updated",
      icon: <Activity size={11} />,
      badgeBg: "bg-slate-100 text-slate-600",
    };
  };

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
  const fetchTaskData = async (forceFullLoading = false) => {
    if (!taskId) {
      setError("No task ID provided");
      setLoading(false);
      return;
    }

    try {
      console.log("DEBUG - Fetching task data for ID:", taskId);
      if (forceFullLoading || !task) {
        setLoading(true);
      }

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
            ...subtask,
            id: subtask._id,
            _id: subtask._id,
            title: subtask.title,
            description: subtask.description,
            taskType: subtask.taskType || "regular",
            emailConfig: subtask.emailConfig || null,
            attachments: subtask.attachments || [],
            status: subtask.status?.toUpperCase() || "TODO",
            priority: subtask.priority || "medium",
            assignee: subtask.assignedTo
              ? typeof subtask.assignedTo === "object"
                ? `${subtask.assignedTo.firstName || ""} ${subtask.assignedTo.lastName || ""}`.trim() ||
                  subtask.assignedTo.email
                : subtask.assignedTo
              : "Unassigned",
            assigneeId: subtask.assignedTo?._id || subtask.assignedTo || null,
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
              ? typeof subtask.createdBy === "object"
                ? `${subtask.createdBy.firstName || ""} ${subtask.createdBy.lastName || ""}`.trim() ||
                  subtask.createdBy.email
                : subtask.createdBy
              : "Unknown",
            createdAt: subtask.createdAt,
            parentTaskId: subtask.parentTaskId,
            tags: subtask.tags || [],
          })),
          linkedItems: taskData.linkedTasks || [],
          linkedToMilestone: taskData.linkedToMilestone || null,
          linkedTaskId: taskData.linkedTaskId || null,
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
          emailConfig:
            taskData.emailConfig ||
            (taskData.emailSubject ||
            taskData.emailBody ||
            taskData.emailRecipients?.length > 0
              ? {
                  subject: taskData.emailSubject || "",
                  body: taskData.emailBody || "",
                  recipients:
                    taskData.emailRecipients ||
                    taskData.emailConfig?.recipients ||
                    [],
                  variables:
                    taskData.emailVariables ||
                    taskData.emailConfig?.variables ||
                    [],
                  attachedFormId:
                    taskData.attachedFormId ||
                    taskData.emailConfig?.attachedFormId ||
                    null,
                  autoComplete:
                    taskData.emailAutoComplete ||
                    taskData.emailConfig?.autoComplete ||
                    false,
                }
              : null),
          emailSubject:
            taskData.emailSubject || taskData.emailConfig?.subject || "",
          emailBody: taskData.emailBody || taskData.emailConfig?.body || "",
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
        if (taskData.attachments && Array.isArray(taskData.attachments)) {
          const activeAtts = taskData.attachments.filter((att) => !att.deleted);
          setTaskAttachments((prev) =>
            prev && prev.length > 0 ? prev : activeAtts,
          );
        }
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

  // Fetch attachments for the task
  const fetchAttachments = useCallback(async () => {
    if (!taskId) return;

    try {
      setAttachmentsLoading(true);
      const token =
        localStorage.getItem("token") || localStorage.getItem("authToken");

      const response = await fetch(`/api/tasks/${taskId}/attachments`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const rawAttachments = result.data.attachments || [];
          setTaskAttachments(rawAttachments);
        }
      }
    } catch (error) {
      console.error("Error fetching attachments:", error);
    } finally {
      setAttachmentsLoading(false);
    }
  }, [taskId]);

  // Combined attachments for display
  const displayAttachments = useMemo(() => {
    if (Array.isArray(taskAttachments) && taskAttachments.length > 0) {
      return taskAttachments;
    }
    if (task?.attachments && Array.isArray(task.attachments)) {
      const active = task.attachments.filter((att) => !att.deleted);
      if (active.length > 0) return active;
    }
    if (Array.isArray(taskAttachments)) {
      return taskAttachments;
    }
    return [];
  }, [taskAttachments, task?.attachments]);

  // Format file size helper
  const formatAttachmentSize = (bytes) => {
    if (typeof bytes === "string") return bytes;
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // File badge color helper
  const getAttachmentBadgeColor = (fileName) => {
    const ext = (fileName || "").split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return "bg-red-50 text-red-600 border-red-200";
      case "doc":
      case "docx":
        return "bg-blue-50 text-blue-600 border-blue-200";
      case "xls":
      case "xlsx":
      case "csv":
        return "bg-emerald-50 text-emerald-600 border-emerald-200";
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "webp":
      case "svg":
        return "bg-amber-50 text-amber-600 border-amber-200";
      case "zip":
      case "rar":
      case "7z":
        return "bg-purple-50 text-purple-600 border-purple-200";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  // Download attachment handler
  const handleDownloadAttachment = async (file) => {
    const fileId = file._id || file.id;
    const token =
      localStorage.getItem("token") || localStorage.getItem("authToken");
    const fileName =
      file.originalName || file.name || file.filename || "download";

    if (fileId && token) {
      try {
        const res = await fetch(
          `/api/tasks/${taskId}/files/${fileId}/download`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (res.ok) {
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.style.display = "none";
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          return;
        }
      } catch (err) {
        console.error("Download failed:", err);
      }
    }

    if (file.url) {
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = file.url;
      a.download = fileName;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // View attachment handler
  const handleViewAttachment = async (file) => {
    const fileId = file._id || file.id;
    const token =
      localStorage.getItem("token") || localStorage.getItem("authToken");
    const fileName = file.originalName || file.name || file.filename || "";
    const ext = fileName.split(".").pop()?.toLowerCase();
    const isPreviewable = [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "webp",
      "svg",
      "pdf",
      "txt",
      "csv",
      "html",
      "htm",
    ].includes(ext);

    if (fileId && token) {
      const endpoint = isPreviewable
        ? `/api/tasks/${taskId}/files/${fileId}/view`
        : `/api/tasks/${taskId}/files/${fileId}/download`;
      try {
        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const blob = await res.blob();
          if (isPreviewable) {
            const blobWithType = new Blob([blob], {
              type: file.mimetype || blob.type || "application/octet-stream",
            });
            const url = window.URL.createObjectURL(blobWithType);
            window.open(url, "_blank");
            setTimeout(() => window.URL.revokeObjectURL(url), 60000);
          } else {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.style.display = "none";
            a.href = url;
            a.download = fileName || "download";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => window.URL.revokeObjectURL(url), 5000);
          }
          return;
        }
      } catch (err) {
        console.error("View file failed:", err);
      }
    }

    if (file.url) {
      window.open(file.url, "_blank");
    }
  };

  // Fetch data when component mounts or taskId changes
  useEffect(() => {
    fetchTaskData();
    if (taskId) {
      fetchComments();
      fetchActivities(); // Add activity fetching
      fetchAttachments();
    }
  }, [taskId, fetchAttachments]);

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
  // ✅ Milestone tasks or any task with linked prerequisite items
  const shouldShowLinkedItemsTab = () => {
    if (!task && !rawTaskData) return false;

    const t = rawTaskData || task;
    const taskType = (t?.taskType || t?.type || "").toLowerCase();
    const mainTaskType = (t?.mainTaskType || "").toLowerCase();

    // 1. Milestone tasks always have access to linked items
    const isMilestone =
      taskType === "milestone" ||
      mainTaskType === "milestone" ||
      t?.isMilestone;

    if (isMilestone) return true;

    // 2. Any task that has linked tasks (linkedTaskId, linkedToMilestone, linkedItems, linkedTasks, linkedTaskIds, milestoneData)
    const hasLinkedItems =
      !!t?.linkedTaskId ||
      !!t?.contextTaskId ||
      !!t?.contextTask ||
      !!t?.context_task_id ||
      !!t?.linkedToMilestone ||
      (Array.isArray(t?.linkedItems) && t.linkedItems.length > 0) ||
      (Array.isArray(t?.linkedTasks) && t.linkedTasks.length > 0) ||
      (Array.isArray(t?.linkedTaskIds) && t.linkedTaskIds.length > 0) ||
      (Array.isArray(t?.milestoneData?.linkedTaskIds) &&
        t.milestoneData.linkedTaskIds.length > 0);

    return hasLinkedItems;
  };

  const getLinkedItemsCount = () => {
    const t = rawTaskData || task;
    if (!t) return 0;

    const uniqueLinked = new Set();

    const addId = (item) => {
      if (!item) return;
      if (typeof item === "object") {
        const id = item._id || item.id;
        if (id) uniqueLinked.add(String(id));
      } else if (typeof item === "string" && item.trim()) {
        uniqueLinked.add(item.trim());
      }
    };

    if (Array.isArray(t.linkedItems)) {
      t.linkedItems.forEach(addId);
    }
    if (Array.isArray(t.linkedTasks)) {
      t.linkedTasks.forEach(addId);
    }
    if (Array.isArray(t.linkedTaskIds)) {
      t.linkedTaskIds.forEach(addId);
    }
    if (Array.isArray(t.milestoneData?.linkedTaskIds)) {
      t.milestoneData.linkedTaskIds.forEach(addId);
    }

    addId(t.linkedTaskId);
    addId(t.contextTaskId);
    addId(t.contextTask);
    addId(t.context_task_id);
    addId(t.linkedToMilestone);

    return uniqueLinked.size;
  };

  // Helper function to check if Attached Forms tab should be shown
  // ✅ Show if task or any subtask has attached forms
  const shouldShowAttachedFormsTab = () => {
    if (!task || !rawTaskData) return false;

    // Check if task has attached form (regular or email)
    if (
      rawTaskData.attached_form_version_id ||
      rawTaskData.emailConfig?.attachedFormId
    )
      return true;

    // Check if any subtask has attached form (regular or email)
    if (rawTaskData.subtasks && rawTaskData.subtasks.length > 0) {
      return rawTaskData.subtasks.some(
        (st) => st.attached_form_version_id || st.emailConfig?.attachedFormId,
      );
    }

    return false;
  };

  const tabs = [
    {
      id: "core-info",
      label: "Overview",
      icon: LayoutDashboard,
      hasIcon: true,
    },
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
      count: commentsCount || 0,
      hasIcon: true,
    },
    {
      id: "files",
      label: "Attachments",
      icon: Paperclip,
      count: displayAttachments.length,
      hasIcon: true,
    },
    {
      id: "activity",
      label: "Activity",
      icon: Activity,
      count: activities?.length || 0,
      hasIcon: true,
    },

    // ✅ Show Linked Items tab for milestone tasks or any task with linked items
    ...(shouldShowLinkedItemsTab()
      ? [
          {
            id: "linked",
            label: "Linked Items",
            icon: Link,
            count: getLinkedItemsCount(),
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
    canAddComment: commentPermissions.canAdd || false,
    canEditComment: commentPermissions.canEdit || false,
    canDeleteComment: commentPermissions.canDelete || false,
    canModerateComments: commentPermissions.canModerate || false,
    canAttachFiles: commentPermissions.canAttachFiles || false,
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

  const isProcessStepTask = useMemo(() => {
    if (!task) return false;
    return Boolean(
      task.isSubtask ||
      task.isProcessBuilderTask ||
      task.parentTask ||
      ["email", "approval", "milestone"].includes(
        String(task.taskType || task.classification || "").toLowerCase(),
      ),
    );
  }, [task]);

  const isUserAuthorizedToEdit = useMemo(() => {
    if (!task || !currentUser) return false;

    const currentUserId = String(currentUser.id || currentUser._id || "");
    if (!currentUserId) return false;

    // Task Owner (Creator)
    const isOwner =
      currentUserId ===
      String(task.creatorId || task.createdBy?._id || task.createdBy || "");

    // Assignee
    const isAssignee =
      currentUserId ===
      String(task.assigneeId || task.assignedTo?._id || task.assignedTo || "");

    // Collaborator
    const isCollaborator =
      Array.isArray(task.collaborators) &&
      task.collaborators.some((collab) => {
        const collabId =
          typeof collab === "object"
            ? collab._id || collab.id || collab.value
            : collab;
        return String(collabId) === currentUserId;
      });

    // Strict check: Only Task Owner (Creator), Assignee, or Collaborator (or Super Admin / Org Admin / Manager) can edit
    const roles = Array.isArray(currentUser.role)
      ? currentUser.role
      : [currentUser.role].filter(Boolean);
    const isSuperAdmin =
      roles.some((r) =>
        ["org_admin", "admin", "tasksetu-admin", "manager"].includes(r),
      ) ||
      ["org_admin", "admin", "tasksetu-admin", "manager"].includes(activeRole);

    return isOwner || isAssignee || isCollaborator || isSuperAdmin;
  }, [task, currentUser, activeRole]);

  const isTaskEditable = useMemo(() => {
    if (!task) return false;
    if (!isUserAuthorizedToEdit) return false;

    const currentStatus = String(task.status || "").toUpperCase();
    if (isProcessStepTask) {
      return ["OPEN", "PENDING"].includes(currentStatus);
    }
    return !["DONE", "COMPLETED", "CANCELLED"].includes(currentStatus);
  }, [task, isProcessStepTask, isUserAuthorizedToEdit]);

  // Loading state (only for initial load, never unmount during edits)
  if (loading && !task) {
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
      setIsUpdatingStatus(true);
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

      // Invalidate caches
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}`] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["regular-tasks"] });

      // Update local state immediately without full page reload
      setTask((prev) => ({
        ...prev,
        status: newStatus,
        progress: newStatus === "DONE" ? 100 : (prev?.progress ?? 0),
      }));

      // Show toast confirmation
      const targetSt = dbTaskStatuses.find((s) => s.code === newStatus);
      showSuccessToast(`Status updated to ${targetSt?.label || newStatus}`);

      // Refresh activities in background
      fetchActivities();
      fetchTaskData(false);

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
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handlePriorityChange = async (newPriority) => {
    // Block priority change for non-editable tasks
    if (!isTaskEditable) {
      showErrorToast(
        isProcessStepTask
          ? `Task priority cannot be changed while status is ${task?.status}. Editing is only allowed when status is OPEN.`
          : `Task is already ${task?.status}. Priority cannot be changed.`,
      );
      return;
    }

    try {
      setIsUpdatingPriority(true);
      const token = localStorage.getItem("token");
      const taskIdToUpdate =
        task?._id || task?.id || propTaskId || params?.taskId;

      if (!taskIdToUpdate) {
        showErrorToast("Task ID not found. Cannot update priority.");
        return;
      }

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

      if (response.data?.success || response.status === 200) {
        // Update local state immediately
        setTask((prev) => ({ ...prev, priority: newPriority }));

        const opt = priorityOptions.find(
          (p) => p.value?.toLowerCase() === String(newPriority).toLowerCase(),
        );
        const label =
          opt?.label ||
          newPriority.charAt(0).toUpperCase() + newPriority.slice(1);
        showSuccessToast(`Priority changed to ${label}`);

        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        queryClient.invalidateQueries({
          queryKey: [`/api/tasks/${taskIdToUpdate}`],
        });
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({ queryKey: ["regular-tasks"] });

        // Refetch silently in background to ensure sync
        fetchActivities();
        fetchTaskData(false);
      } else {
        throw new Error(response.data?.message || "Failed to update priority");
      }
    } catch (error) {
      console.error("❌ Error updating priority:", error);
      showErrorToast(
        error.response?.data?.message ||
          error.message ||
          "Failed to update priority",
      );
    } finally {
      setIsUpdatingPriority(false);
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

        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        queryClient.invalidateQueries({
          queryKey: [`/api/tasks/${taskIdToReassign}`],
        });
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({ queryKey: ["regular-tasks"] });

        // Refresh task data to get latest info
        await fetchTaskData(false);
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
      const token = localStorage.getItem("token");
      const taskIdToSnooze = task?._id || task?.id;
      const { snoozeUntil, reason } = snoozeData;

      console.log("⏰ Snoozing task:", taskIdToSnooze, {
        snoozeUntil,
        reason,
      });

      // Use correct endpoint: /api/tasks/:id/snooze
      const response = await axios.patch(
        `/api/tasks/${taskIdToSnooze}/snooze`,
        {
          snoozeUntil: snoozeUntil,
          snoozeReason: reason,
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

        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        queryClient.invalidateQueries({
          queryKey: [`/api/tasks/${taskIdToSnooze}`],
        });
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({ queryKey: ["regular-tasks"] });

        // Refresh task data and activities
        await fetchTaskData(false);
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

        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        queryClient.invalidateQueries({
          queryKey: [`/api/tasks/${taskIdToUnsnooze}`],
        });
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({ queryKey: ["regular-tasks"] });

        // Refresh task data and activities
        await fetchTaskData(false);
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
      const token = localStorage.getItem("token");
      const taskIdToMark = task?._id || task?.id;
      const { riskReason, riskLevel } = riskData;

      console.log("⚠️ Marking task as risk:", taskIdToMark, {
        riskReason,
        riskLevel,
      });

      // Use correct endpoint: /api/tasks/:id/mark-risk
      const response = await axios.patch(
        `/api/tasks/${taskIdToMark}/mark-risk`,
        {
          riskReason,
          riskLevel,
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
          riskReason,
          riskLevel,
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

        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        queryClient.invalidateQueries({
          queryKey: [`/api/tasks/${taskIdToMark}`],
        });
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({ queryKey: ["regular-tasks"] });

        // Refresh task data and activities
        await fetchTaskData(false);
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

        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        queryClient.invalidateQueries({
          queryKey: [`/api/tasks/${taskIdToUnmark}`],
        });
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({ queryKey: ["regular-tasks"] });

        // Refresh todo items
        fetchTaskData(false);
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
      setIsSavingTimeEstimate(true);
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
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({
        queryKey: [`/api/tasks/${taskIdToUpdate}`],
      });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["regular-tasks"] });

      await fetchActivities();
      fetchTaskData(false);
    } catch (error) {
      console.error("Error updating time estimate:", error);
      showErrorToast("Failed to update time estimate");
      setTimeEstimateInput(task.timeEstimate?.toString() || "0");
    } finally {
      setIsSavingTimeEstimate(false);
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
      setIsSavingProgress(true);
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
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({
        queryKey: [`/api/tasks/${taskIdToUpdate}`],
      });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["regular-tasks"] });

      await fetchActivities();
      fetchTaskData(false);
    } catch (error) {
      console.error("Error updating progress:", error);
      showErrorToast("Failed to update progress");
      setProgressInput(task.progress?.toString() || "0");
    } finally {
      setIsSavingProgress(false);
    }
  };

  const handleDescriptionUpdate = async () => {
    if (!isTaskEditable) {
      showErrorToast(
        isProcessStepTask
          ? `Task details cannot be changed while status is ${task?.status}. Editing is only allowed when status is OPEN.`
          : `Task is already ${task?.status}. Description cannot be changed.`,
      );
      setIsEditingDescription(false);
      return;
    }

    try {
      setIsSavingDescription(true);
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
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({
        queryKey: [`/api/tasks/${taskIdToUpdate}`],
      });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["regular-tasks"] });

      await fetchActivities();
      fetchTaskData(false);
    } catch (error) {
      console.error("Error updating description:", error);
      showErrorToast(
        error?.response?.data?.message || "Failed to update description",
      );
    } finally {
      setIsSavingDescription(false);
    }
  };

  const handleTagsUpdate = async () => {
    if (!isTaskEditable) {
      showErrorToast(
        isProcessStepTask
          ? `Task details cannot be changed while status is ${task?.status}. Editing is only allowed when status is OPEN.`
          : `Task is already ${task?.status}. Tags cannot be changed.`,
      );
      setIsEditingTags(false);
      return;
    }

    // Combine tags in list with any un-added text in input
    const pendingItems = tagsInput
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean);

    const finalTags = [...editableTagsList];
    pendingItems.forEach((item) => {
      if (
        !finalTags.some(
          (t) => t.replace(/^#/, "").toLowerCase() === item.toLowerCase(),
        )
      ) {
        finalTags.push(item);
      }
    });

    try {
      setIsSavingTags(true);
      const token = localStorage.getItem("token");
      const taskIdToUpdate = task?._id || task?.id;

      await axios.put(
        `/api/tasks/${taskIdToUpdate}`,
        { tags: finalTags },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      setTask((prev) => ({ ...prev, tags: finalTags }));
      setEditableTagsList(finalTags);
      setTagsInput("");
      setIsEditingTags(false);
      showSuccessToast("Tags updated");
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({
        queryKey: [`/api/tasks/${taskIdToUpdate}`],
      });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["regular-tasks"] });

      await fetchActivities();
      fetchTaskData(false);
    } catch (error) {
      console.error("Error updating tags:", error);
      showErrorToast(error?.response?.data?.message || "Failed to update tags");
    } finally {
      setIsSavingTags(false);
    }
  };

  const handleAddTag = (textToAdd) => {
    const raw = (textToAdd !== undefined ? textToAdd : tagsInput).trim();
    if (!raw) return;
    const items = raw
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean);
    setEditableTagsList((prev) => {
      const next = [...prev];
      items.forEach((item) => {
        if (
          !next.some(
            (t) => t.replace(/^#/, "").toLowerCase() === item.toLowerCase(),
          )
        ) {
          next.push(item);
        }
      });
      return next;
    });
    setTagsInput("");
  };

  const handleRemoveTag = (indexToRemove) => {
    setEditableTagsList((prev) =>
      prev.filter((_, idx) => idx !== indexToRemove),
    );
  };

  const handleDueDateUpdate = async () => {
    if (!isTaskEditable) {
      showErrorToast(
        isProcessStepTask
          ? `Task details cannot be changed while status is ${task?.status}. Editing is only allowed when status is OPEN.`
          : `Task is already ${task?.status}. Due date cannot be changed.`,
      );
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
      setIsSavingDueDate(true);
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

      setTask((prev) => ({ ...prev, dueDate: dueDateValue }));
      setIsEditingDueDate(false);
      showSuccessToast("Due date updated");
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({
        queryKey: [`/api/tasks/${taskIdToUpdate}`],
      });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["regular-tasks"] });

      await fetchActivities();
      fetchTaskData(false);
    } catch (error) {
      console.error("Error updating due date:", error);
      showErrorToast("Failed to update due date");
    } finally {
      setIsSavingDueDate(false);
    }
  };

  const handleEmailConfigUpdate = async (updatedConfig) => {
    if (!isTaskEditable) {
      showErrorToast(
        `Email configuration is locked in ${task?.status} status.`,
      );
      setIsEditingEmailConfig(false);
      return;
    }

    const configToSave = updatedConfig || emailConfigInput;
    if (!configToSave) return;

    try {
      const token = localStorage.getItem("token");
      const taskIdToUpdate = task?._id || task?.id;

      const payload = {
        emailConfig: configToSave,
        emailSubject: configToSave.subject,
        emailBody: configToSave.body,
      };

      await axios.put(`/api/tasks/${taskIdToUpdate}`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      setTask((prev) => ({
        ...prev,
        emailConfig: configToSave,
      }));
      setIsEditingEmailConfig(false);
      showSuccessToast("Email configuration updated successfully");
      await fetchActivities();
    } catch (error) {
      console.error("Error updating email configuration:", error);
      showErrorToast(
        error?.response?.data?.message ||
          "Failed to update email configuration",
      );
    }
  };
  return (
    <div className="task-view-container task-detail-page min-h-[calc(100vh-4rem)] bg-[#f8fafc] text-slate-900 pb-12 [scrollbar-gutter:stable] [&_.card]:!rounded-sm [&_.rounded-2xl]:!rounded-sm [&_.rounded-xl]:!rounded-sm [&_.rounded-lg]:!rounded-sm [&_.rounded-md]:!rounded-sm [&_input:not([type='checkbox']):not([type='radio'])]:!rounded-sm [&_select]:!rounded-sm [&_textarea]:!rounded-sm [&_button:not(.rounded-full)]:!rounded-sm">
      {/* FIXED TOP HEADER: Breadcrumbs, Action Buttons, Hero Card, Tab Navigation */}
      <div
        className={`sticky ${onClose ? "top-0" : "top-16"} z-20 bg-[#f8fafc] px-4 sm:px-6 lg:px-8 pt-4 pb-0 border-b border-slate-200/80 shadow-xs mb-6`}
      >
        {/* 1. Top Breadcrumbs & Action Buttons Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-1 mb-4">
          {/* Left: Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm">
            <Home size={16} className="text-slate-500" />
            <span
              onClick={() => {
                if (onClose) onClose();
                else setLocation("/tasks");
              }}
              className="font-medium text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Tasks
            </span>
            <ChevronRight size={14} className="text-slate-400" />
            <span className="font-medium text-slate-700">Task Details</span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mark as Complete Button */}
            {task?.status !== "DONE" && task?.status !== "CANCELLED" && (
              <button
                onClick={handleMarkDone}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#16a34a] hover:bg-[#15803d] rounded-sm shadow-sm transition-colors"
              >
                <Check size={14} strokeWidth={2.5} className="text-white" />{" "}
                Mark as Complete
              </button>
            )}

            {/* Snooze Button */}
            {!task?.isRecurring &&
              task?.status !== "DONE" &&
              (isSnoozed ? (
                <button
                  onClick={handleUnsnoozeTask}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-300 rounded-sm bg-emerald-50 hover:bg-emerald-100 shadow-sm transition-colors"
                >
                  <Clock size={13} /> Wake Up
                </button>
              ) : (
                <button
                  onClick={() => setShowSnoozeModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-200 rounded-sm bg-white hover:bg-slate-50 shadow-sm transition-colors"
                >
                  <Clock size={13} className="text-slate-500" /> Snooze
                </button>
              ))}

            {/* Mark as Risk Button */}
            {task?.status !== "DONE" &&
              (task?.isRisk ? (
                <button
                  onClick={() => setShowMitigationModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-300 rounded-sm bg-emerald-50 hover:bg-emerald-100 shadow-sm transition-colors"
                >
                  <CheckCircle size={13} /> Mark as Mitigated
                </button>
              ) : (
                <button
                  onClick={() => setShowRiskModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-amber-800 border border-amber-200 rounded-sm bg-amber-50/50 hover:bg-amber-50 shadow-sm transition-colors"
                >
                  <AlertTriangle size={13} className="text-amber-500" /> Mark as
                  Risk
                </button>
              ))}

            {/* ... More Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-200 rounded-sm bg-white hover:bg-slate-50 shadow-sm transition-colors"
              >
                <MoreHorizontal size={14} className="text-slate-600" />
                <span>More</span>
                <ChevronDown size={13} className="text-slate-400" />
              </button>
              {showMoreMenu && (
                <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-sm shadow-lg z-30 py-1">
                  {!task.isSubtask && shouldShowSubtasksTab() && (
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        openSubtaskDrawer(task, null, fetchTaskData);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                    >
                      <Plus size={14} className="text-blue-600" /> Subtask
                    </button>
                  )}
                  {currentUser?.id === task?.creatorId && (
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        setShowReassignModal(true);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                    >
                      <Users size={14} className="text-indigo-600" /> Reassign
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      handleExportTask();
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                  >
                    <Download size={14} className="text-slate-600" /> Export
                    Task
                  </button>
                  {task?.status !== "CANCELLED" && task?.status !== "DONE" && (
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        setShowCancelModal(true);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-rose-50 flex items-center gap-2 text-rose-600 border-t border-slate-100 mt-1"
                    >
                      <X size={14} className="text-rose-600" /> Cancel Task
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. Hero Header Card */}
        <div className="bg-white rounded-sm border border-slate-200/80 p-6 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Left: Icon + Title + Description Subtitle + Badges */}
            <div className="flex items-start gap-4 min-w-0 flex-1">
              {/* Lavender Rounded Icon Container */}
              <div className="w-14 h-14 rounded-sm bg-[#ede9fe]/80 border border-indigo-100 flex items-center justify-center shrink-0 shadow-sm mt-1">
                <FileText size={26} className="text-[#7c3aed]" />
              </div>

              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight truncate">
                  {task.title}
                </h1>
                {(() => {
                  const cleanDesc =
                    task.description &&
                    task.description !== "No description provided"
                      ? task.description.replace(/<[^>]*>/g, "").trim()
                      : "Fill in monthly finance projection for capex type expenses.";
                  return (
                    <p
                      className="text-sm text-slate-500 mt-1 mb-3.5 line-clamp-1 truncate max-w-3xl"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                      title={cleanDesc}
                    >
                      {cleanDesc}
                    </p>
                  );
                })()}

                {/* Badges Row */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Tags */}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                    <Tag size={12} />{" "}
                    {task.tags?.[0] ? task.tags[0] : "finance"}
                  </span>

                  {/* Regular Task */}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <ArrowUpDown size={12} /> {task.taskType || "Regular Task"}
                  </span>

                  {/* Private */}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    <Lock size={12} /> {task.visibility || "Private"}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Status badge & Progress bar */}
            <div className="flex flex-col md:items-end justify-between self-stretch md:self-auto shrink-0 pt-2 md:pt-0">
              {/* Status Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-sm bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold uppercase tracking-wider self-start md:self-end">
                {isUpdatingStatus ? (
                  <Loader
                    size={12}
                    className="animate-spin text-blue-600 shrink-0"
                  />
                ) : (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: currentStatusObj?.color || "#3b82f6",
                    }}
                  />
                )}
                <span>
                  {isUpdatingStatus
                    ? "Updating..."
                    : currentStatusObj?.label || task.status || "OPEN"}
                </span>
              </div>

              {/* Progress */}
              <div className="mt-4 flex flex-col md:items-end w-full md:w-auto">
                <div className="flex items-center justify-between w-full md:w-52 mb-1.5">
                  <span className="text-xs font-medium text-slate-500">
                    Progress
                  </span>
                  {task?.status === "DONE" || !isTaskEditable ? (
                    <span className="text-xs font-bold text-slate-700">
                      {task.progress || 0}%
                    </span>
                  ) : isEditingProgress ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="95"
                        disabled={isSavingProgress}
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
                          if (e.key === "Enter") handleProgressUpdate();
                          if (e.key === "Escape") {
                            setIsEditingProgress(false);
                            setProgressInput(task.progress?.toString() || "0");
                          }
                        }}
                        autoFocus
                        className="w-12 px-1.5 py-0.5 text-xs font-bold text-slate-700 border border-blue-400 rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white disabled:opacity-50"
                      />
                      <span className="text-xs font-bold text-slate-700">
                        %
                      </span>
                      {isSavingProgress && (
                        <Loader
                          size={11}
                          className="animate-spin text-blue-600 ml-0.5"
                        />
                      )}
                    </div>
                  ) : (
                    <div
                      className="flex items-center gap-1 cursor-pointer group hover:text-blue-600 transition-colors"
                      onClick={() => {
                        if (isSavingProgress) return;
                        setProgressInput(task.progress?.toString() || "0");
                        setIsEditingProgress(true);
                      }}
                      title="Click to edit progress"
                    >
                      {isSavingProgress && (
                        <Loader
                          size={11}
                          className="animate-spin text-blue-600"
                        />
                      )}
                      <span className="text-xs font-bold text-slate-700 group-hover:text-blue-600">
                        {task.progress || 0}%
                      </span>
                      <Pen
                        size={11}
                        className="text-slate-400 group-hover:text-blue-600 transition-colors"
                      />
                    </div>
                  )}
                </div>
                <div className="w-full md:w-52 h-2 bg-slate-100 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-sm transition-all duration-300"
                    style={{
                      width:
                        Math.min(Math.max(task.progress || 0, 0), 100) + "%",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Underline Tab Navigation */}
        <div className="flex items-end gap-6 sm:gap-8 border-b border-slate-200 px-2 mt-6 overflow-x-auto overflow-y-hidden no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={
                  "flex items-center gap-2 pb-3 text-sm border-b-2 -mb-px whitespace-nowrap shrink-0 outline-none focus:outline-none transition-colors duration-150 " +
                  (isActive
                    ? "text-blue-600 font-semibold border-blue-600"
                    : "text-slate-500 hover:text-slate-800 font-medium border-transparent hover:border-slate-300")
                }
              >
                <IconComponent
                  size={16}
                  className={isActive ? "text-blue-600" : "text-slate-400"}
                />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={
                      "text-xs px-2 py-0.5 rounded-sm font-semibold border " +
                      (isActive
                        ? "bg-blue-50 text-blue-600 border-blue-100"
                        : "bg-slate-100 text-slate-600 border-transparent")
                    }
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 4. Tab Contents Container */}
      </div>

      {/* Main Tab Content Body (Single page scroll, no fluctuation) */}
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="tab-contents-container min-h-[calc(100vh-14rem)]">
          {activeTab === "core-info" && (
            <div className="core-info-view space-y-6">
              {/* Process Step Task Banner (if applicable) */}
              {isProcessStepTask && (
                <div
                  className={
                    "p-4 rounded-sm flex items-center justify-between gap-2 text-xs font-semibold border " +
                    (isTaskEditable
                      ? "bg-blue-50 border-blue-200 text-blue-800"
                      : "bg-amber-50 border-amber-200 text-amber-800")
                  }
                >
                  <div className="flex items-center gap-2">
                    {isTaskEditable ? (
                      <Pen size={14} className="text-blue-600 shrink-0" />
                    ) : (
                      <Lock size={14} className="text-amber-600 shrink-0" />
                    )}
                    <span>
                      {isTaskEditable ? (
                        <>
                          <strong>Task Editable:</strong> Assignees can edit
                          task details while status is <strong>OPEN</strong>.
                        </>
                      ) : (
                        <>
                          <strong>Task View Only:</strong> You are not
                          authorized to edit this task configuration.
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Cancellation Reason Banner (if cancelled) */}
              {task.status === "CANCELLED" && (
                <div className="bg-white rounded-sm border border-rose-200 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-sm bg-rose-50 text-rose-600 flex items-center justify-center">
                      <X size={18} />
                    </div>
                    <h3 className="text-base font-bold text-rose-700">
                      Cancellation Reason
                    </h3>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {rawTaskData?.cancelNotes ||
                      "No cancellation reason provided."}
                  </p>
                </div>
              )}

              {/* Parent Task Card (if subtask) */}
              {task.isSubtask && task.parentTask && (
                <div className="bg-white rounded-sm border border-amber-200 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-sm bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Link size={18} />
                    </div>
                    <h3 className="text-base font-bold text-amber-800">
                      Parent Task
                    </h3>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    {typeof task.parentTask === "string"
                      ? task.parentTask
                      : task.parentTask?.title || "Unknown"}
                  </p>
                </div>
              )}

              {/* Main 2-Column Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column (Content Cards) */}
                <div className="lg:col-span-8 space-y-6">
                  {/* Description Card */}
                  <div className="bg-white rounded-sm border border-slate-200/80 p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-sm bg-blue-50 text-blue-600 flex items-center justify-center">
                          <FileText size={18} />
                        </div>
                        <h3 className="text-base font-bold text-slate-900">
                          Description
                        </h3>
                      </div>
                      {!isEditingDescription &&
                        isTaskEditable &&
                        task.status !== "DONE" &&
                        task.status !== "CANCELLED" && (
                          <div className="flex items-center gap-2">
                            {isSavingDescription && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600">
                                <Loader size={11} className="animate-spin" />{" "}
                                Saving...
                              </span>
                            )}
                            <button
                              onClick={() => {
                                setDescriptionInput(
                                  task.description === "No description provided"
                                    ? ""
                                    : task.description.replace(/<[^>]*>/g, ""),
                                );
                                setIsEditingDescription(true);
                              }}
                              disabled={isSavingDescription}
                              className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-200 rounded-sm bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
                            >
                              <Pen size={12} className="text-slate-500" /> Edit
                            </button>
                          </div>
                        )}
                    </div>

                    <div className="mt-4">
                      {isEditingDescription ? (
                        <div className="space-y-3">
                          <textarea
                            value={descriptionInput}
                            disabled={isSavingDescription}
                            onChange={(e) =>
                              setDescriptionInput(e.target.value)
                            }
                            className="w-full min-h-[110px] p-3 text-sm border border-slate-300 rounded-sm focus:ring-1 focus:ring-blue-500 focus:outline-none resize-vertical disabled:opacity-50"
                            placeholder="Enter task description..."
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleDescriptionUpdate}
                              disabled={isSavingDescription}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-sm shadow-sm transition-opacity"
                            >
                              {isSavingDescription && (
                                <Loader
                                  size={12}
                                  className="animate-spin text-white"
                                />
                              )}
                              <span>
                                {isSavingDescription ? "Saving..." : "Save"}
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                setIsEditingDescription(false);
                                setDescriptionInput("");
                              }}
                              disabled={isSavingDescription}
                              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-sm disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-600 leading-relaxed">
                          {task.description &&
                          task.description !== "No description provided" ? (
                            <SafeHtml html={task.description} />
                          ) : (
                            <p className="text-slate-400 italic">
                              No description provided for this task.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 1: People Card and Organization & Tags Card */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* People Card */}
                    <div className="bg-white rounded-sm border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-5">
                          <div className="w-8 h-8 rounded-sm bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Users size={18} />
                          </div>
                          <h3 className="text-base font-bold text-slate-900">
                            People
                          </h3>
                        </div>

                        <div className="space-y-5">
                          {/* Created by */}
                          <div>
                            <p className="text-xs font-medium text-slate-400 mb-2">
                              Created by
                            </p>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
                                {getInitials(
                                  task.createdBy ||
                                    rawTaskData?.createdBy?.firstName ||
                                    "AY",
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-slate-900 truncate">
                                  {task.createdBy ||
                                    (rawTaskData?.createdBy
                                      ? (rawTaskData.createdBy.firstName ||
                                          "") +
                                        " " +
                                        (rawTaskData.createdBy.lastName || "")
                                      : "Aichchhik Yadav"
                                    ).trim()}
                                </p>
                                <p className="text-xs text-slate-500 truncate">
                                  {rawTaskData?.createdBy?.email ||
                                    "tasksetudevmaster@gmail.com"}
                                </p>
                                <span className="inline-block mt-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-sm">
                                  {rawTaskData?.createdBy?.role ||
                                    currentUser?.role ||
                                    "org_admin"}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Assigned to */}
                          <div className="pt-4 border-t border-slate-100">
                            <p className="text-xs font-medium text-slate-400 mb-2">
                              Assigned to
                            </p>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
                                {getInitials(
                                  task.assignee ||
                                    rawTaskData?.assignedTo?.firstName ||
                                    "GY",
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-slate-900 truncate">
                                  {task.assignee ||
                                    (rawTaskData?.assignedTo
                                      ? (rawTaskData.assignedTo.firstName ||
                                          "") +
                                        " " +
                                        (rawTaskData.assignedTo.lastName || "")
                                      : "Golu yadav"
                                    ).trim()}
                                </p>
                                <p className="text-xs text-slate-500 truncate">
                                  {rawTaskData?.assignedTo?.email ||
                                    "aichchhik.xcrino@gmail.com"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Organization & Tags Card */}
                    <div className="bg-white rounded-sm border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
                      <div>
                        {/* Organization Section */}
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-sm bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Building2 size={20} />
                          </div>
                          <h3 className="text-base font-bold text-slate-900">
                            Organization
                          </h3>
                        </div>

                        <div className="flex items-start gap-3 pt-1">
                          <div className="w-8 h-8 rounded-sm bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                            <Building2 size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-900 truncate">
                              {rawTaskData?.organization?.name ||
                                currentUser?.organization?.name ||
                                "Tasksetu"}
                            </p>
                            <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                              {rawTaskData?.organization?._id ||
                                rawTaskData?.organization ||
                                currentUser?.organization?._id ||
                                "6a587da815a1ab523d0b9373"}
                            </p>
                          </div>
                        </div>

                        {/* Tags Section */}
                        <div className="pt-5 mt-5 border-t border-slate-100">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-sm bg-blue-50 text-blue-600 flex items-center justify-center">
                                <Tag size={18} />
                              </div>
                              <h3 className="text-base font-bold text-slate-900">
                                Tags
                              </h3>
                            </div>
                            {!isEditingTags &&
                              isTaskEditable &&
                              task.status !== "DONE" && (
                                <div className="flex items-center gap-2">
                                  {isSavingTags && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600">
                                      <Loader
                                        size={11}
                                        className="animate-spin"
                                      />{" "}
                                      Saving...
                                    </span>
                                  )}
                                  <button
                                    onClick={() => {
                                      setEditableTagsList(
                                        Array.isArray(task.tags)
                                          ? [...task.tags]
                                          : [],
                                      );
                                      setTagsInput("");
                                      setIsEditingTags(true);
                                    }}
                                    disabled={isSavingTags}
                                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-200 rounded-sm bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
                                  >
                                    <Pen size={12} className="text-slate-500" />{" "}
                                    Edit
                                  </button>
                                </div>
                              )}
                          </div>

                          {isEditingTags ? (
                            <div className="space-y-3">
                              {/* Removable Chips for Existing & Added Tags */}
                              <div className="flex flex-wrap items-center gap-1.5 min-h-[34px] p-2 bg-slate-50 border border-slate-200 rounded-sm">
                                {editableTagsList &&
                                editableTagsList.length > 0 ? (
                                  editableTagsList.map((tag, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-sm text-xs font-semibold bg-white text-blue-700 border border-blue-200 shadow-2xs"
                                    >
                                      <Tag
                                        size={11}
                                        className="text-blue-500 shrink-0"
                                      />
                                      <span>
                                        {tag.startsWith("#") ? tag : `#${tag}`}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveTag(idx)}
                                        disabled={isSavingTags}
                                        className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors disabled:opacity-50"
                                        title="Remove tag"
                                      >
                                        <X size={12} />
                                      </button>
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-slate-400 italic">
                                    No tags in list
                                  </span>
                                )}
                              </div>

                              {/* Input to Add New / Another Tag */}
                              <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                  <input
                                    type="text"
                                    value={tagsInput}
                                    disabled={isSavingTags}
                                    onChange={(e) =>
                                      setTagsInput(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === ",") {
                                        e.preventDefault();
                                        handleAddTag();
                                      }
                                    }}
                                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-sm focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
                                    placeholder="Type a tag and press Enter or click + Add..."
                                    autoFocus
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAddTag()}
                                  disabled={isSavingTags || !tagsInput.trim()}
                                  className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-sm disabled:opacity-40 transition-colors shrink-0"
                                >
                                  + Add
                                </button>
                              </div>

                              {/* Save and Cancel Buttons */}
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  onClick={handleTagsUpdate}
                                  disabled={isSavingTags}
                                  className="flex items-center gap-1.5 px-3.5 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-sm transition-opacity"
                                >
                                  {isSavingTags && (
                                    <Loader
                                      size={12}
                                      className="animate-spin text-white"
                                    />
                                  )}
                                  <span>
                                    {isSavingTags ? "Saving..." : "Save"}
                                  </span>
                                </button>
                                <button
                                  onClick={() => {
                                    setIsEditingTags(false);
                                    setTagsInput("");
                                    setEditableTagsList(
                                      Array.isArray(task.tags)
                                        ? [...task.tags]
                                        : [],
                                    );
                                  }}
                                  disabled={isSavingTags}
                                  className="px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-sm disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {task.tags && task.tags.length > 0 ? (
                                task.tags.map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100"
                                  >
                                    <Tag size={12} />{" "}
                                    {tag.startsWith("#") ? tag : "#" + tag}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-slate-400 italic">
                                  No tags added
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Related Items and Attachments Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Related Items Card */}
                    <div className="bg-white rounded-sm border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-5">
                          <div className="w-8 h-8 rounded-sm bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Link size={18} />
                          </div>
                          <h3 className="text-base font-bold text-slate-900">
                            Related Items
                          </h3>
                        </div>

                        <div className="space-y-3">
                          <div
                            onClick={() => {
                              if (shouldShowSubtasksTab()) {
                                setActiveTab("subtasks");
                              }
                            }}
                            className={`flex items-center justify-between py-1 border-b border-slate-50 text-xs ${
                              shouldShowSubtasksTab()
                                ? "cursor-pointer hover:bg-slate-50/80 -mx-1 px-1 rounded transition-colors"
                                : ""
                            }`}
                          >
                            <span className="text-slate-600">Subtasks</span>
                            <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-sm font-bold">
                              {task.subtasks?.length ||
                                rawTaskData?.subtasks?.length ||
                                0}
                            </span>
                          </div>
                          <div
                            onClick={() => {
                              if (shouldShowLinkedItemsTab()) {
                                setActiveTab("linked");
                              }
                            }}
                            className={`flex items-center justify-between py-1 border-b border-slate-50 text-xs ${
                              shouldShowLinkedItemsTab()
                                ? "cursor-pointer hover:bg-slate-50/80 -mx-1 px-1 rounded transition-colors"
                                : ""
                            }`}
                          >
                            <span className="text-slate-600">Linked Tasks</span>
                            <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-sm font-bold">
                              {getLinkedItemsCount()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-slate-50 text-xs">
                            <span className="text-slate-600">Dependencies</span>
                            <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-sm font-bold">
                              {task.dependencies?.length ||
                                rawTaskData?.dependencies?.length ||
                                0}
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-slate-50 text-xs">
                            <span className="text-slate-600">Milestone</span>
                            <span className="text-slate-700 font-semibold">
                              {task.linkedToMilestone ||
                              task.mainTaskType === "milestone" ||
                              task.taskType === "milestone" ||
                              rawTaskData?.linkedToMilestone
                                ? "Yes"
                                : "No"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-1 text-xs">
                            <span className="text-slate-600">
                              Approval Task
                            </span>
                            <span className="text-slate-700 font-semibold">
                              {task.isApprovalTask ||
                              rawTaskData?.isApprovalTask
                                ? "Yes"
                                : "No"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Attachments Card */}
                    <div className="bg-white rounded-sm border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-sm bg-blue-50 text-blue-600 flex items-center justify-center">
                              <Paperclip size={18} />
                            </div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-slate-900">
                                Attachments
                              </h3>
                              {displayAttachments.length > 0 && (
                                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold">
                                  {displayAttachments.length}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => setActiveTab("files")}
                            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 border border-blue-200 bg-white hover:bg-blue-50 px-3 py-1 rounded-sm transition-colors"
                          >
                            <Plus size={14} /> Add Attachment
                          </button>
                        </div>

                        {displayAttachments.length === 0 ? (
                          <div className="py-6 text-center flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-sm bg-slate-50/50">
                            <div className="w-12 h-12 rounded-sm bg-white border border-slate-200 text-slate-400 flex items-center justify-center mb-2 shadow-sm">
                              <FolderArchive size={22} />
                            </div>
                            <p className="text-sm font-semibold text-slate-800">
                              No attachments yet
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              Add files, documents or images to this task.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {displayAttachments.slice(0, 4).map((file, idx) => {
                              const fileName =
                                file.originalName ||
                                file.name ||
                                file.filename ||
                                `Attachment ${idx + 1}`;
                              const ext = fileName.includes(".")
                                ? fileName.split(".").pop()?.toUpperCase()
                                : "FILE";
                              const badgeClass =
                                getAttachmentBadgeColor(fileName);
                              const sizeStr = formatAttachmentSize(
                                file.size || file.fileSize || 0,
                              );

                              return (
                                <div
                                  key={file._id || file.id || idx}
                                  className="flex items-center justify-between p-2 rounded-sm border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60 transition-colors"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                    <div
                                      className={`w-7 h-7 rounded-sm border flex items-center justify-center font-bold text-[9px] shrink-0 ${badgeClass}`}
                                    >
                                      {ext.slice(0, 4)}
                                    </div>
                                    <div className="min-w-0">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleViewAttachment(file)
                                        }
                                        className="text-xs font-medium text-slate-800 hover:text-blue-600 truncate block max-w-[200px] text-left transition-colors"
                                        title={fileName}
                                      >
                                        {fileName}
                                      </button>
                                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                        <span>{sizeStr}</span>
                                        {file.uploadedAt && (
                                          <>
                                            <span>•</span>
                                            <span>
                                              {new Date(
                                                file.uploadedAt,
                                              ).toLocaleDateString("en-GB", {
                                                day: "2-digit",
                                                month: "short",
                                              })}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDownloadAttachment(file)
                                      }
                                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                      title="Download"
                                    >
                                      <Download size={14} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}

                            {displayAttachments.length > 4 && (
                              <button
                                type="button"
                                onClick={() => setActiveTab("files")}
                                className="w-full py-1.5 text-center text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50/40 hover:bg-blue-50 rounded-sm border border-blue-100 transition-colors"
                              >
                                View all {displayAttachments.length} attachments
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Email Task Configuration Card (if applicable) */}
                  {(String(task.taskType || "").toLowerCase() === "email" ||
                    String(task.subtaskType || "").toLowerCase() === "email" ||
                    task.classification === "EMAIL") && (
                    <div className="bg-white rounded-sm border border-purple-200 p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-purple-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-sm bg-purple-100 text-purple-600 flex items-center justify-center">
                            <Mail size={18} />
                          </div>
                          <h3 className="text-base font-bold text-purple-950">
                            Email Task Configuration
                          </h3>
                        </div>
                        {isTaskEditable && (
                          <button
                            onClick={() => {
                              if (isEditingEmailConfig) {
                                handleEmailConfigUpdate(emailConfigInput);
                              } else {
                                setEmailConfigInput(
                                  task.emailConfig || {
                                    subject: task.title || "",
                                    body: task.description || "",
                                    recipients: [
                                      { name: "", email: "", source: "manual" },
                                    ],
                                    variables: [],
                                    attachedFormId: "",
                                    autoComplete: false,
                                  },
                                );
                                setIsEditingEmailConfig(true);
                              }
                            }}
                            className="px-3 py-1 text-xs font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 border border-purple-200 rounded-sm transition-colors"
                          >
                            {isEditingEmailConfig
                              ? "Save Configuration"
                              : "Edit Configuration"}
                          </button>
                        )}
                      </div>
                      {isEditingEmailConfig ? (
                        <div className="space-y-4">
                          <EmailTaskConfig
                            value={emailConfigInput || task.emailConfig || {}}
                            onChange={(newCfg) => setEmailConfigInput(newCfg)}
                            disabled={!isTaskEditable}
                            taskId={task._id || task.id}
                          />
                        </div>
                      ) : (
                        <div className="space-y-3 text-xs">
                          <p className="font-semibold text-slate-700">
                            Subject: {task.emailConfig?.subject || task.title}
                          </p>
                          <div className="bg-slate-50 p-3 rounded-sm border border-slate-200 text-slate-600">
                            {task.emailConfig?.body ? (
                              <SafeHtml html={task.emailConfig.body} />
                            ) : (
                              "No message body set"
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Column (Sidebar) */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Task Details Card */}
                  <div className="bg-white rounded-sm border border-slate-200/80 p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-8 h-8 rounded-sm bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Info size={18} />
                      </div>
                      <h3 className="text-base font-bold text-slate-900">
                        Task Details
                      </h3>
                    </div>

                    <div className="space-y-4">
                      {/* Status */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">
                          Status
                        </span>
                        <div className="relative" ref={statusDropdownRef}>
                          <button
                            onClick={() => {
                              if (
                                task?.status === "DONE" ||
                                task?.status === "CANCELLED" ||
                                validStatusOptions.length === 0
                              ) {
                                showErrorToast(
                                  task?.status === "DONE"
                                    ? "Completed tasks cannot be changed."
                                    : "Cancelled tasks cannot be changed.",
                                );
                                return;
                              }
                              setShowStatusDropdown(!showStatusDropdown);
                            }}
                            disabled={isUpdatingStatus}
                            className="bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-sm px-3 py-1.5 text-xs font-bold uppercase tracking-wide flex items-center justify-between gap-2 min-w-[170px] transition-colors disabled:opacity-75"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{
                                  backgroundColor:
                                    currentStatusObj?.color || "#3b82f6",
                                }}
                              />
                              <span className="truncate">
                                {isUpdatingStatus
                                  ? "Updating..."
                                  : currentStatusObj?.label ||
                                    task.status ||
                                    "OPEN"}
                              </span>
                            </div>
                            {isUpdatingStatus ? (
                              <Loader
                                size={13}
                                className="animate-spin text-blue-600 shrink-0"
                              />
                            ) : (
                              <ChevronDown
                                size={14}
                                className="text-slate-500 shrink-0"
                              />
                            )}
                          </button>
                          {showStatusDropdown && (
                            <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-sm shadow-lg z-30 py-1">
                              {validStatusOptions.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-slate-400 italic">
                                  No transitions available
                                </div>
                              ) : (
                                validStatusOptions.map((st) => (
                                  <button
                                    key={st.code}
                                    onClick={() => {
                                      handleStatusChange(st.code);
                                      setShowStatusDropdown(false);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-slate-50 flex items-center gap-2 text-slate-700 transition-colors"
                                  >
                                    <span
                                      className="w-2 h-2 rounded-full shrink-0"
                                      style={{
                                        backgroundColor: st.color || "#3b82f6",
                                      }}
                                    />
                                    <span className="truncate">
                                      {st.label || st.code}
                                    </span>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Priority */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">
                          Priority
                        </span>
                        <div className="relative" ref={priorityDropdownRef}>
                          <button
                            onClick={() => {
                              if (!isTaskEditable) {
                                showErrorToast(
                                  isProcessStepTask
                                    ? `Task priority cannot be changed while status is ${task?.status}. Editing is only allowed when status is OPEN.`
                                    : `Task is already ${task?.status}. Priority cannot be changed.`,
                                );
                                return;
                              }
                              setShowPriorityDropdown(!showPriorityDropdown);
                            }}
                            disabled={isUpdatingPriority}
                            className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-sm px-3 py-1.5 text-xs font-semibold capitalize flex items-center justify-between gap-2 min-w-[170px] transition-colors disabled:opacity-75"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <BarChart2
                                size={14}
                                style={{
                                  color: currentPriorityObj?.color || "#10B981",
                                }}
                                className="shrink-0"
                              />
                              <span className="truncate">
                                {isUpdatingPriority
                                  ? "Updating..."
                                  : currentPriorityObj?.label ||
                                    task.priority ||
                                    "Low"}
                              </span>
                            </div>
                            {isUpdatingPriority ? (
                              <Loader
                                size={13}
                                className="animate-spin text-blue-600 shrink-0"
                              />
                            ) : (
                              <ChevronDown
                                size={14}
                                className="text-slate-400 shrink-0"
                              />
                            )}
                          </button>
                          {showPriorityDropdown && (
                            <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-sm shadow-lg z-30 py-1">
                              {priorityOptions.map((pr) => (
                                <button
                                  key={pr.value}
                                  onClick={() => {
                                    handlePriorityChange(pr.value);
                                    setShowPriorityDropdown(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 text-xs font-semibold capitalize hover:bg-slate-50 flex items-center gap-2 transition-colors ${
                                    String(
                                      task?.priority || "",
                                    ).toLowerCase() === pr.value.toLowerCase()
                                      ? "bg-slate-50 text-slate-900 font-bold"
                                      : "text-slate-700"
                                  }`}
                                >
                                  <BarChart2
                                    size={13}
                                    style={{ color: pr.color || "#10B981" }}
                                    className="shrink-0"
                                  />
                                  <span className="truncate">{pr.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Task Type */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">
                          Task Type
                        </span>
                        <div className="bg-slate-50 text-slate-700 border border-slate-200 rounded-sm px-3 py-1.5 text-xs font-semibold capitalize flex items-center justify-between gap-2 min-w-[170px]">
                          <div className="flex items-center gap-2">
                            <List size={14} className="text-slate-500" />
                            <span>{task.taskType || "Regular"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Task Mode */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">
                          Task Mode
                        </span>
                        <div className="bg-[#f8fafc] text-slate-700 border border-slate-200 rounded-sm px-3 py-1.5 text-xs font-medium flex items-center gap-2 min-w-[170px]">
                          <Settings size={14} className="text-slate-500" />
                          <span>{task.taskMode || "Simple"}</span>
                        </div>
                      </div>

                      {/* Visibility */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">
                          Visibility
                        </span>
                        <div className="bg-[#f8fafc] text-slate-700 border border-slate-200 rounded-sm px-3 py-1.5 text-xs font-medium flex items-center gap-2 min-w-[170px]">
                          <Lock size={13} className="text-slate-500" />
                          <span>{task.visibility || "Private"}</span>
                        </div>
                      </div>

                      {/* Created At */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-medium text-slate-500">
                          Created At
                        </span>
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                          <Calendar size={14} className="text-slate-400" />
                          <span>
                            {formatDateTimeCustom(
                              task.createdAt || rawTaskData?.createdAt,
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Updated At */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">
                          Updated At
                        </span>
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                          <Clock size={14} className="text-slate-400" />
                          <span>
                            {formatDateTimeCustom(
                              task.updatedAt || rawTaskData?.updatedAt,
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Due Date */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">
                          Due Date
                        </span>
                        {isEditingDueDate ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="datetime-local"
                              value={dueDateInput}
                              disabled={isSavingDueDate}
                              min={new Date().toISOString().slice(0, 16)}
                              onChange={(e) => setDueDateInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleDueDateUpdate();
                                if (e.key === "Escape") {
                                  setIsEditingDueDate(false);
                                  setDueDateInput("");
                                }
                              }}
                              autoFocus
                              className="px-2 py-1 text-xs border border-blue-400 rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white disabled:opacity-50"
                            />
                            <button
                              type="button"
                              onClick={handleDueDateUpdate}
                              disabled={isSavingDueDate}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-sm transition-colors disabled:opacity-50"
                              title="Save due date"
                            >
                              {isSavingDueDate ? (
                                <Loader
                                  size={14}
                                  className="animate-spin text-emerald-600"
                                />
                              ) : (
                                <Check size={14} />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsEditingDueDate(false);
                                setDueDateInput("");
                              }}
                              disabled={isSavingDueDate}
                              className="p-1 text-slate-400 hover:bg-slate-100 rounded-sm transition-colors disabled:opacity-50"
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {isSavingDueDate && (
                              <Loader
                                size={13}
                                className="animate-spin text-blue-600 shrink-0"
                              />
                            )}
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-800">
                              <Calendar
                                size={14}
                                className="text-rose-500 shrink-0"
                              />
                              <span>
                                {formatDateTimeCustom(
                                  task.dueDate || rawTaskData?.dueDate,
                                )}
                              </span>
                            </div>
                            {renderDueDateBadge(
                              task.dueDate || rawTaskData?.dueDate,
                            )}
                            {isTaskEditable &&
                              task.status !== "DONE" &&
                              task.status !== "CANCELLED" &&
                              !task.isRecurring && (
                                <button
                                  type="button"
                                  disabled={isSavingDueDate}
                                  onClick={() => {
                                    const rawDate = rawTaskData?.dueDate
                                      ? rawTaskData.dueDate.slice(0, 16)
                                      : task?.dueDate
                                        ? new Date(task.dueDate)
                                            .toISOString()
                                            .slice(0, 16)
                                        : new Date().toISOString().slice(0, 16);
                                    setDueDateInput(rawDate);
                                    setIsEditingDueDate(true);
                                  }}
                                  className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-sm transition-colors disabled:opacity-50"
                                  title="Edit due date"
                                >
                                  <Pen size={12} />
                                </button>
                              )}
                          </div>
                        )}
                      </div>

                      {/* Time Estimate */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">
                          Time Estimate
                        </span>
                        {isEditingTimeEstimate ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              disabled={isSavingTimeEstimate}
                              value={timeEstimateInput}
                              placeholder="0"
                              onChange={(e) =>
                                setTimeEstimateInput(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  handleTimeEstimateUpdate();
                                if (e.key === "Escape") {
                                  setIsEditingTimeEstimate(false);
                                  setTimeEstimateInput(
                                    task.timeEstimate?.toString() || "",
                                  );
                                }
                              }}
                              autoFocus
                              className="w-16 px-2 py-1 text-xs border border-blue-400 rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white disabled:opacity-50"
                            />
                            <span className="text-xs text-slate-500 font-medium">
                              hrs
                            </span>
                            <button
                              type="button"
                              onClick={handleTimeEstimateUpdate}
                              disabled={isSavingTimeEstimate}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-sm transition-colors disabled:opacity-50"
                              title="Save estimate"
                            >
                              {isSavingTimeEstimate ? (
                                <Loader
                                  size={14}
                                  className="animate-spin text-emerald-600"
                                />
                              ) : (
                                <Check size={14} />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsEditingTimeEstimate(false);
                                setTimeEstimateInput(
                                  task.timeEstimate?.toString() || "",
                                );
                              }}
                              disabled={isSavingTimeEstimate}
                              className="p-1 text-slate-400 hover:bg-slate-100 rounded-sm transition-colors disabled:opacity-50"
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {isSavingTimeEstimate && (
                              <Loader
                                size={13}
                                className="animate-spin text-blue-600 shrink-0"
                              />
                            )}
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                              <Clock
                                size={14}
                                className="text-slate-400 shrink-0"
                              />
                              <span>
                                {task.timeEstimate
                                  ? `${task.timeEstimate} hrs`
                                  : "Not specified hrs"}
                              </span>
                            </div>
                            {task.status !== "DONE" &&
                              task.status !== "CANCELLED" && (
                                <button
                                  type="button"
                                  disabled={isSavingTimeEstimate}
                                  onClick={() => {
                                    setTimeEstimateInput(
                                      task.timeEstimate
                                        ? task.timeEstimate.toString()
                                        : "",
                                    );
                                    setIsEditingTimeEstimate(true);
                                  }}
                                  className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-sm transition-colors disabled:opacity-50"
                                  title="Edit time estimate"
                                >
                                  <Pen size={12} />
                                </button>
                              )}
                          </div>
                        )}
                      </div>

                      {/* Recurring */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">
                          Recurring
                        </span>
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                          <RotateCcw size={14} className="text-slate-400" />
                          <span>{task.isRecurring ? "Yes" : "No"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Activity Timeline Card */}
                  <div className="bg-white rounded-sm border border-slate-200/80 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-sm bg-blue-50 text-blue-600 flex items-center justify-center">
                          <SlidersHorizontal size={18} />
                        </div>
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <span>Activity Timeline</span>
                          {activitiesLoading &&
                            timelineActivities.length > 0 && (
                              <Loader className="w-3.5 h-3.5 animate-spin text-blue-600" />
                            )}
                        </h3>
                      </div>

                      {/* Filter Dropdown */}
                      <div className="relative" ref={activityFilterDropdownRef}>
                        <button
                          type="button"
                          onClick={() =>
                            setShowActivityFilterDropdown(
                              !showActivityFilterDropdown,
                            )
                          }
                          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200 rounded-sm bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors"
                        >
                          <span>
                            {activityFilterOptions.find(
                              (o) => o.value === activityFilter,
                            )?.label || "All Activity"}
                          </span>
                          <ChevronDown size={13} className="text-slate-400" />
                        </button>
                        {showActivityFilterDropdown && (
                          <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-sm shadow-lg z-30 py-1">
                            {activityFilterOptions.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  setActivityFilter(opt.value);
                                  setShowActivityFilterDropdown(false);
                                }}
                                className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center justify-between ${
                                  activityFilter === opt.value
                                    ? "bg-blue-50 text-blue-700 font-semibold"
                                    : "text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                <span>{opt.label}</span>
                                {activityFilter === opt.value && (
                                  <Check size={12} className="text-blue-600" />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="relative pl-6 space-y-4 max-h-[290px] overflow-y-auto pr-2 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]">
                      {/* Connecting line */}
                      <div className="absolute left-2.5 top-3 bottom-2 w-0.5 bg-slate-100"></div>

                      {activitiesLoading && timelineActivities.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                          <Loader className="w-3.5 h-3.5 animate-spin text-blue-600" />
                          <span>Loading activities...</span>
                        </div>
                      ) : timelineActivities.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400">
                          No activities found for this filter
                        </div>
                      ) : (
                        <>
                          {timelineActivities.map((activity, idx) => {
                            const config = getActivityConfig(activity);
                            const userName =
                              activity.user?.name ||
                              (typeof activity.user === "string"
                                ? activity.user
                                : null) ||
                              activity.user?.email ||
                              task?.createdBy ||
                              "";

                            return (
                              <div
                                key={activity.id || idx}
                                className="relative flex items-start gap-3"
                              >
                                <div
                                  className={`w-5 h-5 rounded-full ${config.badgeBg} flex items-center justify-center shrink-0 -ml-6 border-2 border-white shadow-sm mt-0.5`}
                                >
                                  {config.icon}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-bold text-slate-800 truncate">
                                      {config.title}
                                    </p>
                                    <span className="text-[10px] text-slate-400 shrink-0">
                                      {formatDateTimeCustom(
                                        activity.timestamp ||
                                          activity.createdAt,
                                      )}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-0.5 break-words">
                                    {activity.description}
                                  </p>
                                  {userName && (
                                    <div className="flex items-center gap-2 mt-2">
                                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                                        {getInitials(userName)}
                                      </div>
                                      <span className="text-xs font-semibold text-slate-700 truncate">
                                        {userName}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          <div className="pt-2 text-center">
                            <span className="text-xs text-slate-400">
                              No more activities
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                        <span className="detail-value">
                          {task.timeEstimate}
                        </span>
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
                          {task.collaborators &&
                          task.collaborators.length > 0 ? (
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
                            <span className="detail-value">
                              No collaborators
                            </span>
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
                  if (
                    rawTaskData?.subtasks &&
                    rawTaskData.subtasks.length > 0
                  ) {
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
                            formVersion?.snapshot_data?.title ||
                            "Untitled Form",
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
                                      style={{
                                        fontSize: "11px",
                                        color: "#666",
                                      }}
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
                <h3>
                  Activity Feed
                  <p className="mt-2 text-lg text-gray-600">
                    Track all task activities and changes
                  </p>
                </h3>
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
                {activitiesLoading && activities.length === 0 && (
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

                {!activitiesError && activities.length > 0 && (
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
            <TaskAttachments
              taskId={taskId}
              task={task}
              onAttachmentsChange={fetchAttachments}
            />
          )}

          {activeTab === "linked" && (
            <LinkedTasksTab
              task={task}
              taskId={taskId}
              rawTaskData={rawTaskData}
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
      </div>

      {/* Modals */}
      <SubtaskForm
        isOpen={showCreateSubtaskDrawer}
        onClose={() => setShowCreateSubtaskDrawer(false)}
        onSubmit={handleCreateSubtask}
        parentTask={task}
        mode="create"
        refreshTask={fetchTaskData}
        isOrgUser={isOrgUserRole(
          activeRole || currentUser?.role || "individual",
        )}
      />

      {showCancelModal && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-sm shadow-xl overflow-hidden max-w-md w-full border border-gray-200 animate-in fade-in zoom-in-95 duration-200 flex flex-col font-sans">
            {/* Header */}
            <div className="px-6 pt-3.5 pb-2.5 border-b border-gray-200 bg-gray-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                <span
                  className="text-xl font-normal"
                  style={{ color: "#676a6c" }}
                >
                  Cancel Task
                </span>
              </div>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 transition-colors w-6 h-6 flex items-center justify-center text-base"
                onClick={() => setShowCancelModal(false)}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-3.5 bg-white">
              <p className="text-xs text-gray-500 font-normal">
                Are you sure you want to cancel this task? Please provide a
                reason below.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                  Reason for cancellation{" "}
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Provide cancellation reason..."
                  className="w-full p-2.5 border border-gray-300 rounded-sm text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[90px] resize-none bg-white text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason("");
                }}
                className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium h-8 px-4 rounded-sm !h-8"
                style={{ height: "32px", minHeight: "32px" }}
              >
                Go Back
              </Button>
              <Button
                type="button"
                onClick={() => {
                  handleCancelTask(cancelReason);
                  setShowCancelModal(false);
                  setCancelReason("");
                }}
                disabled={!cancelReason.trim()}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium h-8 px-4 rounded-sm shadow-sm disabled:opacity-50 !h-8"
                style={{ height: "32px", minHeight: "32px" }}
              >
                Confirm Cancel
              </Button>
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
              setTask((prev) => ({
                ...prev,
                status: "DONE",
                progress: 100,
                completedDate: new Date().toISOString(),
              }));

              // Close modal
              setShowDoneModal(false);

              // Invalidate caches
              queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
              queryClient.invalidateQueries({
                queryKey: [`/api/tasks/${taskIdToComplete}`],
              });
              queryClient.invalidateQueries({ queryKey: ["tasks"] });
              queryClient.invalidateQueries({ queryKey: ["regular-tasks"] });

              // Refresh task data and activities
              await fetchTaskData(false);
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
            } else if (error.message) {
              errorMessage = error.message;
            }

            showErrorToast(errorMessage);
          }
        }}
        task={task}
      />

      {/* Link Item Modal - Moved to LinkedTasksTab component */}

      {showEditModal && (
        <TaskEditModal
          task={rawTaskData || task}
          onSave={() => {
            setShowEditModal(false);
            queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
            queryClient.invalidateQueries({
              queryKey: [`/api/tasks/${taskId}`],
            });
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["regular-tasks"] });
            fetchTaskData(false);
            fetchActivities();
          }}
          onClose={() => setShowEditModal(false)}
          permissions={commentPermissions}
        />
      )}

      <UpgradeRequiredModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        featureName="Subtask"
      />
    </div>
  );
}

// LinkedTasksTab Component
function LinkedTasksTab({ task, taskId, rawTaskData, onRefresh, currentUser }) {
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

  // Fetch linked tasks when component mounts or task changes
  useEffect(() => {
    fetchLinkedTasks();
  }, [task, taskId, rawTaskData]);

  const fetchLinkedTasks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = localStorage.getItem("token");

      const t = rawTaskData || task;
      const rawDirectLinked =
        t?.contextTaskId ||
        t?.contextTask ||
        t?.context_task_id ||
        t?.linkedTaskId ||
        t?.linkedToMilestone;

      // If rawDirectLinked is already a populated object with details
      if (
        rawDirectLinked &&
        typeof rawDirectLinked === "object" &&
        (rawDirectLinked.title || rawDirectLinked.name)
      ) {
        setLinkedTasks([rawDirectLinked]);
        setIsLoading(false);
        return;
      }

      const directLinkedId =
        typeof rawDirectLinked === "object" && rawDirectLinked !== null
          ? String(rawDirectLinked._id || rawDirectLinked.id || "")
          : String(rawDirectLinked || "");

      // If task has a direct contextTaskId/linkedTaskId/linkedToMilestone and is not a milestone master
      if (
        directLinkedId &&
        t?.taskType !== "milestone" &&
        t?.taskType !== "Milestone" &&
        !t?.isMilestone
      ) {
        try {
          const res = await axios.get(
            `/api/tasks/${directLinkedId}?forApproval=true`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          const fetchedItem = res.data?.data || res.data;
          if (fetchedItem && (fetchedItem._id || fetchedItem.id)) {
            setLinkedTasks([fetchedItem]);
            setIsLoading(false);
            return;
          }
        } catch (err) {
          console.log("Direct linked task fetch fallback:", err);
        }

        // Fallback for embedded process subtasks: fetch parent task subtasks
        const parentId = t?.parentTaskId || t?.parentTask?._id || t?.parentTask;
        const parentIdStr =
          typeof parentId === "object" ? parentId._id || parentId.id : parentId;
        if (parentIdStr) {
          try {
            const parentRes = await axios.get(
              `/api/tasks/${parentIdStr}?forApproval=true`,
              {
                headers: { Authorization: `Bearer ${token}` },
              },
            );
            const parentDoc = parentRes.data?.data || parentRes.data;
            if (parentDoc && Array.isArray(parentDoc.subtasks)) {
              const matchedSubtask = parentDoc.subtasks.find(
                (st) => String(st._id || st.id || "") === directLinkedId,
              );
              if (matchedSubtask) {
                setLinkedTasks([matchedSubtask]);
                setIsLoading(false);
                return;
              }
            }
          } catch (parentErr) {
            console.log("Parent task subtasks fetch fallback:", parentErr);
          }
        }
      }

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
          <p className="text-gray-500 text-sm font-medium">
            Loading linked tasks...
          </p>
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
            style={{
              textAlign: "center",
              padding: "40px",
              color: "#6b7280",
              borderRadius: "0.125rem",
            }}
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
