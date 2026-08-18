import React, { useMemo, useState, useEffect, useRef } from "react";
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

const MilestoneSubtaskForm = ({
  user,
  onSubmit,
  onCancel,
  isOrgUser,
  parentTask = null,
  editData = null,
  collaboratorOptions = [],
  isLoadingCollaborators = false,
  isSubmitting = false,
}) => {
  const [taskNameLength, setTaskNameLength] = useState(0);
  const [localCollaboratorsList, setLocalCollaboratorsList] = useState([]);
  const [localIsLoadingCollaborators, setLocalIsLoadingCollaborators] =
    useState(false);

  const [localAvailableTasks, setLocalAvailableTasks] = useState([]);
  const [localIsLoadingTasks, setLocalIsLoadingTasks] = useState(false);
  const hasFetchedTasksRef = useRef(false);

  useEffect(() => {
    const fetchTasksForLinking = async () => {
      if (hasFetchedTasksRef.current) return;
      hasFetchedTasksRef.current = true;

      try {
        setLocalIsLoadingTasks(true);

        const parentTaskId = parentTask?._id || parentTask?.id;
        if (parentTaskId) {
          const response = await apiClient.get(
            `/api/tasks/${parentTaskId}/subtasks`,
          );

          let subtasksList = [];
          if (response.data?.success && Array.isArray(response.data?.data)) {
            subtasksList = response.data.data;
          } else if (
            response.data?.success &&
            Array.isArray(response.data?.subtasks)
          ) {
            subtasksList = response.data.subtasks;
          } else if (Array.isArray(response.data)) {
            subtasksList = response.data;
          }

          const existingSubtasks =
            parentTask.subtasks || parentTask.subTasks || [];
          const combinedSubtasksMap = new Map();

          [...existingSubtasks, ...subtasksList].forEach((st) => {
            if (!st) return;
            const stId = st._id || st.id;
            if (stId && st.taskType !== "milestone") {
              combinedSubtasksMap.set(String(stId), {
                ...st,
                _id: stId,
                title: st.title || st.name,
              });
            }
          });

          const parentObj = {
            id: parentTaskId,
            _id: parentTaskId,
            name: parentTask.title || parentTask.name || "Parent Task",
            title: parentTask.title || parentTask.name || "Parent Task",
            taskType: parentTask.taskType || "regular",
            subtasks: Array.from(combinedSubtasksMap.values()),
          };

          setLocalAvailableTasks([parentObj]);
        }
      } catch (error) {
        console.error(
          "Error fetching subtasks for linking in MilestoneSubtaskForm:",
          error,
        );
        if (parentTask) {
          const parentTaskId = parentTask._id || parentTask.id;
          const existingSubtasks =
            parentTask.subtasks || parentTask.subTasks || [];
          setLocalAvailableTasks([
            {
              id: parentTaskId,
              _id: parentTaskId,
              name: parentTask.title || parentTask.name || "Parent Task",
              title: parentTask.title || parentTask.name || "Parent Task",
              taskType: parentTask.taskType || "regular",
              subtasks: existingSubtasks.map((st) => ({
                ...st,
                _id: st._id || st.id,
                title: st.title || st.name,
              })),
            },
          ]);
        }
      } finally {
        setLocalIsLoadingTasks(false);
      }
    };

    fetchTasksForLinking();
  }, [parentTask]);

  const collaboratorsList =
    collaboratorOptions.length > 0
      ? collaboratorOptions
      : localCollaboratorsList;

  const isCollaboratorsLoading =
    collaboratorOptions.length > 0
      ? isLoadingCollaborators
      : localIsLoadingCollaborators;

  const availableTasksForLinking = localAvailableTasks.filter(
    (task) =>
      task &&
      task.taskType !== "milestone" &&
      (task.id || task._id) !== "current",
  );

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      taskName: editData?.title || editData?.taskName || "",
      description: editData?.description || "",
      dueDate: editData?.dueDate
        ? new Date(editData.dueDate).toISOString().slice(0, 16)
        : getCurrentDateTime(),
      milestoneType: editData?.milestoneType || "standalone",
      linkedTasks: editData?.linkedTasks || [],
      autoDueDate: editData?.autoDueDate !== undefined ? editData.autoDueDate : true,
      priority: editData?.priority
        ? {
            value: typeof editData.priority === "object" ? editData.priority.value : editData.priority,
            label: typeof editData.priority === "object" ? editData.priority.label : String(editData.priority).toUpperCase(),
          }
        : { value: "medium", label: "Medium" },
      assignedTo: editData?.assignedTo || (isOrgUser ? null : { value: "self", label: user?.name || "Self" }),
      visibility: editData?.visibility || "private",
      collaborators: editData?.collaborators || [],
      status: editData?.status || "OPEN",
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

  const hasFetchedCollaboratorsRef = useRef(false);

  const fetchCollaborators = async () => {
    if (
      !isOrgUser ||
      collaboratorOptions.length > 0 ||
      hasFetchedCollaboratorsRef.current
    )
      return;
    hasFetchedCollaboratorsRef.current = true;

    try {
      setLocalIsLoadingCollaborators(true);
      const response = await apiClient.get("/api/auth/collaborators");

      if (response.data.success && Array.isArray(response.data.data)) {
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

  useEffect(() => {
    if (
      isOrgUser &&
      collaboratorOptions.length === 0 &&
      !hasFetchedCollaboratorsRef.current
    ) {
      fetchCollaborators();
    }
  }, [isOrgUser, collaboratorOptions.length]);

  const { assignmentOptions, isLoading, handleInputChange, loadInitialUsers } =
    useUserSearch(isOrgUser, user);

  useEffect(() => {
    loadInitialUsers();
  }, []);

  const dropdownOptions = useMemo(() => {
    const options = [];
    availableTasksForLinking.forEach((task) => {
      const subtasksList = task.subtasks || task.subTasks || [];

      if (subtasksList.length > 0) {
        subtasksList.forEach((subtask) => {
          if (!subtask) return;

          const status = String(subtask.status || "").toLowerCase();
          const approvalStatus = String(
            subtask.approvalStatus || "",
          ).toLowerCase();
          const isFinished =
            status === "completed" ||
            status === "done" ||
            status === "rejected" ||
            status === "cancelled" ||
            status === "canceled" ||
            status === "approved" ||
            approvalStatus === "approved" ||
            approvalStatus === "rejected";

          if (isFinished) return;

          const subtaskDueDate = subtask.dueDate || subtask.due_date;
          const subtaskCreatedAt = subtask.createdAt || subtask.created_at;
          const subtaskTitle = subtask.title || subtask.name;
          const subtaskId = subtask._id || subtask.id;

          if (subtaskTitle && subtaskId && subtask.taskType !== "milestone") {
            options.push({
              value: subtaskId,
              label: `📋 ${subtaskTitle} (Subtask)`,
              dueDate: subtaskDueDate,
              createdAt: subtaskCreatedAt,
              title: subtaskTitle,
              taskType: "Subtask",
              isSubtask: true,
              parentId: task.id || task._id,
              isDisabled: false,
            });
          }
        });
      }
    });

    return options;
  }, [availableTasksForLinking]);

  const getLatestDueDate = (linkedTasks) => {
    if (!linkedTasks || linkedTasks.length === 0) return getCurrentDateTime();

    let latestDate = null;
    linkedTasks.forEach((task) => {
      if (task.dueDate) {
        const taskDate = new Date(task.dueDate);
        if (!latestDate || taskDate > latestDate) {
          latestDate = taskDate;
        }
      }
    });

    return latestDate ? toDatetimeLocal(latestDate) : getCurrentDateTime();
  };

  useEffect(() => {
    if (
      watchedMilestoneType === "linked" &&
      watchedLinkedTasks &&
      watchedLinkedTasks.length > 0
    ) {
      const latestDueDate = getLatestDueDate(watchedLinkedTasks);
      setValue("dueDate", latestDueDate);
    }
  }, [watchedLinkedTasks, watchedMilestoneType, setValue]);

  const onFormSubmit = (data) => {
    const formattedData = {
      title: data.taskName,
      taskName: data.taskName,
      taskType: "milestone",
      mainTaskType:
        parentTask?.mainTaskType || parentTask?.taskType || "regular",
      isMilestone: true,
      milestoneType: data.milestoneType,
      dueDate: data.dueDate,
      priority: data.priority?.value || data.priority || "medium",
      status: data.status || "OPEN",
      visibility: data.visibility || "private",
      assignee: data.assignedTo?.value || data.assignedTo || "self",
      assignedTo: data.assignedTo?.value || data.assignedTo || "self",
      collaborators: data.collaborators?.map((c) => c.value) || [],
      linkedTasks:
        data.milestoneType === "linked"
          ? data.linkedTasks?.map((t) => t.value)
          : [],
      linkedTaskIds:
        data.milestoneType === "linked"
          ? data.linkedTasks?.map((t) => t.value)
          : [],
      milestoneData: JSON.stringify({
        type: data.milestoneType,
        linkedTaskIds:
          data.milestoneType === "linked"
            ? data.linkedTasks?.map((t) => t.value) || []
            : [],
        deliverables: [],
        completionCriteria: [],
        stakeholders: [],
      }),
    };

    onSubmit(formattedData);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      {/* Milestone Type Selection */}
      <div className="bg-blue-50/50 p-3 rounded-md border border-blue-100">
        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
          Milestone Type
        </label>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-800">
            <input
              type="radio"
              value="standalone"
              {...register("milestoneType")}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            Standalone
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-800">
            <input
              type="radio"
              value="linked"
              {...register("milestoneType")}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            Linked
          </label>
        </div>
        <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
          <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          {watchedMilestoneType === "standalone"
            ? "Standalone milestones are independent. Set your target due date manually."
            : "Linked milestones depend on sub-tasks. Due date is automatically set to the latest due date."}
        </p>
      </div>

      {/* Milestone Name */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium text-gray-900">
            Milestone Name <span className="text-red-500">*</span>
          </label>
          <span className="text-xs text-gray-400">{taskNameLength}/100</span>
        </div>
        <input
          type="text"
          {...register("taskName", {
            required: "Milestone name is required",
            maxLength: {
              value: 100,
              message: "Milestone name cannot exceed 100 characters",
            },
          })}
          placeholder="Enter milestone name..."
          className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm placeholder:text-gray-400 focus:outline-none focus:border-2 focus:border-blue-500"
        />
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
              className="milestone-task-compact-editor border border-gray-300 rounded-md focus:border-blue-500 transition-colors"
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
                menuPlacement="auto"
                formatOptionLabel={(option) => (
                  <div className="flex items-center gap-2 font-semibold text-gray-900">
                    <span>
                      📋 {option.title}
                      {option.createdAt ? (
                        <>
                          <span className="text-blue-600"> Created on:</span>{" "}
                          {formatDateToUserFriendly(option.createdAt)}
                        </>
                      ) : (
                        ""
                      )}
                      {option.dueDate ? (
                        <>
                          , <span className="text-blue-600"> Due Date:</span>{" "}
                          {formatDateToUserFriendly(option.dueDate)}
                        </>
                      ) : (
                        ""
                      )}
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700 uppercase tracking-wide whitespace-nowrap">
                      SUBTASK
                    </span>
                  </div>
                )}
                className="react-select-container h-8-select-dynamic"
                classNamePrefix="react-select"
                styles={{ control: (base, s) => ({ ...base, borderColor: s.isFocused ? "#3b82f6" : "#d1d5db", borderWidth: s.isFocused ? "2px" : "1px", boxShadow: "none", "&:hover": { borderColor: s.isFocused ? "#3b82f6" : "#d1d5db" } }) }}
                placeholder={
                  localIsLoadingTasks
                    ? "Loading tasks..."
                    : "Search and select tasks or sub-tasks..."
                }
                isLoading={localIsLoadingTasks}
                isDisabled={localIsLoadingTasks}
                noOptionsMessage={() => {
                  if (localIsLoadingTasks) return "Loading...";
                  if (dropdownOptions.length === 0)
                    return "No subtasks available. Create subtasks first.";
                  return "No options";
                }}
                isClearable
                isSearchable
              />
            )}
          />
          <p className="text-xs text-gray-500 mt-1">
            Select sub-tasks to link to this milestone. Due date will default to
            the latest linked sub-task date.
          </p>
          {errors.linkedTasks && (
            <p className="text-red-500 text-xs mt-1 flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" />
              {errors.linkedTasks.message}
            </p>
          )}
        </div>
      )}

      {/* Due Date & Assignee Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Due Date */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1 flex items-center gap-1">
            <Calendar className="w-4 h-4 text-gray-500" />
            Due Date <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            {...register("dueDate", {
              required: "Due date is required",
            })}
            disabled={watchedMilestoneType === "linked"}
            className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:border-2 focus:border-blue-500 ${
              watchedMilestoneType === "linked"
                ? "border-gray-300 bg-gray-100 text-gray-500 cursor-not-allowed"
                : "border-gray-300"
            }`}
          />
          {watchedMilestoneType === "linked" && (
            <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
              <input
                type="checkbox"
                checked={true}
                readOnly
                className="w-3 h-3 text-blue-600 rounded"
              />
              Automatically set to latest due date among linked tasks.
            </p>
          )}
        </div>

        {/* Assignee */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Assigned To <span className="text-red-500">*</span>
          </label>
          <Controller
            name="assignedTo"
            control={control}
            rules={{
              required: "Assignee is required",
            }}
            render={({ field }) => (
              <AssigneeSearchSelect
                value={field.value}
                onChange={field.onChange}
                isOrgUser={isOrgUser}
                currentUser={user}
                collaboratorOptions={collaboratorsList}
                isLoadingCollaborators={isCollaboratorsLoading}
                placeholder="Search and select assignee..."
              />
            )}
          />
          {errors.assignedTo && (
            <p className="text-red-500 text-xs mt-1 flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" />
              {errors.assignedTo.message}
            </p>
          )}
        </div>
      </div>

      {/* Priority & Collaborators Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                options={priorityOptions}
                menuPlacement="auto"
                className="react-select-container h-8-select-dynamic"
                classNamePrefix="react-select"
                styles={{ control: (base, s) => ({ ...base, borderColor: s.isFocused ? "#3b82f6" : "#d1d5db", borderWidth: s.isFocused ? "2px" : "1px", boxShadow: "none", "&:hover": { borderColor: s.isFocused ? "#3b82f6" : "#d1d5db" } }) }}
                placeholder="Select priority..."
              />
            )}
          />
        </div>

        {/* Collaborators */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1 flex items-center gap-1">
            <Users className="w-4 h-4 text-gray-500" />
            Collaborators
          </label>
          <Controller
            name="collaborators"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                isMulti
                menuPlacement="auto"
                options={collaboratorsList}
                isLoading={isCollaboratorsLoading}
                className="react-select-container h-8-select-dynamic"
                classNamePrefix="react-select"
                styles={{ control: (base, s) => ({ ...base, borderColor: s.isFocused ? "#3b82f6" : "#d1d5db", borderWidth: s.isFocused ? "2px" : "1px", boxShadow: "none", "&:hover": { borderColor: s.isFocused ? "#3b82f6" : "#d1d5db" } }) }}
                placeholder={
                  isCollaboratorsLoading
                    ? "Loading collaborators..."
                    : "Select collaborators..."
                }
              />
            )}
          />
        </div>
      </div>

      {/* Visibility */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Visibility <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-6 mt-1">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
            <input
              type="radio"
              value="private"
              {...register("visibility")}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            Private
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
            <input
              type="radio"
              value="team"
              {...register("visibility")}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            Team
          </label>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {watch("visibility") === "private"
            ? "Private: Only you and assignee can view."
            : "Team: All team members can view."}
        </p>
      </div>

      {/* Submit Controls */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="border-gray-300 text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 hover:bg-blue-700 text-white min-w-[190px]"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">Saving...</span>
          ) : (
            "Create Milestone Subtask"
          )}
        </Button>
      </div>
    </form>
  );
};

export default MilestoneSubtaskForm;
