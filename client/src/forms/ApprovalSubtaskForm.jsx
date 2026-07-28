import React, { useMemo, useState, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import CustomEditor from "../components/common/CustomEditor";
import "quill/dist/quill.snow.css";
import "../styles/quill-custom.css";
import Select from "react-select";
import AssigneeSearchSelect from "../components/common/AssigneeSearchSelect";
import { apiClient } from "../utils/apiClient";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Clock,
  UserCheck,
  AlertCircle,
  FileText,
  Paperclip,
  X,
  Upload,
  Loader2,
} from "lucide-react";
import { useTaskPriorities } from "@/hooks/useTaskPriorities";

const ApprovalSubtaskForm = ({
  user,
  onSubmit,
  onCancel,
  isOrgUser = false,
  parentTask = null,
  collaboratorOptions = [],
  isLoadingCollaborators = false,
  isSubmitting = false,
}) => {
  const [localApproverOptions, setLocalApproverOptions] = useState([]);
  const [localIsLoadingApprovers, setLocalIsLoadingApprovers] = useState(false);
  const [taskNameLength, setTaskNameLength] = useState(0);

  const hasFetchedApproversRef = useRef(false);

  const fetchApprovers = async () => {
    if (!isOrgUser || collaboratorOptions.length > 0 || hasFetchedApproversRef.current) return;
    hasFetchedApproversRef.current = true;

    try {
      setLocalIsLoadingApprovers(true);
      const response = await apiClient.get("/api/auth/collaborators");

      if (response.data.success && Array.isArray(response.data.data)) {
        const formattedApprovers = response.data.data.map((collaborator) => {
          const rolesStr = Array.isArray(collaborator.role)
            ? collaborator.role.join(", ")
            : collaborator.role;
          const label = `${collaborator.name} (${collaborator.email || ""}) ${rolesStr ? `- ${rolesStr}` : ""}`;
          return {
            value: collaborator.id,
            label,
            name: collaborator.name,
            email: collaborator.email,
            role: collaborator.role,
            department: collaborator.department,
          };
        });
        setLocalApproverOptions(formattedApprovers);
      }
    } catch (error) {
      console.error("Error fetching approvers in ApprovalSubtaskForm:", error);
      setLocalApproverOptions([]);
    } finally {
      setLocalIsLoadingApprovers(false);
    }
  };

  useEffect(() => {
    if (isOrgUser && collaboratorOptions.length === 0 && !hasFetchedApproversRef.current) {
      fetchApprovers();
    }
  }, [isOrgUser, collaboratorOptions.length]);

  const approverSourceOptions =
    collaboratorOptions.length > 0
      ? collaboratorOptions
      : localApproverOptions;

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

  const getTomorrowDateTime = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(17, 0, 0, 0);

    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const day = String(tomorrow.getDate()).padStart(2, "0");
    const hours = String(tomorrow.getHours()).padStart(2, "0");
    const minutes = String(tomorrow.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

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
      dueDate: getTomorrowDateTime(),
      priority: { value: "medium", label: "Medium" },
      assignedTo: isOrgUser
        ? null
        : { value: "self", label: user?.name || "Self" },
      approvers: [],
      approvalMode: "any",
      visibility: "private",
      collaborators: [],
      attachments: [],
      status: "OPEN",
    },
  });

  const watchedTaskName = watch("taskName");
  const watchedApprovers = watch("approvers");
  const watchedPriority = watch("priority");

  useEffect(() => {
    setTaskNameLength(watchedTaskName?.length || 0);
  }, [watchedTaskName]);

  useEffect(() => {
    if (watchedPriority?.value) {
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

      const year = dueDate.getFullYear();
      const month = String(dueDate.getMonth() + 1).padStart(2, "0");
      const day = String(dueDate.getDate()).padStart(2, "0");
      const hours = String(dueDate.getHours()).padStart(2, "0");
      const minutes = String(dueDate.getMinutes()).padStart(2, "0");

      setValue("dueDate", `${year}-${month}-${day}T${hours}:${minutes}`);
    }
  }, [watchedPriority, setValue, taskPriorities]);

  const onFormSubmit = (data) => {
    const formattedData = {
      title: data.taskName,
      taskName: data.taskName,
      taskType: "approval",
      mainTaskType: parentTask?.mainTaskType || parentTask?.taskType || "regular",
      dueDate: data.dueDate,
      priority: data.priority?.value || data.priority || "medium",
      status: data.status || "OPEN",
      visibility: data.visibility || "private",
      assignee: data.assignedTo?.value || data.assignedTo || "self",
      assignedTo: data.assignedTo?.value || data.assignedTo || "self",
      approvers: data.approvers?.map((a) => a.value) || [],
      approverIds: data.approvers?.map((a) => a.value) || [],
      approvalMode: data.approvalMode || "any",
      approvalStatus: "pending",
      collaborators: data.collaborators?.map((c) => c.value) || [],
    };

    onSubmit(formattedData);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      {/* Task Name */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium text-gray-900">
            Approval Task Name <span className="text-red-500">*</span>
          </label>
          <span className="text-xs text-gray-400">{taskNameLength}/100</span>
        </div>
        <input
          type="text"
          {...register("taskName", {
            required: "Task name is required",
            maxLength: {
              value: 100,
              message: "Task name cannot exceed 100 characters",
            },
          })}
          placeholder="Enter approval task name..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-2 focus:border-blue-500 text-sm placeholder-gray-400"
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
          Description / Details for Approvers
        </label>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <CustomEditor
              value={field.value}
              onChange={field.onChange}
              className="milestone-task-compact-editor border border-gray-300 rounded-md focus:border-blue-500 transition-colors"
              placeholder="Provide details that approvers need to review..."
            />
          )}
        />
      </div>

      {/* Approvers Selection */}
      <div className="bg-blue-50/50 p-3.5 rounded-md border border-blue-100">
        <label className="block text-sm font-semibold text-blue-900 mb-2 flex items-center gap-1.5">
          <UserCheck className="w-4 h-4 text-blue-600" />
          Approvers <span className="text-red-500">*</span>
        </label>
        <Controller
          name="approvers"
          control={control}
          rules={{
            validate: (value) =>
              (value && value.length > 0) || "Select at least one approver",
          }}
          render={({ field }) => (
            <Select
              {...field}
              isMulti
              menuPlacement="auto"
              options={approverSourceOptions.filter(
                (opt) => opt.value !== "self",
              )}
              isLoading={isLoadingCollaborators || localIsLoadingApprovers}
              className="react-select-container h-8-select-dynamic"
              classNamePrefix="react-select"
              styles={{ control: (base, s) => ({ ...base, borderColor: s.isFocused ? "#3b82f6" : "#d1d5db", borderWidth: s.isFocused ? "2px" : "1px", boxShadow: "none", "&:hover": { borderColor: s.isFocused ? "#3b82f6" : "#d1d5db" } }) }}
              placeholder={
                isLoadingCollaborators || localIsLoadingApprovers
                  ? "Loading approvers..."
                  : "Search and select approvers..."
              }
              noOptionsMessage={() =>
                isLoadingCollaborators || localIsLoadingApprovers
                  ? "Loading..."
                  : "No approvers available"
              }
            />
          )}
        />
        {errors.approvers && (
          <p className="text-red-500 text-xs mt-1 flex items-center">
            <AlertCircle className="w-3 h-3 mr-1" />
            {errors.approvers.message}
          </p>
        )}
      </div>

      {/* Due Date & Assignee Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Due Date */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1 flex items-center gap-1">
            <Clock className="w-4 h-4 text-gray-500" />
            Approval Deadline <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            {...register("dueDate", {
              required: "Approval deadline is required",
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-2 focus:border-blue-500 text-sm"
          />
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
                collaboratorOptions={approverSourceOptions}
                isLoadingCollaborators={isLoadingCollaborators || localIsLoadingApprovers}
                placeholder="Search and select assignee..."
              />
            )}
          />
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
          <label className="block text-sm font-medium text-gray-900 mb-1">
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
                options={approverSourceOptions.filter(
                  (opt) =>
                    opt.value !== "self" &&
                    !watchedApprovers?.some(
                      (approver) => approver.value === opt.value,
                    ),
                )}
                isLoading={isLoadingCollaborators || localIsLoadingApprovers}
                className="react-select-container h-8-select-dynamic"
                classNamePrefix="react-select"
                styles={{ control: (base, s) => ({ ...base, borderColor: s.isFocused ? "#3b82f6" : "#d1d5db", borderWidth: s.isFocused ? "2px" : "1px", boxShadow: "none", "&:hover": { borderColor: s.isFocused ? "#3b82f6" : "#d1d5db" } }) }}
                placeholder={
                  isLoadingCollaborators || localIsLoadingApprovers
                    ? "Loading collaborators..."
                    : "Select collaborators for notifications..."
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
            <span className="flex items-center gap-2">
              Saving...
            </span>
          ) : "Create Approval Subtask"}
        </Button>
      </div>
    </form>
  );
};

export default ApprovalSubtaskForm;
