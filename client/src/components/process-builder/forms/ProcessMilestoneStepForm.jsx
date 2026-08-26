import React, { useMemo, useState, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import CustomEditor from "../../common/CustomEditor";
import Select from "react-select";
import AssigneeSearchSelect from "../../common/AssigneeSearchSelect";
import { apiClient } from "../../../utils/apiClient";
import { Button } from "@/components/ui/button";
import { Star, Clock, Users, Info, AlertCircle } from "lucide-react";
import { useOrgUsers } from "@/hooks/useProcessBuilder";
import { useTaskPriorities } from "@/hooks/useTaskPriorities";

export default function ProcessMilestoneStepForm({
  stepToEdit = null,
  onClose,
  onSubmit,
  user = null,
  isOrgUser = true,
  parentTask = null,
  collaboratorOptions = [],
  isLoadingCollaborators = false,
  isSubmitting = false,
  previousSteps = [],
}) {
  const [taskNameLength, setTaskNameLength] = useState(0);
  const [localCollaboratorsList, setLocalCollaboratorsList] = useState([]);
  const [localIsLoadingCollaborators, setLocalIsLoadingCollaborators] = useState(false);

  const localAvailableTasks = useMemo(() => {
    if (previousSteps && previousSteps.length > 0) {
      return previousSteps.map((st, idx) => ({
        value: st.id || `step_${idx}`,
        label: `Step ${idx + 1}: ${st.name || st.title || "Subtask"} (${st.taskType || "regular"})`,
        title: st.name || st.title || `Step ${idx + 1}`,
      }));
    }
    return [];
  }, [previousSteps]);
  const [localIsLoadingTasks, setLocalIsLoadingTasks] = useState(false);
  const hasFetchedTasksRef = useRef(false);
  const hasFetchedCollaboratorsRef = useRef(false);

  const { data: orgUsers = [] } = useOrgUsers();
  const { data: taskPriorities = [] } = useTaskPriorities();

  const fetchCollaborators = async () => {
    if (collaboratorOptions.length > 0 || hasFetchedCollaboratorsRef.current) return;
    hasFetchedCollaboratorsRef.current = true;

    try {
      setLocalIsLoadingCollaborators(true);
      const response = await apiClient.get("/api/auth/collaborators");

      if (response.data.success && Array.isArray(response.data.data)) {
        const formatted = response.data.data.map((collaborator) => {
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
          };
        });
        setLocalCollaboratorsList(formatted);
      }
    } catch (error) {
      console.error("Error fetching collaborators in ProcessMilestoneStepForm:", error);
      setLocalCollaboratorsList([]);
    } finally {
      setLocalIsLoadingCollaborators(false);
    }
  };

  useEffect(() => {
    if (collaboratorOptions.length === 0 && !hasFetchedCollaboratorsRef.current) {
      fetchCollaborators();
    }
  }, [collaboratorOptions.length]);

  const collaboratorsList = useMemo(() => {
    if (collaboratorOptions.length > 0) return collaboratorOptions;
    if (localCollaboratorsList.length > 0) return localCollaboratorsList;
    return orgUsers.map((u) => {
      const rolesStr = Array.isArray(u.role) ? u.role.join(", ") : u.role;
      return {
        value: u.id,
        label: `${u.name} (${u.email || ""}) ${rolesStr ? `- ${rolesStr}` : ""}`,
        name: u.name,
        email: u.email,
      };
    });
  }, [collaboratorOptions, localCollaboratorsList, orgUsers]);

  const isCollaboratorsLoading =
    collaboratorOptions.length > 0 ? isLoadingCollaborators : localIsLoadingCollaborators;

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

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      taskName: stepToEdit?.name || stepToEdit?.title || stepToEdit?.taskName || "",
      description: stepToEdit?.description || "",
      dueDays: stepToEdit?.dueDays ?? 3,
      milestoneType: stepToEdit?.milestoneType || "standalone",
      linkedTasks: stepToEdit?.linkedTasks || [],
      priority: stepToEdit?.priority
        ? {
            value: typeof stepToEdit.priority === "object" ? stepToEdit.priority.value : String(stepToEdit.priority).toLowerCase(),
            label: typeof stepToEdit.priority === "object" ? stepToEdit.priority.label : String(stepToEdit.priority).toUpperCase(),
          }
        : { value: "medium", label: "Medium" },
      assignedTo: stepToEdit?.assignedUserId ? String(stepToEdit.assignedUserId) : (orgUsers[0] ? String(orgUsers[0].id) : null),
      visibility: stepToEdit?.visibility || "private",
      collaborators: stepToEdit?.collaborators || [],
      status: stepToEdit?.status || "OPEN",
    },
  });

  const watchedTaskName = watch("taskName");
  const watchedMilestoneType = watch("milestoneType");

  useEffect(() => {
    setTaskNameLength(watchedTaskName?.length || 0);
  }, [watchedTaskName]);

  const selectStyles = {
    control: (base, s) => ({
      ...base,
      borderColor: s.isFocused ? "#3b82f6" : "#d1d5db",
      borderWidth: s.isFocused ? "2px" : "1px",
      boxShadow: "none",
      "&:hover": { borderColor: s.isFocused ? "#3b82f6" : "#d1d5db" },
    }),
  };

  const onFormSubmit = (data) => {
    const mType = data.milestoneType || "standalone";
    const linkedIds = mType === "linked" && Array.isArray(data.linkedTasks) ? data.linkedTasks : [];

    const payload = {
      id: stepToEdit?.id || `step_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: data.taskName.trim(),
      title: data.taskName.trim(),
      taskName: data.taskName.trim(),
      taskType: "Milestone",
      subtaskType: "milestone",
      mainTaskType: "regular",
      isMilestone: true,
      milestoneType: mType,
      milestoneData: {
        type: mType,
        linkedTaskIds: linkedIds,
        completionCriteria: [],
        deliverables: [],
        stakeholders: [],
      },
      linkedTasks: linkedIds,
      linkedToMilestone: null,
      description: (data.description || "").trim(),
      dueDays: Number(data.dueDays) || 3,
      priority: typeof data.priority === "object" ? data.priority.value : data.priority,
      assignedUserId: data.assignedTo?.value || data.assignedTo || "",
      assignedTo: data.assignedTo?.value || data.assignedTo || "",
      visibility: data.visibility || "Private",
      collaborators: data.collaborators?.map((c) => c.value || c) || [],
      status: data.status || "OPEN",
      approvalRequired: false,
      configuration: {
        autoInitiate: false,
        autoComplete: false,
        autoCompleteAfterDays: null,
        parentCancellationMode: "ignore_rejection",
      },
    };
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-left">
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
            ? "Standalone milestones are independent. Set your target due days offset."
            : "Linked milestones depend on sub-tasks. Due days offset is calculated automatically."}
        </p>
      </div>

      {/* Milestone Name */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium text-gray-900">
            Milestone Name <span className="text-red-500">*</span>
          </label>
          <span className="text-xs text-gray-400 font-medium">{taskNameLength}/100</span>
        </div>
        <input
          type="text"
          maxLength={100}
          {...register("taskName", {
            required: "Milestone name is required",
            maxLength: {
              value: 100,
              message: "Milestone name cannot exceed 100 characters",
            },
          })}
          placeholder="Enter milestone name..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs placeholder:text-gray-400 focus:outline-none focus:border-2 focus:border-blue-500"
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
              className="border border-gray-300 rounded-md focus:border-blue-500 transition-colors"
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
                options={localAvailableTasks}
                value={localAvailableTasks.filter((opt) =>
                  field.value?.some((v) => v.value === opt.value || v === opt.value)
                )}
                menuPlacement="auto"
                formatOptionLabel={(option) => (
                  <div className="flex items-center gap-2 font-semibold text-gray-900 text-xs">
                    <span>📋 {option.label || option.title}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700 uppercase tracking-wide whitespace-nowrap">
                      STEP
                    </span>
                  </div>
                )}
                className="react-select-container text-xs"
                classNamePrefix="react-select"
                styles={selectStyles}
                placeholder="Search and select process steps to link..."
                isClearable
                isSearchable
              />
            )}
          />
          <p className="text-xs text-gray-500 mt-1">
            Select sub-tasks/steps to link to this milestone. Due date will default to
            the latest linked step offset.
          </p>
          {errors.linkedTasks && (
            <p className="text-red-500 text-xs mt-1 flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" />
              {errors.linkedTasks.message}
            </p>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* DUE DAYS OFFSET */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            DUE DAYS OFFSET <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={0}
            disabled={watchedMilestoneType === "linked"}
            {...register("dueDays", {
              required: watchedMilestoneType !== "linked" ? "Due days offset is required" : false,
            })}
            className={`w-full h-8 px-3 py-1 border rounded-md text-xs focus:outline-none focus:border-2 focus:border-blue-500 ${
              watchedMilestoneType === "linked"
                ? "border-gray-300 bg-gray-100 text-gray-500 cursor-not-allowed"
                : "border-gray-300"
            }`}
          />
          {watchedMilestoneType === "linked" ? (
            <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
              <input
                type="checkbox"
                checked={true}
                readOnly
                className="w-3 h-3 text-blue-600 rounded"
              />
              Automatically set to latest due date among linked tasks.
            </p>
          ) : (
            <p className="text-[11px] text-gray-400 mt-1">
              Days offset when process launched.
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
                isOrgUser={true}
                options={orgUsers}
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
                className="react-select-container text-xs"
                classNamePrefix="react-select"
                styles={selectStyles}
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
                className="react-select-container text-xs"
                classNamePrefix="react-select"
                styles={selectStyles}
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
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isSubmitting}
          className="border-gray-300 text-gray-600 hover:bg-gray-50 h-9 text-xs"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[140px] h-9 text-xs font-semibold"
        >
          {stepToEdit ? "Save Step" : "Add Step"}
        </Button>
      </div>
    </form>
  );
}
