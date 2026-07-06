import React, { useMemo, useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import CustomEditor from "../components/common/CustomEditor";
import "quill/dist/quill.snow.css";
import "../styles/quill-custom.css";
import Select from "react-select";
import AssigneeSearchSelect from "../components/common/AssigneeSearchSelect";
import { apiClient } from "../utils/apiClient";
import { Button } from "@/components/ui/button";
import { Star, Calendar, Users, Info, AlertCircle } from "lucide-react";
import { useUserSearch } from "../hooks/useUserSearch";
import { useTaskPriorities } from "@/hooks/useTaskPriorities";

const toDatetimeLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getCurrentDateTime = () => toDatetimeLocal(new Date());

const formatDateToUserFriendly = (dateStr) => {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const day = date.getDate();
    const months = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  } catch (e) {
    return "";
  }
};

const MilestoneTaskForm = ({
  user,
  onSubmit,
  isOrgUser,
  existingTasks = [], // Tasks available for linking
  collaboratorOptions = [], // Collaborators from parent component
  isLoadingCollaborators = false, // Loading state from parent
  isLoadingTasks = false, // Loading state for tasks
  drawer = false,
  isSubmitting = false,
}) => {
  const [taskNameLength, setTaskNameLength] = useState(0);

  // Use collaborators from props or fallback to local state
  const [localCollaboratorsList, setLocalCollaboratorsList] = useState([]);
  const [localIsLoadingCollaborators, setLocalIsLoadingCollaborators] =
    useState(false);

  // Determine which collaborators list to use
  const collaboratorsList =
    collaboratorOptions.length > 0
      ? collaboratorOptions
      : localCollaboratorsList;
  const isCollaboratorsLoading =
    collaboratorOptions.length > 0
      ? isLoadingCollaborators
      : localIsLoadingCollaborators;

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      taskName: "",
      description: "",
      isMilestone: true,
      milestoneType: "standalone",
      linkedTasks: [],
      dueDate: getCurrentDateTime(),
      assignedTo: isOrgUser
        ? null
        : { value: "self", label: user?.name || "Self" },
      priority: { value: "medium", label: "Medium" },
      visibility: "private",
      collaborators: [],
      status: "OPEN",
    },
  });

  const watchedTaskName = watch("taskName");
  const watchedMilestoneType = watch("milestoneType");
  const watchedLinkedTasks = watch("linkedTasks");
  const watchedPriority = watch("priority");

  const { data: taskPriorities = [] } = useTaskPriorities();

  const priorityOptions = useMemo(() => {
    const dynamic = (Array.isArray(taskPriorities) ? taskPriorities : [])
      .filter((p) => p && p.active)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((p) => ({ value: p.code, label: p.label }));

    return dynamic.length
      ? dynamic
      : [
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" },
          { value: "critical", label: "Critical" },
        ];
  }, [taskPriorities]);

  useEffect(() => {
    setTaskNameLength(watchedTaskName?.length || 0);
  }, [watchedTaskName]);

  // Auto-set due date based on priority (only for standalone milestones)
  useEffect(() => {
    if (watchedMilestoneType !== "linked" && watchedPriority?.value) {
      const today = new Date();
      const code = String(watchedPriority.value || "").toLowerCase();
      const cfg = (Array.isArray(taskPriorities) ? taskPriorities : []).find(
        (p) => p && p.code === code,
      );
      const daysToAdd = Number.isFinite(Number(cfg?.daysToDue))
        ? Number(cfg.daysToDue)
        : code === "critical"
          ? 2
          : code === "high"
            ? 7
            : code === "low"
              ? 30
              : 14;

      const dueDate = new Date(today);
      dueDate.setDate(today.getDate() + daysToAdd);
      setValue("dueDate", toDatetimeLocal(dueDate));
    }
  }, [watchedPriority, watchedMilestoneType, setValue, taskPriorities]);

  // Fetch collaborators list (fallback if not provided by parent)
  const fetchCollaborators = async () => {
    // Only fetch if not provided by parent component
    if (collaboratorOptions.length > 0) return;

    try {
      setLocalIsLoadingCollaborators(true);
      const response = await apiClient.get("/api/auth/collaborators");

      if (response.data.success) {
        const formattedCollaborators = response.data.data.map(
          (collaborator) => {
            const rolesStr = Array.isArray(collaborator.role)
              ? collaborator.role.join(", ")
              : collaborator.role;
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
        setLocalCollaboratorsList(formattedCollaborators);
      }
    } catch (error) {
      console.error("Error fetching collaborators:", error);
      setLocalCollaboratorsList([]);
    } finally {
      setLocalIsLoadingCollaborators(false);
    }
  };

  // Fetch collaborators when component mounts (only if not provided by parent)
  useEffect(() => {
    if (collaboratorOptions.length === 0) {
      fetchCollaborators();
    }
  }, [collaboratorOptions]);

  // Assignment options (for org users) - Build from collaboratorOptions
  const { assignmentOptions, isLoading, handleInputChange, loadInitialUsers } =
    useUserSearch(isOrgUser, user);

  // Load initial users for assignment
  useEffect(() => {
    loadInitialUsers();
  }, [loadInitialUsers]);

  // Debug logging
  console.log("MilestoneTaskForm - Assignment Debug:", {
    isOrgUser,
    collaboratorOptionsCount: collaboratorsList.length,
    collaboratorsList,
    assignmentOptions,
    isCollaboratorsLoading,
  });

  // Filter tasks to exclude milestones for linking
  const availableTasksForLinking = existingTasks.filter(
    (task) => task.taskType !== "milestone" && task.id !== "current", // Prevent self-linking
  );

  // Memoize dropdown options to prevent re-renders
  const dropdownOptions = useMemo(() => {
    const options = [];
    availableTasksForLinking.forEach((task) => {
      // Get due date with fallback
      const taskDueDate = task.dueDate || task.due_date;
      // Get created date with fallback
      const taskCreatedAt = task.createdAt || task.created_at;
      // Resolve task type with proper fallback
      const resolvedType = task.taskType || task.mainTaskType || "Task";
      const capitalizedType =
        resolvedType.charAt(0).toUpperCase() + resolvedType.slice(1);

      // Add parent task
      options.push({
        value: task.id,
        label: `📌 ${task.name} (${capitalizedType})`,
        dueDate: taskDueDate,
        createdAt: taskCreatedAt,
        title: task.name,
        taskType: capitalizedType,
        isParent: true,
        isDisabled: false,
      });

      // Add subtasks under parent (if exists)
      if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach((subtask) => {
          // Get subtask due date with fallback
          const subtaskDueDate = subtask.dueDate || subtask.due_date;
          const subtaskCreatedAt = subtask.createdAt || subtask.created_at;

          options.push({
            value: subtask._id,
            label: `    └─ 📋 ${subtask.title} (Subtask)`,
            dueDate: subtaskDueDate,
            createdAt: subtaskCreatedAt,
            title: subtask.title,
            taskType: "Subtask",
            isSubtask: true,
            parentId: task.id,
            isDisabled: false,
          });
        });
      }
    });

    console.log(
      "✅ [DROPDOWN] Total options (tasks + subtasks):",
      options.length,
    );
    return options;
  }, [availableTasksForLinking]);

  // Calculate latest due date from linked tasks
  const getLatestDueDate = (linkedTasks) => {
    if (!linkedTasks || linkedTasks.length === 0) {
      console.log(
        "📅 [getLatestDueDate] No linked tasks provided, returning today",
      );
      return getCurrentDateTime();
    }

    console.log("📅 [getLatestDueDate] Processing linked tasks:", {
      count: linkedTasks.length,
      tasksData: linkedTasks.map((t) => ({
        label: t.label || t.title,
        dueDate: t.dueDate,
        hasDueDate: !!t.dueDate,
      })),
    });

    // Extract due dates from linked tasks
    // Handle both direct dueDate and nested dueDate properties
    const dueDates = linkedTasks
      .map((task) => {
        // Try multiple ways to get the due date
        const date = task.dueDate || task.due_date;
        if (!date) {
          console.warn(
            "⚠️  [getLatestDueDate] Task missing due date:",
            task.label || task.title,
          );
          return null;
        }
        try {
          return {
            dueDate: new Date(date),
            dateStr: toDatetimeLocal(new Date(date)),
            label: task.label || task.title,
          };
        } catch (e) {
          console.error(
            "❌ [getLatestDueDate] Invalid date format:",
            date,
            e.message,
          );
          return null;
        }
      })
      .filter((item) => item !== null)
      .sort((a, b) => b.dueDate - a.dueDate);

    console.log("📅 [getLatestDueDate] Extracted and sorted dates:", {
      count: dueDates.length,
      dates: dueDates.map((d) => ({ label: d.label, dateStr: d.dateStr })),
    });

    if (dueDates.length > 0) {
      const latestDate = dueDates[0].dateStr;
      console.log(
        "📅 [getLatestDueDate] Latest due date selected:",
        latestDate,
      );
      return latestDate;
    }

    console.log("📅 [getLatestDueDate] No valid dates found, returning today");
    return getCurrentDateTime();
  };

  // Update due date when linked tasks change (ONLY for ACTIVE/NOT COMPLETED milestones)
  useEffect(() => {
    if (watchedMilestoneType === "linked" && watchedLinkedTasks?.length > 0) {
      console.log("📅 [MILESTONE USEEFFECT] Triggering due date calculation:", {
        milestoneType: watchedMilestoneType,
        linkedTasksCount: watchedLinkedTasks.length,
      });

      // For active (not completed) linked milestones, auto-calculate due date from linked tasks
      const latestDate = getLatestDueDate(watchedLinkedTasks);

      console.log("📅 [MILESTONE USEEFFECT] Setting dueDate to:", latestDate);
      setValue("dueDate", latestDate, { shouldValidate: true });
      console.log(
        "📅 [MILESTONE] Auto-calculated due date from linked tasks:",
        latestDate,
      );
    }
  }, [watchedLinkedTasks, watchedMilestoneType, setValue]);

  // Safety net: Ensure due date is set for linked milestones with a slight delay
  useEffect(() => {
    const delayTimer = setTimeout(() => {
      if (watchedMilestoneType === "linked" && watchedLinkedTasks?.length > 0) {
        // Check if dueDate is empty
        const currentDueDate = watch("dueDate");

        if (!currentDueDate || currentDueDate.trim() === "") {
          console.warn(
            "⚠️  [SAFETY NET] Due date is empty for linked milestone, recalculating...",
          );
          const latestDate = getLatestDueDate(watchedLinkedTasks);
          console.log("📅 [SAFETY NET] Setting dueDate to:", latestDate);
          setValue("dueDate", latestDate, { shouldValidate: true });
        } else {
          console.log("✅ [SAFETY NET] Due date is set:", currentDueDate);
        }
      }
    }, 100); // Small delay to ensure all updates are processed

    return () => clearTimeout(delayTimer);
  }, [watchedLinkedTasks, watchedMilestoneType, watch, setValue]);

  // Quill editor configuration (handled by CustomEditor component)

  const onFormSubmit = (data) => {
    console.log("📝 [FORM SUBMIT] Form data received:", {
      milestoneType: data.milestoneType,
      hasLinkedTasks: data.linkedTasks && data.linkedTasks.length > 0,
      linkedTasksCount: data.linkedTasks?.length || 0,
      dueDate: data.dueDate,
      hasDueDate: !!data.dueDate,
      linkedTasksData: data.linkedTasks?.map((t) => ({
        value: t.value,
        label: t.label,
        dueDate: t.dueDate,
      })),
    });

    // Extra validation for linked milestones - ensure due date is set
    if (
      data.milestoneType === "linked" &&
      (!data.dueDate || data.dueDate.trim() === "")
    ) {
      console.error("❌ [FORM SUBMIT] Linked milestone missing due date!");
      // Trigger manual due date calculation as fallback
      if (data.linkedTasks && data.linkedTasks.length > 0) {
        console.log("🔄 [FORM SUBMIT] Attempting to recalculate due date...");
        const calculatedDate = getLatestDueDate(data.linkedTasks);
        console.log("📅 [FORM SUBMIT] Calculated date:", calculatedDate);
        if (calculatedDate) {
          data.dueDate = calculatedDate;
        }
      }
    }

    // Map form data to milestone API schema
    const formData = {
      title: data.taskName, // Map taskName to title
      description: data.description || "",
      assignedTo:
        data.assignedTo?.value || data.assignedTo?.id || data.assignedTo,
      priority: String(
        data.priority?.value ||
          data.priority?.label ||
          data.priority ||
          "medium",
      )
        .trim()
        .toLowerCase(),
      dueDate: data.dueDate,
      visibility: data.visibility === "public" ? "team" : data.visibility, // Map public to team for backend compatibility
      collaborators: data.collaborators
        ? data.collaborators.map((c) => c.value || c.id || c)
        : [],
      linkedTasks: data.linkedTasks
        ? data.linkedTasks.map((task) => task.value || task.id || task)
        : [],
      milestoneType: data.milestoneType || "standalone",
      taskType: "milestone",
      isMilestone: true,
    };

    console.log("✅ MilestoneTaskForm submitting:", formData);
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-3">
      {/* Header with Milestone Icon */}
      {/* <div className="flex items-center space-x-2 pb-4 border-b border-gray-200">
        <Star className="w-5 h-5 text-yellow-500" />
        <h3 className="text-lg font-semibold text-gray-900">Milestone Task</h3>
        <div className="relative group">
          <Info className="w-4 h-4 text-gray-400 cursor-help" />
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-64 z-10">
            Milestones cannot have subtasks, cannot be recurring, and cannot
            link to other milestones
          </div>
        </div>
      </div> */}

      {/* Milestone Type */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Milestone Type <span className="text-red-500">*</span>
        </label>
        <div className="flex space-x-3">
          <label className="flex items-center">
            <input
              {...register("milestoneType")}
              type="radio"
              value="standalone"
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              data-testid="radio-milestone-standalone"
            />
            <span className="ml-2 text-sm text-gray-900">Standalone</span>
          </label>
          <label className="flex items-center">
            <input
              {...register("milestoneType")}
              type="radio"
              value="linked"
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              data-testid="radio-milestone-linked"
            />
            <span className="ml-2 text-sm text-gray-900">Linked</span>
          </label>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Standalone milestones are independent. Linked milestones depend on
          other tasks.
        </p>
      </div>

      {/* Task Name */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Milestone Name <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            {...register("taskName", {
              required: "Milestone name is required",
              maxLength: {
                value: 100,
                message: "Milestone name cannot exceed 100 characters",
              },
            })}
            type="text"
            maxLength={100}
            className="w-full h-8 min-h-8 box-border px-3 py-0 border border-gray-300 rounded-md text-sm leading-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            placeholder="Enter milestone name..."
            data-testid="input-milestone-name"
            style={{
              height: "32px",
              minHeight: "32px",
              maxHeight: "32px",
              paddingTop: 0,
              paddingBottom: 0,
            }}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
            {taskNameLength}/100
          </div>
        </div>
        {errors.taskName && (
          <p className="text-red-500 text-xs mt-1 flex items-center">
            <AlertCircle className="w-3 h-3 mr-1" />
            {errors.taskName.message}
          </p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Description
        </label>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <CustomEditor
              value={field.value}
              onChange={field.onChange}
              className="milestone-task-compact-editor border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="Describe your milestone..."
            />
          )}
        />
      </div>

      {/* Linked Tasks - Only show if milestone type is 'linked' */}
      {watchedMilestoneType === "linked" && (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Link to Tasks/Sub-tasks <span className="text-red-500">*</span>
          </label>
          <Controller
            name="linkedTasks"
            control={control}
            rules={{
              validate: (value) => {
                if (
                  watchedMilestoneType === "linked" &&
                  (!value || value.length === 0)
                ) {
                  return "Please select at least one task to link";
                }
                return true;
              },
            }}
            render={({ field }) => (
              <Select
                {...field}
                isMulti
                closeMenuOnSelect={false}
                options={dropdownOptions}
                value={dropdownOptions.filter((opt) =>
                  field.value?.some((v) => v.value === opt.value),
                )}
                onChange={(selected) => field.onChange(selected)}
                menuPlacement="auto"
                menuPortalTarget={document.body}
                styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                formatOptionLabel={(option) => {
                  // Color-coded badge based on task type
                  const getBadgeColor = (type) => {
                    switch ((type || "").toLowerCase()) {
                      case "recurring":
                        return "bg-purple-100 text-purple-700";
                      case "subtask":
                        return "bg-green-100 text-green-700";
                      case "regular":
                      default:
                        return "bg-blue-100 text-blue-700";
                    }
                  };
                  const badgeColor = getBadgeColor(option.taskType);
                  const createdStr = option.createdAt ? (
                    <>
                      <span className="text-blue-600"> Created on:</span>{" "}
                      {formatDateToUserFriendly(option.createdAt)}
                    </>
                  ) : (
                    ""
                  );

                  const dueStr = option.dueDate ? (
                    <>
                      , <span className="text-blue-600"> Due Date:</span>{" "}
                      {formatDateToUserFriendly(option.dueDate)}
                    </>
                  ) : (
                    ""
                  );

                  if (option.isSubtask) {
                    return (
                      <div className="flex items-center gap-2 text-gray-700">
                        <span className="ml-4">
                          └─ {option.title}
                          {createdStr}
                          {dueStr}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeColor} uppercase tracking-wide whitespace-nowrap`}
                        >
                          {option.taskType || "Subtask"}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div className="flex items-center gap-2 font-semibold text-gray-900">
                      <span>
                        📌 {option.title}
                        {createdStr}
                        {dueStr}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeColor} uppercase tracking-wide whitespace-nowrap`}
                      >
                        {option.taskType || "Task"}
                      </span>
                    </div>
                  );
                }}
                className="react-select-container h-8-select-dynamic"
                classNamePrefix="react-select"
                placeholder={
                  isLoadingTasks
                    ? "Loading tasks..."
                    : "Search and select tasks or sub-tasks..."
                }
                isLoading={isLoadingTasks}
                isDisabled={isLoadingTasks}
                noOptionsMessage={() => {
                  if (isLoadingTasks) return "Loading...";
                  if (availableTasksForLinking.length === 0)
                    return "No tasks available. Create regular tasks first.";
                  return "No options";
                }}
                data-testid="select-linked-tasks"
                isClearable
                isSearchable
              />
            )}
          />
          <p className="text-xs text-gray-500 mt-1">
            Select tasks or sub-tasks to link to this milestone. Both parent
            tasks and their sub-tasks are available. Due date will default to
            the latest linked task/sub-task date.
          </p>
          {errors.linkedTasks && (
            <p className="text-red-500 text-xs mt-1 flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" />
              {errors.linkedTasks.message}
            </p>
          )}
        </div>
      )}

      <div className={`grid grid-cols-2 gap-3`}>
        {/* Due Date */}
        <div>
          <label className="text-sm font-medium text-gray-900 mb-1 flex items-center">
            <Calendar className="w-4 h-4 mr-1" />
            Due Date <span className="text-red-500">*</span>
          </label>
          <input
            {...register("dueDate", {
              required: "Due date is required",
              validate: (value) => {
                const now = getCurrentDateTime();
                return value >= now || "Due date must be today or later";
              },
            })}
            type="datetime-local"
            min={getCurrentDateTime()}
            disabled={watchedMilestoneType === "linked"}
            className={`w-full h-8 min-h-8 max-h-8 box-border px-3 py-0 text-sm border border-gray-300 rounded-md leading-none transition-colors ${
              watchedMilestoneType === "linked"
                ? "bg-gray-100 cursor-not-allowed opacity-60"
                : "focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            }`}
            data-testid="input-due-date"
            style={{
              height: "32px",
              minHeight: "32px",
              maxHeight: "32px",
              paddingTop: 0,
              paddingBottom: 0,
            }}
          />
          {watchedMilestoneType === "linked" && (
            <p className="text-xs text-gray-500 mt-1">
              ✅ Automatically set to latest due date among linked tasks. This
              field is disabled for linked milestones.
            </p>
          )}
          {errors.dueDate && (
            <p className="text-red-500 text-xs mt-1 flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" />
              {errors.dueDate.message}
            </p>
          )}
        </div>

        {/* Assigned To */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Assigned To <span className="text-red-500">*</span>
          </label>
          <Controller
            name="assignedTo"
            control={control}
            rules={isOrgUser ? { required: "Assignment is required" } : {}}
            render={({ field }) => (
              <AssigneeSearchSelect
                {...field}
                className="react-select-container h-8-select whitespace-nowrap"
                menuPortalTarget={document.body}
                styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                isDisabled={!isOrgUser}
                placeholder={
                  isOrgUser ? "Search and select assignee..." : "Self"
                }
                required={isOrgUser}
                data-testid="select-assigned-to"
              />
            )}
          />
          {/* <p className="text-xs text-gray-500 mt-1">
            Search by name, email, department, or designation
          </p> */}
          {errors.assignedTo && (
            <p className="text-red-500 text-xs mt-1 flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" />
              {errors.assignedTo.message}
            </p>
          )}
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Priority
          </label>
          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                menuPlacement="auto"
                options={priorityOptions}
                className="react-select-container h-8-select"
                classNamePrefix="react-select"
                menuPortalTarget={document.body}
                styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                placeholder="Select priority..."
                data-testid="select-priority"
              />
            )}
          />
        </div>
        {/* Collaborators - Only for Organization Users */}
        {isOrgUser && (
          <div>
            <label className="text-sm font-medium text-gray-900 mb-1 flex items-center">
              <Users className="w-4 h-4 mr-1" />
              Collaborators
            </label>
            <Controller
              name="collaborators"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  menuPlacement="auto"
                  isMulti
                  options={collaboratorsList}
                  className="react-select-container h-8-select"
                  classNamePrefix="react-select"
                  menuPortalTarget={document.body}
                  styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                  placeholder={
                    isCollaboratorsLoading
                      ? "Loading collaborators..."
                      : "Select collaborators..."
                  }
                  isLoading={isCollaboratorsLoading}
                  isDisabled={isCollaboratorsLoading}
                  data-testid="select-collaborators"
                />
              )}
            />
            {/* <p className="text-xs text-gray-500 mt-1">
            Collaborators will be notified when milestone is achieved
          </p> */}
          </div>
        )}
      </div>

      {/* Visibility */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Visibility <span className="text-red-500">*</span>
        </label>
        <div className="flex space-x-3">
          <label className="flex items-center">
            <input
              {...register("visibility")}
              type="radio"
              value="private"
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              data-testid="radio-private"
            />
            <span className="ml-2 text-sm text-gray-900">Private</span>
          </label>
          {isOrgUser && (
            <label className="flex items-center">
              <input
                {...register("visibility")}
                type="radio"
                value="team"
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                data-testid="radio-team"
              />
              <span className="ml-2 text-sm text-gray-900">Team</span>
            </label>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {isOrgUser
            ? "Private: Only you and assignee can view. Team: All team members can view."
            : "Private: Only you can view."}
        </p>
      </div>

      {/* Status Information */}
      {/* <div className="bg-blue-50 border border-blue-200 rounded-sm p-4">
        <div className="flex items-start space-x-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900">
              Status Handling
            </h4>
            <p className="text-xs text-blue-700 mt-1">
              Default status is "Not Started". Milestone cannot be marked as
              achieved until status is "Ready to Mark".
            </p>
          </div>
        </div>
      </div> */}

      {/* Restrictions Information */}
      {/* <div className="bg-amber-50 border border-amber-200 rounded-sm p-4">
        <div className="flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-amber-900">
              Milestone Restrictions
            </h4>
            <ul className="text-xs text-amber-700 mt-1 space-y-1">
              <li>• No subtasks allowed under milestone</li>
              <li>• Cannot link milestone to another milestone</li>
              <li>• Milestone cannot be recurring</li>
            </ul>
          </div>
        </div>
      </div> */}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 mt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => window.history.back()}
          className="h-8 rounded-sm"
          data-testid="button-cancel"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting}
          className="bg-blue-600 hover:bg-blue-700 text-white h-8 rounded-sm"
          data-testid="button-save"
        >
          {isSubmitting ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
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
              Saving...
            </>
          ) : (
            "Save Milestone Task"
          )}
        </Button>
      </div>
    </form>
  );
};

export default MilestoneTaskForm;
