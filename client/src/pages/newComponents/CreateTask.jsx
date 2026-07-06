import React, { useState, useEffect } from "react";
import { useActiveRole } from "../../components/RoleSwitcher";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import {
  FileText,
  RotateCcw,
  Target,
  CheckCircle,
  Settings,
  FlaskConical,
  Rocket,
  Link,
} from "lucide-react";
import RegularTaskForm from "../../forms/RegularTaskForm";
import { RecurringTaskForm } from "../../forms/RecurringTaskForm";
import MilestoneTaskForm from "../../forms/MilestoneTaskForm";
import ApprovalTaskForm from "../../forms/ApprovalTaskForm";
import { useRole } from "../../features/shared/hooks/useRole";
import { useAssignmentOptions } from "../../features/shared/hooks/useAssignmentOptions";
import { useAuth } from "../../features/shared/hooks/useAuth";
import { hasAccess } from "../../utils/auth";
import {
  ApprovalTaskIcon,
  MilestoneTaskIcon,
  RecurringTaskIcon,
  RegularTaskIcon,
} from "../../components/common/TaskIcons";
import { useLocation, useSearch } from "wouter";
import { useShowToast } from "../../utils/ToastMessage";
import { useTaskPriorities } from "@/hooks/useTaskPriorities";
// Import role-based permissions helper
import {
  canCreateTaskType,
  canAssignToOthers as canAssignToOthersUtil,
  getAssignmentScope,
  getAllowedTaskTypes,
  getRestrictionMessage,
  validateTaskCreation,
  getAvailableTaskTypesForUI,
} from "../../utils/taskPermissions";

// ✅ HELPER FUNCTION: Validate and sanitize priority
// Ensures only valid, organization-scoped priorities are accepted
const validateAndSanitizePriority = (priority, validPriorities = []) => {
  if (!priority) return null;

  // Extract value if priority is an object
  let priorityCode = priority;
  if (typeof priority === "object" && priority !== null) {
    priorityCode = priority.value || priority.label || "";
  }

  // Normalize to string and lowercase
  priorityCode = String(priorityCode).toLowerCase().trim();

  if (!priorityCode) return null;

  // Build list of valid codes
  const validCodes = validPriorities
    .filter((p) => p && typeof p === "object" && p.active !== false)
    .map((p) =>
      String(p.code || "")
        .toLowerCase()
        .trim(),
    )
    .filter(Boolean);

  // Check if priority is in valid list
  if (!validCodes.includes(priorityCode)) {
    console.warn("❌ INVALID PRIORITY DETECTED:", {
      requested: priorityCode,
      validOptions: validCodes,
    });
    return null; // Return null for invalid - let fallback handle it
  }

  return priorityCode;
};

const CREATE_TASK_FORM_LABELS = {
  regular: "Regular Form",
  recurring: "Recurring Form",
  milestone: "Milestone Form",
  approval: "Approval Form",
};

export default function CreateTask({
  onClose,
  onSubmit,
  initialTaskType = "regular",
  preFilledDate = null,
  drawer,
}) {
  const { data: taskPriorities = [] } = useTaskPriorities();
  const {
    canCreateMilestones,
    canCreateApprovals,
    role,
    isEmployee,
    isManager,
    isCompanyAdmin,
  } = useRole();
  const {
    availableTaskTypes,
    assignmentOptions,
    canAssignToOthers,
    restrictions,
  } = useAssignmentOptions();
  const { user } = useAuth();
  const { showSuccessToast, showErrorToast } = useShowToast();
  const queryClient = useQueryClient();
  const [selectedTaskType, setSelectedTaskType] = useState(initialTaskType);
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const { activeRole } = useActiveRole();

  // State for prefilled data from Quick Task conversion
  const [prefilledQuickTaskData, setPrefilledQuickTaskData] = useState(null);
  const [formDefaultValues, setFormDefaultValues] = useState({});

  // API states for collaborators and approvers
  const [collaboratorsList, setCollaboratorsList] = useState([]);
  const [approversList, setApproversList] = useState([]);
  const [isLoadingCollaborators, setIsLoadingCollaborators] = useState(false);
  const [isLoadingApprovers, setIsLoadingApprovers] = useState(false);

  // State for existing tasks (for milestone linking)
  const [existingTasks, setExistingTasks] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  // State for form submission loading
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set formDefaultValues from preFilledDate prop
  useEffect(() => {
    if (preFilledDate) {
      setFormDefaultValues((prev) => ({ ...prev, dueDate: preFilledDate }));
    }
  }, [preFilledDate]);

  // Extract query params and check for Quick Task conversion
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const type = searchParams.get("type") || initialTaskType || "regular";
    const quickTaskId = searchParams.get("from_quick_task");

    setSelectedTaskType(type);

    // Check if converting from Quick Task
    if (quickTaskId) {
      const storedData = sessionStorage.getItem("convertingQuickTask");
      console.log("🔍 Checking for Quick Task data, quickTaskId:", quickTaskId);
      console.log("🔍 SessionStorage data:", storedData);

      if (storedData) {
        try {
          const quickTaskData = JSON.parse(storedData);
          console.log("📝 Prefilling from Quick Task:", quickTaskData);
          setPrefilledQuickTaskData(quickTaskData);

          // Capitalize priority properly
          const capitalizedPriority = quickTaskData.priority
            ? quickTaskData.priority.charAt(0).toUpperCase() +
              quickTaskData.priority.slice(1).toLowerCase()
            : "Low";

          // Format due date to YYYY-MM-DDTHH:MM for datetime-local input
          let formattedDueDate = "";
          if (quickTaskData.dueDate) {
            try {
              const date = new Date(quickTaskData.dueDate);
              if (!isNaN(date.getTime())) {
                const pad = (num) => String(num).padStart(2, "0");
                formattedDueDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
                console.log(
                  "📅 Formatted due date:",
                  formattedDueDate,
                  "from",
                  quickTaskData.dueDate,
                );
              }
            } catch (dateError) {
              console.error("❌ Error formatting date:", dateError);
            }
          }

          // Transform Quick Task data to RegularTaskForm format
          const defaultValues = {
            taskName: quickTaskData.title || "",
            description: quickTaskData.notes || quickTaskData.description || "",
            priority: {
              value: capitalizedPriority,
              label: capitalizedPriority,
            },
            dueDate: formattedDueDate,
            tags: quickTaskData.tags || [],
          };

          console.log("📋 Transformed default values:", defaultValues);
          setFormDefaultValues(defaultValues);
        } catch (error) {
          console.error("❌ Error parsing quick task data:", error);
        }
      } else {
        console.log("⚠️ No Quick Task data found in sessionStorage");
      }
    }
  }, [location, search, initialTaskType]);

  // Full page: sidebar encodes task type in the URL — ensure `type` is present for active nav + deep links.
  useEffect(() => {
    if (drawer) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("type")) return;
    const fallback = initialTaskType || "regular";
    params.set("type", fallback);
    setLocation(`/tasks/create?${params.toString()}`, { replace: true });
  }, [drawer, initialTaskType, setLocation]);

  // Fetch collaborators list
  const fetchCollaborators = async () => {
    try {
      setIsLoadingCollaborators(true);
      const token = localStorage.getItem("token");
      const response = await axios.get("/api/auth/collaborators", {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      if (response.data.success) {
        const formattedCollaborators = response.data.data.map(
          (collaborator) => {
            const rolesStr = Array.isArray(collaborator.role) ? collaborator.role.join(", ") : collaborator.role;
            const label = `${collaborator.name} (${collaborator.email || ""}) ${rolesStr || ""}`;
            return {
              value: collaborator.id,
              label,
              name: collaborator.name,
              email: collaborator.email,
              role: collaborator.role,
              department: collaborator.department,
            };
          },
        );
        setCollaboratorsList(formattedCollaborators);
      }
    } catch (error) {
      console.error("Error fetching collaborators:", error);
      setCollaboratorsList([]);
    } finally {
      setIsLoadingCollaborators(false);
    }
  };

  // Fetch approvers list
  const fetchApprovers = async () => {
    try {
      setIsLoadingApprovers(true);
      const token = localStorage.getItem("token");
      const response = await axios.get("/api/auth/approvers", {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      if (response.data.success) {
        const formattedApprovers = response.data.data.map((approver) => {
          const rolesStr = Array.isArray(approver.role) ? approver.role.join(", ") : approver.role;
          const selfStr = approver.isSelf ? " (You)" : "";
          const label = `${approver.name} (${approver.email || ""}) ${rolesStr || ""}${selfStr}`;
          return {
            value: approver.id,
            label,
            name: approver.name,
            email: approver.email,
            role: approver.role,
            department: approver.department,
            isPrimaryAdmin: approver.isPrimaryAdmin,
            isSelf: approver.isSelf,
          };
        });
        setApproversList(formattedApprovers);
      }
    } catch (error) {
      console.error("Error fetching approvers:", error);
      setApproversList([]);
    } finally {
      setIsLoadingApprovers(false);
    }
  };

  // Fetch existing tasks for milestone linking
  const fetchExistingTasks = async () => {
    try {
      setIsLoadingTasks(true);
      const token = localStorage.getItem("token");
      const response = await axios.get("/api/tasks/available-for-linking", {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      console.log("🔍 [FETCH TASKS] Response:", response.data);

      if (
        response.data.success &&
        response.data.data &&
        response.data.data.tasks
      ) {
        // ═════════════════════════════════════════════════════════════
        // MAP TASKS WITH SUBTASKS
        // ═════════════════════════════════════════════════════════════
        const regularTasks = response.data.data.tasks.map((task) => {
          console.log(
            `📌 [FETCH TASKS] Processing parent task: ${task.title}`,
            {
              _id: task._id,
              hasSubtasks: task.hasSubtasks,
              subtaskCount: task.subtaskCount || 0,
            },
          );

          return {
            id: task._id,
            name: task.title,
            taskType: task.taskType,
            dueDate: task.dueDate,
            createdAt: task.createdAt,
            // NEW: Include subtasks array
            subtasks:
              task.subtasks && task.subtasks.length > 0
                ? task.subtasks.map((subtask) => {
                    console.log(
                      `   📋 [FETCH TASKS] Subtask: ${subtask.title}`,
                    );
                    return {
                      _id: subtask._id,
                      title: subtask.title,
                      dueDate: subtask.dueDate,
                      createdAt: subtask.createdAt,
                      status: subtask.status,
                      parentTaskId: subtask.parentTaskId,
                    };
                  })
                : [],
            hasSubtasks: task.hasSubtasks || false,
            subtaskCount: task.subtaskCount || 0,
          };
        });

        console.log(
          "✅ [FETCH TASKS] Available tasks for linking:",
          regularTasks.length,
          "parent tasks with",
          response.data.data.totalSubtasks,
          "subtasks",
        );
        setExistingTasks(regularTasks);
      }
    } catch (error) {
      console.error("❌ [FETCH TASKS] Error fetching tasks:", error);
      setExistingTasks([]);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  // Fetch data when component mounts or when milestone/approval/recurring task is selected
  useEffect(() => {
    if (selectedTaskType === "approval" && canCreateApprovals) {
      fetchCollaborators();
      fetchApprovers();
    } else if (selectedTaskType === "milestone" && canCreateMilestones) {
      fetchCollaborators(); // Fetch collaborators for milestone tasks too
      fetchExistingTasks(); // Fetch existing tasks for linking
    } else if (selectedTaskType === "recurring") {
      fetchCollaborators(); // Fetch collaborators for recurring tasks too
    } else if (selectedTaskType === "regular") {
      fetchCollaborators(); // Fetch collaborators for regular tasks too
    }
  }, [selectedTaskType, canCreateApprovals, canCreateMilestones]);

  // Filter available task types based on role permissions (UPDATED WITH NEW PERMISSION SYSTEM)
  const getAvailableTaskTypes = () => {
    console.log("🔐 ROLE PERMISSIONS DEBUG - Getting available task types");
    console.log("🔐 ROLE PERMISSIONS DEBUG - Current role:", role);
    console.log("🔐 ROLE PERMISSIONS DEBUG - Current activeRole:", activeRole);

    // Use activeRole if available, otherwise use role
    const currentRole = activeRole || role;
    console.log(
      "🔐 ROLE PERMISSIONS DEBUG - Using role for permissions:",
      currentRole,
    );

    // Get all allowed task types for this role
    const allowedTaskTypes = getAllowedTaskTypes(currentRole);
    console.log(
      "🔐 ROLE PERMISSIONS DEBUG - Allowed task types:",
      allowedTaskTypes,
    );

    // Get detailed task type info with permissions
    const availableTaskTypesForUI = getAvailableTaskTypesForUI(currentRole);
    console.log(
      "🔐 ROLE PERMISSIONS DEBUG - Task types with UI metadata:",
      availableTaskTypesForUI,
    );

    // Map to format expected by existing UI
    const taskTypes = [
      {
        id: "regular",
        label: "Regular Task",
        description: "Standard one-time task",
        available: canCreateTaskType(currentRole, "regular"),
        color: "blue",
        icon: FileText,
      },
      {
        id: "recurring",
        label: "Recurring Task",
        description: "Repeats on schedule",
        available: canCreateTaskType(currentRole, "recurring"),
        color: "purple",
        icon: RotateCcw,
        restrictedMessage: getRestrictionMessage(currentRole, "recurring"),
      },
      {
        id: "milestone",
        label: "Milestone",
        description: "Project checkpoint",
        available: canCreateTaskType(currentRole, "milestone"),
        color: "green",
        icon: Target,
        restrictedMessage: getRestrictionMessage(currentRole, "milestone"),
      },
      // Hide Approval Task for individual users
      ...(currentRole !== "individual"
        ? [
            {
              id: "approval",
              label: "Approval Task",
              description: "Requires approval workflow",
              available: canCreateTaskType(currentRole, "approval"),
              color: "amber",
              icon: CheckCircle,
              restrictedMessage: getRestrictionMessage(currentRole, "approval"),
            },
          ]
        : []),
    ];

    console.log(
      "🔐 ROLE PERMISSIONS DEBUG - Final task types with availability:",
      taskTypes,
    );
    return taskTypes;
  };

  const taskTypes = getAvailableTaskTypes();

  // Determine if user can assign to others based on new permission system
  const currentRole = activeRole || role;
  const canUserAssignToOthers = canAssignToOthersUtil(currentRole);
  const assignmentScope = getAssignmentScope(currentRole);

  console.log("🔐 ASSIGNMENT PERMISSIONS DEBUG - Current role:", currentRole);
  console.log(
    "🔐 ASSIGNMENT PERMISSIONS DEBUG - Can assign to others:",
    canUserAssignToOthers,
  );
  console.log(
    "🔐 ASSIGNMENT PERMISSIONS DEBUG - Assignment scope:",
    assignmentScope,
  );

  const commonFormProps = {
    onCancel: onClose,
    isOrgUser: canUserAssignToOthers, // Updated: Use new permission system
    assignmentOptions,
    collaboratorOptions: collaboratorsList,
    isLoadingCollaborators,
    userRole: currentRole, // Updated: Use normalized role
    canAssignToOthers: canUserAssignToOthers, // Updated: Use new permission system
    assignmentScope, // New: Pass assignment scope to forms
  };

  // Helper function to strip HTML tags from description (for plain text fallback only)
  const stripHtmlTags = (html) => {
    if (!html) return "";
    // Create a temporary div element
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  // Updated: Now actually calls the API to create the task
  const handleTaskSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      console.log("🔍 HANDLE TASK SUBMIT DEBUG - Function called");
      console.log(
        "🔍 HANDLE TASK SUBMIT DEBUG - Selected task type:",
        selectedTaskType,
      );
      console.log(
        "🔍 HANDLE TASK SUBMIT DEBUG - Raw data received:",
        JSON.stringify(data, null, 2),
      );
      console.log(
        "🔍 HANDLE TASK SUBMIT DEBUG - Recurrence in data:",
        data.recurrence,
      );
      console.log(
        "🔍 HANDLE TASK SUBMIT DEBUG - RecurrencePattern in data:",
        data.recurrencePattern,
      );

      // Fix assignedTo: must be a user ObjectId string or empty (MUST BE DEFINED FIRST!)
      let assignedTo = data.assignedTo;
      if (assignedTo && typeof assignedTo === "object") {
        assignedTo = assignedTo._id || assignedTo.value || assignedTo.id || "";
      }
      // If assignedTo is "self", use current user's id if available
      if (assignedTo === "self" && user?.id) {
        assignedTo = user.id;
      } else if (assignedTo === "self" && user?._id) {
        assignedTo = user._id;
      }
      // If still not valid ObjectId, set to empty
      if (assignedTo && !/^[a-fA-F0-9]{24}$/.test(assignedTo)) {
        assignedTo = "";
      }

      // 🔐 ROLE-BASED PERMISSION VALIDATION
      console.log(
        "🔐 PERMISSION VALIDATION - Validating task creation permission",
      );
      console.log("🔐 PERMISSION VALIDATION - Current role:", currentRole);
      console.log("🔐 PERMISSION VALIDATION - Task type:", selectedTaskType);

      // Check if user has permission to create this task type
      const isAssigningToOthers =
        assignedTo &&
        assignedTo !== "self" &&
        assignedTo !== user?.id &&
        assignedTo !== user?._id;
      const validation = validateTaskCreation(
        currentRole,
        selectedTaskType,
        isAssigningToOthers,
      );

      console.log("🔐 PERMISSION VALIDATION - Assigned To:", assignedTo);
      console.log(
        "🔐 PERMISSION VALIDATION - Is assigning to others:",
        isAssigningToOthers,
      );
      console.log("🔐 PERMISSION VALIDATION - Validation result:", validation);

      if (!validation.allowed) {
        console.error(
          "🔐 PERMISSION VALIDATION - Task creation not allowed:",
          validation.message,
        );
        showErrorToast(
          validation.message ||
            "You do not have permission to create this task type",
        );
        return;
      }

      console.log(
        "🔐 PERMISSION VALIDATION - Task creation allowed, proceeding...",
      );

      // ✅ STRICT PRIORITY VALIDATION - Use helper function
      let priority = validateAndSanitizePriority(data.priority, taskPriorities);

      if (!priority) {
        // Priority is invalid, use organization default
        const defaultPriority = taskPriorities?.find(
          (p) => p && p.active && p.isDefault,
        );
        priority = defaultPriority?.code || "medium";
        console.log("🔍 PRIORITY - Using default after validation:", priority);
      } else {
        console.log("🔍 PRIORITY - Valid priority accepted:", priority);
      }

      // Fix tags: array of strings
      let tags = data.tags;
      if (Array.isArray(tags)) {
        tags = tags
          .map((t) => (typeof t === "object" ? t.value || t.label || "" : t))
          .filter(Boolean);
      }

      // ✅ Preserve rich text HTML in description (do NOT strip HTML tags)
      let description = data.description || "";
      if (description) {
        description = description.trim();
      }

      // Map taskName to title for backend compatibility
      data.title = data.taskName || data.title;
      delete data.taskName;

      // Convert RecurringTaskForm data format to API format
      if (
        selectedTaskType === "recurring" &&
        data.recurrence &&
        !data.recurrencePattern
      ) {
        console.log(
          "🔄 TRANSFORMING RECURRENCE DATA - Converting recurrence to recurrencePattern",
        );
        console.log(
          "🔄 TRANSFORMING RECURRENCE DATA - Original recurrence:",
          data.recurrence,
        );

        data.recurrencePattern = {
          patternType:
            data.recurrence.patternType?.value || data.recurrence.patternType,
          frequency:
            data.recurrence.patternType?.value || data.recurrence.patternType,
          interval: data.recurrence.repeatEvery || 1,
          repeatEvery: data.recurrence.repeatEvery || 1,
          startDate: data.recurrence.startDate,
          startTime: data.recurrence.dueTime || null,
          endCondition:
            data.recurrence.endCondition?.value ||
            data.recurrence.endCondition ||
            "never",
          endDate: data.recurrence.endDate || null,
          occurrences: data.recurrence.occurrences || null,
          weekdays: data.recurrence.weekdays || [],
          monthDays: data.recurrence.monthDays || [],
          monthlyMode: data.recurrence.monthlyMode || "specific_date",
          specificDate: data.recurrence.specificDate || null,
          monthPosition: data.recurrence.monthPosition || null, // ✅ ADDED
          monthWeekday: data.recurrence.monthWeekday || null, // ✅ ADDED
          yearMonths: data.recurrence.yearMonths || [],
          yearDay: data.recurrence.yearDay || null,
          customDates: data.recurrence.customDates || [],
          anchorField: "startDate",
        };

        console.log(
          "🔄 TRANSFORMING RECURRENCE DATA - Converted recurrencePattern:",
          data.recurrencePattern,
        );
        console.log(
          "🔄 TRANSFORMING RECURRENCE DATA - Start date in converted pattern:",
          data.recurrencePattern.startDate,
        );
      }

      console.log("DEBUG: data.title =", data.title);
      console.log("DEBUG: description (cleaned) =", description);
      console.log("DEBUG: full data =", data);
      console.log(
        "DEBUG: recurrencePattern after transformation =",
        data.recurrencePattern,
      );
      if (!data.title || data.title.trim() === "") {
        showErrorToast("Title is required.");
        return;
      }

      // Auth token
      const token = localStorage.getItem("token");
      let response;

      // Use regular task API for ALL task types including milestone
      const submitData = new FormData();
      submitData.append("title", data.title);
      submitData.append("description", description);
      submitData.append("taskType", selectedTaskType);
      submitData.append("priority", priority || "medium");

      // Fix visibility: backend only accepts "private", "team" (not "public")
      let visibility = data.visibility || "private";
      if (visibility === "public") {
        visibility = "team"; // Map public to team for backend compatibility
      }
      if (!["private", "team"].includes(visibility)) {
        visibility = "private"; // Default to private if invalid
      }
      submitData.append("visibility", visibility);

      if (data.category) submitData.append("category", data.category);
      if (data.dueDate) submitData.append("dueDate", data.dueDate);
      if (data.nextDueDate) submitData.append("nextDueDate", data.nextDueDate);
      if (data.startDate) submitData.append("startDate", data.startDate);
      if (assignedTo) submitData.append("assignedTo", assignedTo);
      if (tags && tags.length > 0)
        submitData.append("tags", JSON.stringify(tags));
      if (data.collaborators && data.collaborators.length > 0)
        submitData.append(
          "collaboratorIds",
          JSON.stringify(data.collaborators.map((c) => c.id || c.value || c)),
        );
      // 🔄 Add contributors for recurring tasks
      if (data.contributors && data.contributors.length > 0) {
        console.log("🔄 Adding contributors to form data:", data.contributors);
        submitData.append(
          "contributorIds",
          JSON.stringify(
            data.contributors.map((c) => c.id || c.value || c._id || c),
          ),
        );
        console.log("✅ Contributors added to FormData");
      }
      if (data.attachments && data.attachments.length > 0) {
        data.attachments.forEach((attachment) => {
          if (attachment.file)
            submitData.append("attachments", attachment.file);
        });
      }

      // Add milestone-specific fields when taskType is milestone
      if (selectedTaskType === "milestone") {
        console.log("🏔️ [MILESTONE CREATION] Processing milestone task");
        console.log("🏔️ [MILESTONE CREATION] Milestone data:", data);

        // Add milestone type (validate enum values)
        const milestoneType = data.milestoneType || "standalone";
        if (!["standalone", "linked", "project"].includes(milestoneType)) {
          console.error(
            "❌ [MILESTONE CREATION] Invalid milestoneType:",
            milestoneType,
          );
          showErrorToast(
            "Invalid milestone type. Must be standalone, linked, or project.",
          );
          return;
        }
        submitData.append("milestoneType", milestoneType);
        console.log("✅ [MILESTONE CREATION] Milestone type:", milestoneType);

        // Add linked tasks for milestone
        if (data.linkedTasks && data.linkedTasks.length > 0) {
          const linkedTaskIds = data.linkedTasks.map(
            (task) => task.value || task.id || task,
          );
          submitData.append("linkedTaskIds", JSON.stringify(linkedTaskIds));
          console.log(
            "✅ [MILESTONE CREATION] Linked task IDs:",
            linkedTaskIds,
          );
        } else {
          // Empty array for standalone milestones
          submitData.append("linkedTaskIds", JSON.stringify([]));
          console.log(
            "📍 [MILESTONE CREATION] No linked tasks (standalone milestone)",
          );
        }

        // Add milestone data object
        const milestoneData = {
          type: milestoneType,
          linkedTaskIds: data.linkedTasks
            ? data.linkedTasks.map((task) => task.value || task.id || task)
            : [],
          deliverables: data.deliverables || [],
          completionCriteria: data.completionCriteria || [],
          stakeholders: data.stakeholders || [],
        };
        submitData.append("milestoneData", JSON.stringify(milestoneData));
        console.log("✅ [MILESTONE CREATION] Milestone data:", milestoneData);
      }

      // Add any extra fields for recurring/approval if needed
      if (selectedTaskType === "recurring" && data.recurrencePattern) {
        console.log("🔍 CREATE TASK DEBUG - Processing recurring task");
        console.log(
          "🔍 CREATE TASK DEBUG - Raw recurrence pattern:",
          data.recurrencePattern,
        );
        console.log(
          "🔍 CREATE TASK DEBUG - Start date in pattern:",
          data.recurrencePattern?.startDate,
        );
        console.log(
          "🔍 CREATE TASK DEBUG - Pattern type:",
          data.recurrencePattern?.patternType,
        );

        // ✅ Normalize weekdays to always be an array
        const normalizedPattern = { ...data.recurrencePattern };
        if (
          normalizedPattern.weekdays &&
          !Array.isArray(normalizedPattern.weekdays)
        ) {
          // Convert single object to array
          normalizedPattern.weekdays = [normalizedPattern.weekdays];
          console.log(
            "🔧 CREATE TASK DEBUG - Converted weekdays to array:",
            normalizedPattern.weekdays,
          );
        }

        submitData.append(
          "recurrencePattern",
          JSON.stringify(normalizedPattern),
        );

        console.log(
          "🔍 CREATE TASK DEBUG - Added to FormData:",
          JSON.stringify(normalizedPattern),
        );
      } else if (selectedTaskType === "recurring") {
        console.log(
          "❌ CREATE TASK DEBUG - Recurring task but NO recurrence pattern found!",
        );
        console.log("❌ CREATE TASK DEBUG - Full data object:", data);
      }

      // Add approval task specific fields
      if (selectedTaskType === "approval") {
        console.log("✅ [APPROVAL TASK] Processing approval task");
        console.log("✅ [APPROVAL TASK] Approval data:", data);

        // Approval mode: "any", "all", or "sequential"
        const approvalMode = data.approvalMode || "any";
        submitData.append("approvalMode", approvalMode);
        console.log("✅ [APPROVAL TASK] Approval mode:", approvalMode);

        // Approver IDs
        if (data.approverIds && data.approverIds.length > 0) {
          submitData.append("approverIds", JSON.stringify(data.approverIds));
          console.log("✅ [APPROVAL TASK] Approver IDs:", data.approverIds);
        } else {
          console.error("❌ [APPROVAL TASK] No approvers provided!");
        }

        // Auto-approval settings
        if (data.autoApproveEnabled) {
          submitData.append("autoApproveEnabled", "true");
          if (data.autoApproveAfter) {
            submitData.append("autoApproveAfter", data.autoApproveAfter);
            console.log(
              "✅ [APPROVAL TASK] Auto-approve after:",
              data.autoApproveAfter,
            );
          }
        } else {
          submitData.append("autoApproveEnabled", "false");
        }

        console.log("✅ [APPROVAL TASK] Complete approval configuration:", {
          approvalMode,
          approverCount: data.approverIds?.length || 0,
          autoApproveEnabled: data.autoApproveEnabled || false,
          autoApproveAfter: data.autoApproveAfter || null,
        });
      }

      // Add the active role to the request
      if (activeRole) {
        submitData.append("createdByRole", activeRole);
      }

      // 🔄 Add Quick Task ID if this is a conversion
      const searchParams = new URLSearchParams(window.location.search);
      const quickTaskId = searchParams.get("from_quick_task");
      if (quickTaskId) {
        console.log("🔄 Adding Quick Task ID to task creation:", quickTaskId);
        submitData.append("quickTaskId", quickTaskId);
      }

      // API call to regular task endpoint for ALL task types
      response = await axios.post("/api/create-task", submitData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      console.log("Task created successfully:", response.data);

      // ✅ Check if this task was converted from a Quick Task
      if (quickTaskId) {
        console.log("🔄 Task created from Quick Task conversion:", quickTaskId);
        console.log(
          "✅ Quick Task should be automatically marked as converted by backend",
        );
        showSuccessToast("Task created from Quick Task");
        // Clean up sessionStorage
        sessionStorage.removeItem("convertingQuickTask");
      } else {
        // Normal task creation without conversion
        showSuccessToast("Task created");
      }
      // 🔔 Invalidate notifications cache to show new notifications immediately
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });

      // Call parent onSubmit if needed
      if (typeof onSubmit === "function") {
        onSubmit({ ...data, taskType: selectedTaskType });
      }
      // Optionally close modal
      if (onClose) onClose();

      // Redirect to the tasks page
      setLocation("/tasks");
    } catch (error) {
      console.error("Error creating task:", error);
      const errorMessage = error.response?.data?.message || error.message;
      showErrorToast(errorMessage || "Unable to create task");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="create-task-page create-task-responsive-ui flex flex-col h-full py-2 sm:py-3 px-3 sm:px-4 lg:px-6 bg-gray-50 z-50 overflow-x-hidden">
      <style>{`
        /* Enforce rounded-sm (0.25rem) for card sections and inputs */
        .create-task-page .bg-white.border,
        .create-task-page .card,
        .create-task-page input:not([type="checkbox"]):not([type="radio"]),
        .create-task-page textarea,
        .create-task-page select,
        .create-task-page button:not(.rounded-full):not([class*="rounded-full"]),
        .create-task-page .react-select__control,
        .create-task-page .react-select__value-container,
        .create-task-page .react-select__menu,
        .create-task-page .ql-toolbar,
        .create-task-page .ql-container,
        .create-task-page [class*="editor"],
        .create-task-page .form-input,
        .create-task-page .form-select,
        .create-task-page .form-textarea,
        .create-task-page [class*="border-dashed"] {
          border-radius: 0.25rem !important;
        }
        .create-task-responsive-ui .create-task-section-title {
          font-size: 1.125rem;
          line-height: 1.4;
        }
        .create-task-responsive-ui .create-task-section-subtitle,
        .create-task-responsive-ui label,
        .create-task-responsive-ui input,
        .create-task-responsive-ui textarea,
        .create-task-responsive-ui select,
        .create-task-responsive-ui button {
          font-size: 0.875rem;
        }
        .create-task-responsive-ui input:not([type="checkbox"]):not([type="radio"]),
        .create-task-responsive-ui textarea,
        .create-task-responsive-ui select {
          border-color: #000 !important;
          transition: border-color 0.2s ease, box-shadow 0.2s ease !important;
        }
        .create-task-responsive-ui input:not([type="checkbox"]):not([type="radio"]):focus,
        .create-task-responsive-ui textarea:focus,
        .create-task-responsive-ui select:focus {
          border-color: #2563eb !important;
          outline: none !important;
          box-shadow: 0 0 0 1px #2563eb !important;
        }
        @media (max-width: 640px) {
          .create-task-responsive-ui .task-type-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      {/* Task type cards: shown in drawer/modals; full page uses sidebar links (Regular / Recurring / Milestone). */}
      {drawer && (
        <div className="bg-white rounded-none p-3 sm:p-4 mb-2 shadow-sm border border-gray-200">
          <div className="mb-3 sm:mb-3">
            <h3 className="create-task-section-title font-semibold text-gray-900">
              Task Type
            </h3>
            <p className="create-task-section-subtitle text-gray-600">
              Choose the type of task you want to create
            </p>
          </div>

          <div
            className={`task-type-grid grid grid-cols-1 sm:grid-cols-2 ${
              !drawer ? "lg:grid-cols-4 " : "lg:grid-cols-2 "
            }  gap-2 sm:gap-3 items-s4tretch`}
          >
            {taskTypes.map((taskType) => {
              const isSelected = selectedTaskType === taskType.id;
              const colorClass =
                taskType.color === "blue"
                  ? "blue"
                  : taskType.color === "purple"
                    ? "purple"
                    : taskType.color === "green"
                      ? "green"
                      : taskType.color === "amber"
                        ? "amber"
                        : "blue";

              const getColorClasses = () => {
                if (!taskType.available) {
                  return {
                    button:
                      "bg-gray-100 border border-gray-300 cursor-not-allowed opacity-60",
                    icon: "bg-gray-400",
                    text: "text-gray-500",
                  };
                }

                const colors = {
                  blue: {
                    button: isSelected
                      ? "bg-blue-50 border border-blue-400"
                      : "bg-white border hover:border-blue-300",
                    icon: "bg-blue-500",
                    text: "text-gray-900",
                  },
                  purple: {
                    button: isSelected
                      ? "bg-purple-50 border border-purple-400"
                      : "bg-white border hover:border-purple-300",
                    icon: "bg-purple-500",
                    text: "text-gray-900",
                  },
                  green: {
                    button: isSelected
                      ? "bg-green-50 border border-green-400"
                      : "bg-white border hover:border-green-300",
                    icon: "bg-green-500",
                    text: "text-gray-900",
                  },
                  amber: {
                    button: isSelected
                      ? "bg-amber-50 border border-amber-400"
                      : "bg-white border hover:border-amber-300",
                    icon: "bg-amber-500",
                    text: "text-gray-900",
                  },
                };
                return colors[colorClass];
              };

              const colorClasses = getColorClasses();

              const getTaskIcon = () => {
                switch (taskType.id) {
                  case "regular":
                    return <RegularTaskIcon size={18} className="text-white" />;
                  case "recurring":
                    return (
                      <RecurringTaskIcon size={18} className="text-white" />
                    );
                  case "milestone":
                    return (
                      <MilestoneTaskIcon size={18} className="text-white" />
                    );
                  case "approval":
                    return (
                      <ApprovalTaskIcon size={18} className="text-white" />
                    );
                  default:
                    return null;
                }
              };

              return (
                <div key={taskType.id} className="relative h-full">
                  <button
                    onClick={() =>
                      taskType.available && setSelectedTaskType(taskType.id)
                    }
                    className={`flex flex-col justify-between h-full p-2 rounded-none transition-all group text-left w-full ${colorClasses.button} min-h-[58px] sm:min-h-[64px]`}
                    data-testid={`task-type-${taskType.id}`}
                    disabled={!taskType.available}
                    title={
                      !taskType.available ? taskType.restrictedMessage : ""
                    }
                  >
                    {/* Top section: Icon + Label */}
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-none ${colorClasses.icon} flex-shrink-0`}
                      >
                        {getTaskIcon()}
                      </div>
                      <h4
                        className={`font-medium text-sm leading-none truncate ${colorClasses.text}`}
                        title={taskType.label}
                      >
                        {taskType.label}
                      </h4>
                    </div>

                    {/* Bottom: Description & restriction */}
                    <div className="mt-1 overflow-hidden">
                      <p
                        className={`text-xs truncate ${
                          taskType.available ? "text-gray-600" : "text-gray-400"
                        }`}
                        title={taskType.description}
                      >
                        {taskType.description}
                      </p>

                      {!taskType.available && (
                        <p
                          className="text-xs text-red-500 mt-1 truncate"
                          title={
                            role === "employee"
                              ? "Employee role restriction"
                              : "Insufficient permissions"
                          }
                        >
                          {role === "employee"
                            ? "Employee role restriction"
                            : "Insufficient permissions"}
                        </p>
                      )}
                    </div>
                  </button>

                  {!taskType.available && (
                    <div className="absolute top-1 right-1">
                      <svg
                        className="w-3.5 h-3.5 text-red-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M13.477 14.89A6 6 0 715.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div>
        <h1 className="text-2xl font-normal m-0" style={{ color: "#676a6c" }}>
          {CREATE_TASK_FORM_LABELS[selectedTaskType] ?? "Task Form"}
        </h1>
      </div>

      {/* Task Details Section */}
      <div className="bg-white rounded-none p-3 sm:p-4 flex-1 shadow-sm border border-gray-200 mt-1">
        <div className="mb-3 sm:mb-3">
          <h3 className="create-task-section-title font-semibold text-gray-900">
            Task Details
          </h3>
          <p className="create-task-section-subtitle text-gray-600">
            Fill in the basic information for your task
          </p>
        </div>

        {/* Task Form Content */}
        {selectedTaskType === "regular" && (
          <RegularTaskForm
            {...commonFormProps}
            onSubmit={handleTaskSubmit}
            onCancel={onClose}
            isOrgUser={canAssignToOthers}
            assignmentOptions={assignmentOptions}
            userRole={role}
            canAssignToOthers={canAssignToOthers}
            drawer={drawer}
            defaultValues={formDefaultValues}
            isSubmitting={isSubmitting}
          />
        )}

        {selectedTaskType === "recurring" && (
          <RecurringTaskForm
            onSubmit={handleTaskSubmit}
            onCancel={onClose}
            isOrgUser={canAssignToOthers}
            assignmentOptions={assignmentOptions}
            userRole={role}
            canAssignToOthers={canAssignToOthers}
            collaboratorOptions={collaboratorsList}
            isLoadingCollaborators={isLoadingCollaborators}
            drawer={drawer}
            isSubmitting={isSubmitting}
          />
        )}

        {selectedTaskType === "milestone" && canCreateMilestones && (
          <MilestoneTaskForm
            onSubmit={handleTaskSubmit}
            onCancel={onClose}
            isOrgUser={canAssignToOthers}
            assignmentOptions={assignmentOptions}
            userRole={role}
            canAssignToOthers={canAssignToOthers}
            user={user}
            collaboratorOptions={collaboratorsList}
            isLoadingCollaborators={isLoadingCollaborators}
            drawer={drawer}
            existingTasks={existingTasks}
            isLoadingTasks={isLoadingTasks}
            isSubmitting={isSubmitting}
          />
        )}

        {selectedTaskType === "approval" && canCreateApprovals && (
          <ApprovalTaskForm
            onSubmit={handleTaskSubmit}
            onCancel={onClose}
            isOrgUser={canAssignToOthers}
            assignmentOptions={assignmentOptions}
            userRole={role}
            canAssignToOthers={canAssignToOthers}
            user={user}
            // Pass API data as props
            approverOptions={approversList}
            collaboratorOptions={collaboratorsList}
            isLoadingApprovers={isLoadingApprovers}
            isLoadingCollaborators={isLoadingCollaborators}
            drawer={drawer}
          />
        )}

        {/* Fallback message for restricted task types */}
        {selectedTaskType === "milestone" && !canCreateMilestones && (
          <div className="text-center py-6 sm:py-8 px-4">
            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-red-100 rounded-none flex items-center justify-center mb-3 sm:mb-3">
              <svg
                className="w-6 h-6 sm:w-8 sm:h-8 text-red-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M13.477 14.89A6 6 0 715.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
              Access Restricted
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-3">
              Only Managers, Organization Admins, and Employees can create
              milestone tasks.
            </p>
            <Button
              variant="primary"
              onClick={() => setSelectedTaskType("regular")}
              className="h-9"
            >
              Create Regular Task Instead
            </Button>
          </div>
        )}

        {selectedTaskType === "approval" && !canCreateApprovals && (
          <div className="text-center py-6 sm:py-8 px-4">
            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-red-100 rounded-none flex items-center justify-center mb-3 sm:mb-3">
              <svg
                className="w-6 h-6 sm:w-8 sm:h-8 text-red-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M13.477 14.89A6 6 0 715.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
              Access Restricted
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-3">
              Only Managers, Organization Admins, and Employees can create
              approval tasks.
            </p>
            <Button
              variant="primary"
              onClick={() => setSelectedTaskType("regular")}
              className="h-9"
            >
              Create Regular Task Instead
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Legacy implementation
function LegacyCreateTask({
  onClose,
  initialTaskType = "regular",
  preFilledDate = null,
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      visibility: "private",
      dueDate: preFilledDate || "",
      assignedTo: "",
      category: "",
      tags: [],
      collaborators: [],
      attachments: [],
    },
  });

  const [taskType, setTaskType] = useState("regular");
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const [contributors, setContributors] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [recurrenceData, setRecurrenceData] = useState(null);
  const [milestoneData, setMilestoneData] = useState(null);
  const [moreOptionsData, setMoreOptionsData] = useState({
    referenceProcess: "",
    customForm: "",
    dependencies: [],
    taskTypeAdvanced: "simple",
  });
  const onSubmit = async (formData) => {
    try {
      console.log("Form submission data:", formData); // Debug log
      const submitData = new FormData();

      // 🔄 Map taskName to title for backend compatibility (recurring tasks use taskName)
      const title = formData.taskName || formData.title;
      console.log(
        "Title being sent:",
        title,
        "from taskName:",
        formData.taskName,
        "from title:",
        formData.title,
      );

      // 🔄 Map priority from object to string value (recurring tasks send { value: "Low", label: "Low" })
      let priority = formData.priority;
      if (priority && typeof priority === "object") {
        priority = priority.value || priority.label || "medium";
      }
      if (typeof priority === "string") {
        priority = priority.toLowerCase();
      }
      console.log("Priority being sent:", priority);

      // Add basic task data
      submitData.append("title", title);
      submitData.append("description", formData.description || "");
      submitData.append("taskType", taskType);
      submitData.append("priority", priority);
      submitData.append("visibility", formData.visibility);
      if (formData.category && formData.category.trim()) {
        submitData.append("category", formData.category);
        console.log("Category being sent:", formData.category); // Debug log
      } else {
        console.log("No category selected or empty category"); // Debug log
      }

      if (formData.dueDate) {
        submitData.append("dueDate", formData.dueDate);
      }
      if (formData.nextDueDate) {
        submitData.append("nextDueDate", formData.nextDueDate);
      }
      if (formData.startDate) {
        submitData.append("startDate", formData.startDate);
      }

      // 🔄 Map assignedTo from object to string value
      let assignedTo = formData.assignedTo;
      if (assignedTo && typeof assignedTo === "object") {
        assignedTo = assignedTo._id || assignedTo.value || assignedTo.id || "";
      }
      if (assignedTo === "self" && user?.id) {
        assignedTo = user.id;
      } else if (assignedTo === "self" && user?._id) {
        assignedTo = user._id;
      }

      if (assignedTo) {
        submitData.append("assignedTo", assignedTo);
      }

      // Add task-specific data based on type
      if (taskType === "recurring") {
        // Transform recurrence data to recurrencePattern format
        let recurrencePattern = recurrenceData || formData.recurrencePattern;

        // If we have recurrence data but not recurrencePattern, transform it
        if (!recurrencePattern && formData.recurrence) {
          console.log(
            "🔄 RECURRENCE - Transforming recurrence to recurrencePattern",
          );
          recurrencePattern = {
            patternType:
              formData.recurrence.patternType?.value ||
              formData.recurrence.patternType,
            frequency:
              formData.recurrence.patternType?.value ||
              formData.recurrence.patternType,
            interval: formData.recurrence.repeatEvery || 1,
            repeatEvery: formData.recurrence.repeatEvery || 1,
            startDate: formData.recurrence.startDate,
            startTime: formData.recurrence.startTime || "09:00",
            endCondition:
              formData.recurrence.endCondition?.value ||
              formData.recurrence.endCondition ||
              "never",
            endDate: formData.recurrence.endDate || null,
            occurrences: formData.recurrence.occurrences || null,
            weekdays: formData.recurrence.weekdays || [],
            monthDays: formData.recurrence.monthDays || [],
            yearMonths: formData.recurrence.yearMonths || null,
            customDates: formData.recurrence.customDates || [],
          };
        }

        if (recurrencePattern) {
          submitData.append(
            "recurrencePattern",
            JSON.stringify(recurrencePattern),
          );
        }
      }

      if (taskType === "milestone" && milestoneData) {
        submitData.append("milestoneData", JSON.stringify(milestoneData));
        submitData.append("milestoneType", milestoneData.type || "standalone");
        if (milestoneData.linkedTaskIds) {
          submitData.append(
            "linkedTaskIds",
            JSON.stringify(milestoneData.linkedTaskIds),
          );
        }
      }

      // Add collaborators
      if (collaborators.length > 0) {
        submitData.append(
          "collaboratorIds",
          JSON.stringify(collaborators.map((c) => c.id)),
        );
      }

      // 🔄 Add contributors for recurring tasks (Section 4.3)
      console.log("🔄 CONTRIBUTORS - Checking formData:", {
        hasContributors: !!formData.contributors,
        contributorsLength: formData.contributors?.length,
        contributorsData: formData.contributors,
      });
      if (formData.contributors && formData.contributors.length > 0) {
        const contributorIds = formData.contributors.map((c) => {
          // Handle both object format { value: id, label: name } and direct id string
          return c.value || c.id || c;
        });
        submitData.append("contributorIds", JSON.stringify(contributorIds));
        console.log("🔄 CONTRIBUTORS - Added to submission:", contributorIds);
      } else {
        console.log("🔄 CONTRIBUTORS - No contributors to add");
      }

      // Add tags
      if (formData.tags && formData.tags.length > 0) {
        submitData.append("tags", JSON.stringify(formData.tags));
      }

      // Always add advanced options data to ensure all settings are saved
      if (moreOptionsData.referenceProcess) {
        submitData.append("referenceProcess", moreOptionsData.referenceProcess);
      }
      if (moreOptionsData.customForm) {
        submitData.append("customForm", moreOptionsData.customForm);
      }
      if (
        moreOptionsData.dependencies &&
        moreOptionsData.dependencies.length > 0
      ) {
        // Ensure dependencies are properly formatted as an array
        const dependencyArray = Array.isArray(moreOptionsData.dependencies)
          ? moreOptionsData.dependencies
          : [moreOptionsData.dependencies];
        submitData.append("dependsOnTaskIds", JSON.stringify(dependencyArray));
        console.log("Dependencies being sent:", dependencyArray); // Debug log
      }
      // Always save the advanced task type - this identifies if it's simple, complex, etc.
      submitData.append(
        "taskTypeAdvanced",
        moreOptionsData.taskTypeAdvanced || "simple",
      );

      // Add the main task type to clearly identify the task category
      submitData.append("mainTaskType", taskType); // This will be "regular", "recurring", "milestone", "approval"

      // Handle file attachments
      if (attachments.length > 0) {
        attachments.forEach((attachment, index) => {
          if (attachment.file) {
            submitData.append("attachments", attachment.file);
          }
        });
      }

      // Get auth token from localStorage
      const token = localStorage.getItem("token");

      await axios.post("/api/create-task", submitData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      console.log("Task created successfully:", response.data);

      // Reset form after successful submission
      reset();
      setAttachments([]);
      setCollaborators([]);
      setContributors([]);
      setRecurrenceData(null);
      setMilestoneData(null);

      if (onClose) onClose();
    } catch (error) {
      console.error("Error creating task:", error);
      showErrorToast(
        "Failed to create task: " +
          (error.response?.data?.message || error.message),
      );
    }
  };

  useEffect(() => {
    const priority = watch("priority");
    if (priority && !watch("isManualDueDate")) {
      const calculatedDueDate = calculateDueDateFromPriority(priority);
      setValue("dueDate", calculatedDueDate);
    }
  }, [watch("priority"), watch("isManualDueDate")]);

  return (
    <>
      <style>{`
        /* Enforce rounded-sm (0.25rem) for card sections and inputs */
        .create-task-page .bg-white.border,
        .create-task-page .card,
        .create-task-page input:not([type="checkbox"]):not([type="radio"]),
        .create-task-page textarea,
        .create-task-page select,
        .create-task-page button:not(.rounded-full):not([class*="rounded-full"]),
        .create-task-page .react-select__control,
        .create-task-page .react-select__value-container,
        .create-task-page .react-select__menu,
        .create-task-page .ql-toolbar,
        .create-task-page .ql-container,
        .create-task-page [class*="editor"],
        .create-task-page .form-input,
        .create-task-page .form-select,
        .create-task-page .form-textarea,
        .create-task-page [class*="border-dashed"] {
          border-radius: 0.25rem !important;
        }
      `}</style>
      <div className="create-task-container create-task-page">
        {/* Task Type Selector */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Task Type</h3>
            <p className="text-gray-600">
              Choose the type of task you want to create
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => setTaskType("modular")}
              className={`p-4 border-2 rounded-none text-left transition-all duration-300 group ${
                taskType === "modular"
                  ? "border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md transform scale-102"
                  : "border-gray-200 hover:border-blue-300 hover:shadow-sm hover:transform hover:scale-101"
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`w-10 h-10 rounded-none flex items-center justify-center transition-all duration-300 ${
                    taskType === "modular"
                      ? "bg-blue-500 text-white"
                      : "bg-blue-100 text-blue-600 group-hover:bg-blue-200"
                  }`}
                >
                  <FileText size={20} className="text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-lg font-semibold text-gray-900 group-hover:text-blue-700">
                    Create Task
                  </h4>
                  <p className="text-sm text-gray-500 group-hover:text-gray-600">
                    Modular task creation with milestone, approval, and
                    recurring options
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Target size={16} className="text-purple-600" />
                      Milestone
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle size={16} className="text-green-600" />
                      Approval
                    </span>
                    <span className="flex items-center gap-1">
                      <RotateCcw size={16} className="text-purple-600" />
                      Recurring
                    </span>
                  </div>
                </div>
              </div>
            </button>
            {/* 
          <button
            onClick={() => setTaskType("recurring")}
            className={`p-3 border-2 rounded-none text-left transition-all duration-300 group ${
              taskType === "recurring"
                ? "border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 shadow-md transform scale-102"
                : "border-gray-200 hover:border-green-300 hover:shadow-sm hover:transform hover:scale-101"
            }`}
          >
            <div className="flex items-center space-x-3">
              <div
                className={`w-8 h-8 rounded-none flex items-center justify-center transition-all duration-300 ${
                  taskType === "recurring"
                    ? "bg-green-500 text-white"
                    : "bg-green-100 text-green-600 group-hover:bg-green-200"
                }`}
              >
                <RotateCcw size={16} className="text-purple-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-gray-900 group-hover:text-green-700">
                  Recurring Task
                </h4>
                <p className="text-xs text-gray-500 group-hover:text-gray-600 truncate" title="Repeats on schedule">
                  Repeats on schedule
                </p>
              </div>
            </div>
          </button> */}
            <button
              onClick={() => setTaskType("milestone")}
              className={`p-3 border-2 rounded-none text-left transition-all duration-300 group ${
                taskType === "milestone"
                  ? "border-purple-500 bg-gradient-to-br from-purple-50 to-violet-50 shadow-md transform scale-102"
                  : "border-gray-200 hover:border-purple-300 hover:shadow-sm hover:transform hover:scale-101"
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`w-8 h-8 rounded-none flex items-center justify-center transition-all duration-300 ${
                    taskType === "milestone"
                      ? "bg-purple-500 text-white"
                      : "bg-purple-100 text-purple-600 group-hover:bg-purple-200"
                  }`}
                >
                  <Target size={16} className="text-red-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-gray-900 group-hover:text-purple-700">
                    Milestone
                  </h4>
                  <p
                    className="text-xs text-gray-500 group-hover:text-gray-600 truncate"
                    title="Project checkpoint"
                  >
                    Project checkpoint
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setTaskType("approval")}
              className={`p-3 border-2 rounded-none text-left transition-all duration-300 group ${
                taskType === "approval"
                  ? "border-emerald-500 bg-gradient-to-br from-emerald-50 to-green-50 shadow-md transform scale-102"
                  : "border-gray-200 hover:border-emerald-300 hover:shadow-sm hover:transform hover:scale-101"
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`w-8 h-8 rounded-none flex items-center justify-center transition-all duration-300 ${
                    taskType === "approval"
                      ? "bg-emerald-500 text-white"
                      : "bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200"
                  }`}
                >
                  <CheckCircle size={16} className="text-amber-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-gray-900 group-hover:text-emerald-700">
                    Approval Task
                  </h4>
                  <p
                    className="text-xs text-gray-500 group-hover:text-gray-600 truncate"
                    title="Requires approval"
                  >
                    Requires approval
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Modular Task Form */}
        {taskType === "modular" && (
          <TaskForm
            onSubmit={(formData) => {
              // Convert TaskForm data format to match existing API
              onSubmit({
                title: formData.title,
                description: formData.description,
                assignedTo: formData.assignee,
                priority: formData.priority,
                visibility: formData.visibility,
                dueDate: formData.dueDate,
                category: formData.category || "general",
                tags: formData.tags || [],
                taskType: formData.taskType,
                milestone: formData.milestone,
                approval: formData.approval,
                recurring: formData.recurring,
                advanced: formData.advanced,
                collaborators: formData.collaborators || [],
                attachments: formData.attachments || [],
              });
            }}
            onSaveDraft={(formData) => {
              console.log("Saving draft:", formData);
            }}
            onClose={onClose}
            initialData={{
              dueDate: preFilledDate || "",
            }}
          />
        )}

        {/* Legacy Regular Task Form */}
        {taskType === "regular" && (
          <RegularTaskForm
            onSubmit={(formData) => {
              console.log("Regular task created from Legacy:", formData);
              // The `onSubmit` here is the one from LegacyCreateTask's scope.
              onSubmit(formData);
            }}
            onClose={onClose}
            initialData={{
              dueDate: preFilledDate || "",
            }}
          />
        )}

        {/* Recurring Task Form */}
        {taskType === "recurring" && (
          <RecurringTaskForm
            onSubmit={(formData) => {
              // Convert RecurringTaskForm data format to match existing API
              console.log(
                "🔄 RECURRING FORM WRAPPER - Form data received:",
                formData,
              );
              console.log(
                "🔄 RECURRING FORM WRAPPER - Contributors in form data:",
                formData.contributors,
              );
              onSubmit(formData);
            }}
            onClose={onClose}
            isOrgUser={canAssignToOthers}
            assignmentOptions={assignmentOptions}
            userRole={role}
            canAssignToOthers={canAssignToOthers}
            collaboratorOptions={collaboratorsList}
            isLoadingCollaborators={isLoadingCollaborators}
            drawer={drawer}
            initialData={{
              startDate: preFilledDate || "",
            }}
          />
        )}

        {/* Milestone Task Form */}
        {taskType === "milestone" && (
          <form className=" bg-white p-4 rounded-none card max-w-4xl mx-auto mt-3">
            {/* Main Form Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-1 gap-1">
              {/* Left Column */}
              <div className="space-y-2">
                <div className="">
                  <div className="flex gap-3">
                    <svg
                      className="w-4 h-4 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                    <label
                      htmlFor="taskName"
                      className=" flex items-center gap-2 text-gray-700 font-medium text-sm"
                    >
                      Milestone Title*
                    </label>
                  </div>
                  <input
                    type="text"
                    id="taskName"
                    placeholder="Enter milestone title"
                    maxLength={100}
                    className="form-input w-full h-9 px-3 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-none p-4">
                  <label
                    htmlFor="isMilestone"
                    className="flex items-start space-x-3 cursor-pointer"
                  >
                    <div className="flex items-center h-5">
                      <input
                        type="checkbox"
                        id="isMilestone"
                        defaultChecked={true}
                        className="w-4 h-4 rounded-none border-2 border-amber-400 text-amber-600 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-amber-800">
                        Milestone Toggle*
                      </span>
                      <p className="text-xs text-amber-600 mt-1">
                        Required to mark this task as a milestone
                      </p>
                    </div>
                  </label>
                </div>

                <div className="">
                  <div className="flex gap-3">
                    <svg
                      className="w-4 h-4 text-purple-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                    <label
                      htmlFor="milestoneType"
                      className="form-label flex items-center gap-2 text-gray-700 font-medium text-sm"
                    >
                      Milestone Type
                    </label>
                  </div>
                  <select
                    id="milestoneType"
                    className="form-select w-full h-9 px-3 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-700"
                  >
                    <option value="standalone">🎯 Standalone Milestone</option>
                    <option value="linked">🔗 Linked to Tasks</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="">
                    <div className="flex gap-3">
                      <svg
                        className="w-4 h-4 text-red-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <label
                        htmlFor="dueDate"
                        className="form-label flex items-center gap-2 text-gray-700 font-medium text-sm"
                      >
                        Due Date*
                      </label>
                    </div>
                    <input
                      type="date"
                      id="dueDate"
                      className="form-input w-full h-9 px-3 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>

                  <div className="">
                    <div className="flex gap-3">
                      <svg
                        className="w-4 h-4 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      <label
                        htmlFor="assignedTo"
                        className="form-label flex items-center gap-2 text-gray-700 font-medium text-sm"
                      >
                        Assigned To
                      </label>
                    </div>
                    <select
                      id="assignedTo"
                      className="form-select w-full h-9 px-3 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-700"
                    >
                      <option value="">Select Assignee</option>
                      <option value="Current User">👤 Current User</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-2">
                <div className="">
                  <div className="flex gap-2">
                    <svg
                      className="w-4 h-4 text-indigo-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                      />
                    </svg>
                    <label
                      htmlFor="linkedTasks"
                      className="form-label flex items-center gap-2 text-gray-700 font-medium text-sm"
                    >
                      Link to Tasks
                    </label>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-100 rounded-none p-4">
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {[
                        "UI Design Complete",
                        "Backend API Development",
                        "Testing Phase",
                        "Deployment",
                      ].map((task, i) => (
                        <div
                          key={i}
                          className="flex items-center space-x-3 p-2 bg-white rounded-none border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded-none focus:ring-indigo-500"
                          />
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-${
                                ["green", "blue", "purple", "orange"][i]
                              }-600`}
                            >
                              {
                                [
                                  <CheckCircle
                                    size={16}
                                    className="text-green-600"
                                  />,
                                  <Settings
                                    size={16}
                                    className="text-blue-600"
                                  />,
                                  <FlaskConical
                                    size={16}
                                    className="text-purple-600"
                                  />,
                                  <Rocket size={16} className="text-red-600" />,
                                ][i]
                              }
                            </span>
                            <span className="text-sm text-gray-700">
                              {task}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-indigo-600 mt-2 flex items-start gap-1">
                      <svg
                        className="w-3 h-3 mt-0.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Select tasks to monitor for this milestone
                    </p>
                  </div>
                </div>

                <div className="">
                  <div className="flex gap-3">
                    <svg
                      className="w-4 h-4 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h7"
                      />
                    </svg>
                    <label
                      htmlFor="description"
                      className="form-label flex items-center gap-2 text-gray-700 font-medium text-sm"
                    >
                      Description
                    </label>
                  </div>
                  <textarea
                    id="description"
                    placeholder="Describe the milestone..."
                    rows="4"
                    className="form-textarea w-full px-3 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="">
                    <div className="flex gap-3">
                      <svg
                        className="w-4 h-4 text-yellow-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                      <label
                        htmlFor="visibility"
                        className="form-label flex items-center gap-2 text-gray-700 font-medium text-sm"
                      >
                        Visibility
                      </label>
                    </div>
                    <select
                      id="visibility"
                      className="form-select w-full h-9 px-3 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-gray-700"
                    >
                      <option value="private">🔒 Private</option>
                      <option value="public">👥 Public</option>
                    </select>
                  </div>

                  <div className="">
                    <div className="flex gap-3">
                      <svg
                        className="w-4 h-4 text-orange-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <label
                        htmlFor="priority"
                        className="form-label flex items-center gap-2 text-gray-700 font-medium text-sm"
                      >
                        Priority
                      </label>
                    </div>
                    <select
                      id="priority"
                      className="form-select w-full h-9 px-3 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-700"
                    >
                      <option value="low">🟢 Low</option>
                      <option value="medium" selected>
                        🟡 Medium
                      </option>
                      <option value="high">🟠 High</option>
                      <option value="critical">🔴 Critical</option>
                    </select>
                  </div>
                </div>

                <div className="">
                  <div className="flex gap-2">
                    <svg
                      className="w-4 h-4 text-teal-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <label
                      htmlFor="collaborators"
                      className="form-label flex items-center gap-2 text-gray-700 font-medium text-sm"
                    >
                      Collaborators
                    </label>
                  </div>
                  <div className="bg-teal-50 border border-teal-100 rounded-none p-4">
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {[
                        {
                          initials: "CU",
                          name: "Current User",
                          email: "current@company.com",
                          color: "teal",
                        },
                      ].map((person, i) => (
                        <div
                          key={i}
                          className="flex items-center space-x-3 p-2 bg-white rounded-none border border-gray-200 hover:border-teal-300 hover:bg-teal-50 transition-colors cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-teal-600 border-gray-300 rounded-none focus:ring-teal-500"
                          />
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-7 h-7 rounded-none bg-${person.color}-500 flex items-center justify-center text-white text-xs font-bold`}
                            >
                              {person.initials}
                            </div>
                            <div>
                              <span className="text-sm text-gray-700">
                                {person.name}
                              </span>
                              <p className="text-xs text-gray-500">
                                {person.email}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-teal-600 mt-2 flex items-start gap-1">
                      <svg
                        className="w-3 h-3 mt-0.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Optional - for updates & comments visibility
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 mt-2 pt-3 border-t border-gray-200">
              <Button type="button" variant="outline" className="h-9">
                <svg
                  className="w-4 h-4 mr-1 inline-block"
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
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="h-9 flex items-center gap-1"
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Create Milestone
              </Button>
            </div>
          </form>
        )}

        {/* More Options Modal */}
        {showMoreOptions && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm bg-opacity-50 flex items-center justify-center z-50 p-4 overlay-animate">
            <div className="bg-white rounded-none shadow-xl max-w-2xl w-full max-h-[98vh] overflow-y-auto modal-animate-slide-right">
              <MoreOptionsModal
                data={moreOptionsData}
                onChange={(field, value) =>
                  setMoreOptionsData((prev) => ({ ...prev, [field]: value }))
                }
                onClose={() => setShowMoreOptions(false)}
                onSave={() => setShowMoreOptions(false)}
              />
            </div>
          </div>
        )}

        {/* Approval Task Form */}
        {taskType === "approval" && (
          <ApprovalTaskForm
            formData={{
              title: "",
              description: "",
              dueDate: preFilledDate || "",
              collaborators: [],
              approval: {
                approvers: [],
                approvalMode: "any_one",
                approverOrder: [],
                autoApproval: false,
                autoApprovalDays: 0,
              },
            }}
            setFormData={(formData) => {
              // Handle form data updates if needed
            }}
            onSaveDraft={(formData) => {
              // Handle draft saving if needed
              console.log("Saving approval task draft:", formData);
            }}
            onCancel={onClose}
          />
        )}
      </div>
    </>
  );
}

function MoreOptionsModal({ data, onChange, onClose, onSave }) {
  const [searchTerms, setSearchTerms] = useState({
    process: "",
    form: "",
    dependencies: "",
  });

  // Data - should ideally come from API
  const referenceProcesses = [];
  const customForms = [];
  const existingTasks = [];

  const filteredProcesses = referenceProcesses.filter((process) =>
    process.name.toLowerCase().includes(searchTerms.process.toLowerCase()),
  );

  const filteredForms = customForms.filter((form) =>
    form.name.toLowerCase().includes(searchTerms.form.toLowerCase()),
  );

  const filteredTasks = existingTasks.filter((task) =>
    task.name.toLowerCase().includes(searchTerms.dependencies.toLowerCase()),
  );

  const handleDependencyToggle = (taskId) => {
    const currentDeps = data.dependencies || [];
    const newDeps = currentDeps.includes(taskId)
      ? currentDeps.filter((id) => id !== taskId)
      : [...currentDeps, taskId];
    onChange("dependencies", newDeps);
  };

  const handleSave = () => {
    // In real app, would validate and save data
    onSave();
  };

  return (
    <>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">More Options</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </Button>
        </div>
        <p className="text-gray-600 mt-1">Configure advanced task settings</p>
      </div>

      <div className="p-4 space-y-3">
        {/* Reference Process */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reference Process
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search for a process..."
              value={searchTerms.process}
              onChange={(e) =>
                setSearchTerms((prev) => ({ ...prev, process: e.target.value }))
              }
              className="form-input mb-2"
            />
            <select
              value={data.referenceProcess}
              onChange={(e) => onChange("referenceProcess", e.target.value)}
              className="form-select"
            >
              <option value="">Select a process...</option>
              {filteredProcesses.map((process) => (
                <option key={process.id} value={process.id}>
                  {process.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Link this task to an existing process (e.g., SOP or workflow)
          </p>
        </div>

        {/* Custom Form */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Custom Form
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search for a form..."
              value={searchTerms.form}
              onChange={(e) =>
                setSearchTerms((prev) => ({ ...prev, form: e.target.value }))
              }
              className="form-input mb-2"
            />
            <select
              value={data.customForm}
              onChange={(e) => onChange("customForm", e.target.value)}
              className="form-select"
            >
              <option value="">Select a form...</option>
              {filteredForms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Choose a predefined form to collect data for this task
          </p>
        </div>

        {/* Dependencies */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dependencies
          </label>
          <input
            type="text"
            placeholder="Search for tasks..."
            value={searchTerms.dependencies}
            onChange={(e) =>
              setSearchTerms((prev) => ({
                ...prev,
                dependencies: e.target.value,
              }))
            }
            className="form-input mb-2"
          />
          <div className="border border-gray-300 rounded-none max-h-40 overflow-y-auto">
            {filteredTasks.map((task) => (
              <label
                key={task.id}
                className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={data.dependencies?.includes(task.id) || false}
                  onChange={() => handleDependencyToggle(task.id)}
                  className="mr-3 rounded-none border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-900">{task.name}</span>
              </label>
            ))}
            {filteredTasks.length === 0 && (
              <div className="p-3 text-sm text-gray-500 text-center">
                No tasks found
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Select existing tasks that must be completed before this one starts
          </p>
        </div>

        {/* Task Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Task Type *
          </label>
          <select
            value={data.taskTypeAdvanced}
            onChange={(e) => onChange("taskTypeAdvanced", e.target.value)}
            className="form-select"
            required
          >
            <option value="simple">Simple</option>
            <option value="recurring">Recurring</option>
            <option value="approval">Approval</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Determines the task behavior
          </p>
        </div>
      </div>

      {/* Modal Actions */}
      <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row gap-3 sm:justify-end">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" variant="primary" onClick={handleSave}>
          Save Options
        </Button>
      </div>
    </>
  );
}
