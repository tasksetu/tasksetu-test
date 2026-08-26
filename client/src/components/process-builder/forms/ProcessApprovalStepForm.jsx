import React, { useMemo, useState, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import CustomEditor from "../../common/CustomEditor";
import Select from "react-select";
import AssigneeSearchSelect from "../../common/AssigneeSearchSelect";
import { apiClient } from "../../../utils/apiClient";
import { Button } from "@/components/ui/button";
import {
  Clock,
  UserCheck,
  AlertCircle,
  Info,
  Users,
  Loader2,
  Paperclip,
  Upload,
  X,
  ShieldCheck,
} from "lucide-react";
import { useOrgUsers } from "@/hooks/useProcessBuilder";
import { useTaskPriorities } from "@/hooks/useTaskPriorities";
import LinkedTaskSelector from "../../workflow/LinkedTaskSelector";

export default function ProcessApprovalStepForm({
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
  const [localApproverOptions, setLocalApproverOptions] = useState([]);
  const [localIsLoadingApprovers, setLocalIsLoadingApprovers] = useState(false);
  const [taskNameLength, setTaskNameLength] = useState(0);
  const [approverOrder, setApproverOrder] = useState(stepToEdit?.approverOrder || []);

  const [linkedTaskId, setLinkedTaskId] = useState(stepToEdit?.linkedTaskId || null);
  const [contextTaskError, setContextTaskError] = useState("");
  const [autoInitiate, setAutoInitiate] = useState(
    stepToEdit?.configuration?.autoInitiate || stepToEdit?.autoInitiate || false
  );

  const [approvalContext, setApprovalContext] = useState(
    stepToEdit?.approvalContext || stepToEdit?.context || stepToEdit?.approvalInstructions || ""
  );

  const [uploadedFiles, setUploadedFiles] = useState(stepToEdit?.attachments || []);
  const [attachmentSize, setAttachmentSize] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const attachmentsInputRef = useRef(null);

  const { data: orgUsers = [] } = useOrgUsers();
  const { data: taskPriorities = [] } = useTaskPriorities();

  const hasFetchedApproversRef = useRef(false);

  const fetchApprovers = async () => {
    if (collaboratorOptions.length > 0 || hasFetchedApproversRef.current) return;
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
      console.error("Error fetching approvers in ProcessApprovalStepForm:", error);
      setLocalApproverOptions([]);
    } finally {
      setLocalIsLoadingApprovers(false);
    }
  };

  useEffect(() => {
    if (collaboratorOptions.length === 0 && !hasFetchedApproversRef.current) {
      fetchApprovers();
    }
  }, [collaboratorOptions.length]);

  const approverSourceOptions = useMemo(() => {
    if (collaboratorOptions.length > 0) return collaboratorOptions;
    if (localApproverOptions.length > 0) return localApproverOptions;
    return orgUsers.map((u) => ({
      value: u.id,
      label: `${u.name} (${u.role || "User"})`,
      name: u.name,
      email: u.email,
    }));
  }, [collaboratorOptions, localApproverOptions, orgUsers]);

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

  const approvalModeOptions = [
    { value: "any", label: "Any One" },
    { value: "all", label: "All Must Approve" },
    { value: "sequential", label: "Sequential" },
  ];

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
      priority: stepToEdit?.priority
        ? {
            value: typeof stepToEdit.priority === "object" ? stepToEdit.priority.value : String(stepToEdit.priority).toLowerCase(),
            label: typeof stepToEdit.priority === "object" ? stepToEdit.priority.label : String(stepToEdit.priority).toUpperCase(),
          }
        : { value: "medium", label: "Medium" },
      assignedTo: stepToEdit?.assignedUserId ? String(stepToEdit.assignedUserId) : (orgUsers[0] ? String(orgUsers[0].id) : null),
      approvers: stepToEdit?.approvers || [],
      approvalMode: stepToEdit?.approvalMode || "any",
      autoApproval: stepToEdit?.autoApproval || false,
      autoApproveAfter: stepToEdit?.autoApproveAfter || null,
      visibility: stepToEdit?.visibility || "private",
      collaborators: stepToEdit?.collaborators || [],
      status: stepToEdit?.status || "OPEN",
    },
  });

  const watchedTaskName = watch("taskName");
  const watchedApprovers = watch("approvers");
  const watchedApprovalMode = watch("approvalMode");
  const watchedAutoApproval = watch("autoApproval");

  useEffect(() => {
    setTaskNameLength(watchedTaskName?.length || 0);
  }, [watchedTaskName]);

  useEffect(() => {
    if (watchedApprovers && watchedApprovers.length > 0) {
      setApproverOrder(
        watchedApprovers.map((approver, index) => ({
          ...approver,
          order: index + 1,
        }))
      );
    } else {
      setApproverOrder([]);
    }
  }, [watchedApprovers]);

  const moveApproverUp = (index) => {
    if (index > 0) {
      const newOrder = [...approverOrder];
      [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
      setApproverOrder(newOrder);
      setValue("approvers", newOrder);
    }
  };

  const moveApproverDown = (index) => {
    if (index < approverOrder.length - 1) {
      const newOrder = [...approverOrder];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      setApproverOrder(newOrder);
      setValue("approvers", newOrder);
    }
  };

  const processFiles = (files) => {
    if (!files || files.length === 0) return;
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const currentSize = uploadedFiles.reduce((sum, f) => sum + (f.size || f.file?.size || 0), 0);
    if (currentSize + totalSize > 5 * 1024 * 1024) {
      alert("Total file size cannot exceed 5MB");
      return;
    }
    const newFiles = files.map((file) => ({
      file,
      name: file.name,
      size: file.size,
      id: Math.random().toString(36).substr(2, 9),
    }));
    setUploadedFiles((prev) => [...prev, ...newFiles]);
    setAttachmentSize(currentSize + totalSize);
  };

  const handleFileUpload = (e) => {
    processFiles(Array.from(e.target.files || []));
    e.target.value = "";
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragActive(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragActive(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    processFiles(Array.from(e.dataTransfer?.files || []));
  };

  const removeFile = (fileId) => {
    setUploadedFiles((prev) => {
      const updated = prev.filter((f) => f.id !== fileId);
      setAttachmentSize(updated.reduce((sum, f) => sum + (f.size || f.file?.size || 0), 0));
      return updated;
    });
  };

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
    if (!linkedTaskId) {
      setContextTaskError("Prerequisite context task is required for approval tasks.");
      return;
    }
    setContextTaskError("");

    const formattedData = {
      id: stepToEdit?.id || `step_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title: data.taskName,
      name: data.taskName,
      taskName: data.taskName,
      description: data.description,
      taskType: "Approval",
      subtaskType: "approval",
      mainTaskType: "regular",
      isApprovalTask: true,
      dueDays: Number(data.dueDays) || 3,
      priority: typeof data.priority === "object" ? data.priority.value : data.priority,
      status: data.status || "OPEN",
      visibility: data.visibility || "Private",
      assignee: data.assignedTo?.value || data.assignedTo || "",
      assignedUserId: data.assignedTo?.value || data.assignedTo || "",
      assignedTo: data.assignedTo?.value || data.assignedTo || "",
      approvers: data.approvers?.map((a) => a.value || a) || [],
      approverIds: data.approvers?.map((a) => a.value || a) || [],
      approvalMode: data.approvalMode || "any",
      approvalStatus: "pending",
      autoApproveEnabled: data.autoApproval || false,
      autoApproveAfter: data.autoApproval && data.autoApproveAfter ? data.autoApproveAfter : null,
      approverOrder: data.approvalMode === "sequential" ? approverOrder : null,
      collaborators: data.collaborators?.map((c) => c.value || c) || [],
      attachments: uploadedFiles,
      approvalContext: approvalContext,
      approvalInstructions: approvalContext,
      context: approvalContext,
      linkedTaskId: linkedTaskId || null,
      linkedToMilestone: linkedTaskId || null,
      approvalRequired: true,
      configuration: {
        autoInitiate: !!linkedTaskId && autoInitiate,
        autoComplete: false,
        autoCompleteAfterDays: null,
        parentCancellationMode: "ignore_rejection",
      },
    };

    onSubmit(formattedData);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-left">
      {/* Task Name */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium text-gray-900">
            Approval Task Name <span className="text-red-500">*</span>
          </label>
          <span className="text-xs text-gray-400 font-medium">{taskNameLength}/100</span>
        </div>
        <input
          type="text"
          maxLength={100}
          {...register("taskName", {
            required: "Task name is required",
            maxLength: {
              value: 100,
              message: "Task name cannot exceed 100 characters",
            },
          })}
          placeholder="Enter approval task name..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-2 focus:border-blue-500 text-xs placeholder-gray-400"
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
         Approval Task Description
        </label>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <CustomEditor
              value={field.value}
              onChange={field.onChange}
              className="border border-gray-300 rounded-md focus:border-blue-500 transition-colors"
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
              options={approverSourceOptions}
              isLoading={isLoadingCollaborators || localIsLoadingApprovers}
              className="react-select-container text-xs"
              classNamePrefix="react-select"
              styles={selectStyles}
              placeholder={
                isLoadingCollaborators || localIsLoadingApprovers
                  ? "Loading approvers..."
                  : "Search and select approvers..."
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

      {/* Approval Mode */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1 flex items-center gap-1">
          Approval Mode <span className="text-red-500">*</span>
          <div className="relative group ml-1">
            <Info className="w-3.5 h-3.5 text-gray-400 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none w-64 z-10">
              <div className="space-y-1">
                <div><strong>Any One:</strong> First approver's decision is final</div>
                <div><strong>All Must Approve:</strong> Every approver must approve</div>
                <div><strong>Sequential:</strong> Approvers review in order</div>
              </div>
            </div>
          </div>
        </label>
        <div className="flex items-center gap-6">
          {approvalModeOptions.map((option) => (
            <label key={option.value} className="flex items-center gap-2 cursor-pointer">
              <input
                {...register("approvalMode")}
                type="radio"
                value={option.value}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-900">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Auto-Approval Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50/50 p-3 rounded-md border border-gray-200">
        <div className="flex items-center gap-2 pt-1">
          <input
            {...register("autoApproval")}
            type="checkbox"
            id="autoApprovalCheckbox"
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label
            htmlFor="autoApprovalCheckbox"
            className="text-xs font-medium text-gray-900 select-none cursor-pointer"
          >
            Enable Auto-Approval
          </label>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-900 mb-1">
            Auto-approval Offset Days
          </label>
          <input
            {...register("autoApproveAfter")}
            type="number"
            min={0}
            disabled={!watchedAutoApproval}
            placeholder="Days after due date (e.g. 2)"
            className={`w-full h-8 px-3 py-1 border rounded-md text-xs focus:outline-none focus:border-2 focus:border-blue-500 ${
              watchedAutoApproval
                ? "border-gray-300 bg-white"
                : "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Auto-approved if no approver action.
          </p>
        </div>
      </div>

      {/* Sequential Order List */}
      {watchedApprovalMode === "sequential" && approverOrder.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Approval Order
          </label>
          <div className="space-y-1.5 bg-gray-50 p-3 rounded-md border border-gray-200">
            {approverOrder.map((approver, index) => (
              <div
                key={approver.value || index}
                className="flex items-center justify-between bg-white px-2 py-1.5 rounded-md border border-gray-200 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-semibold">
                    {index + 1}
                  </span>
                  <span className="text-xs font-medium text-gray-800 truncate">
                    {approver.label}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveApproverUp(index)}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-40 text-xs"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveApproverDown(index)}
                    disabled={index === approverOrder.length - 1}
                    className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-40 text-xs"
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Due Days Offset & Assignee Grid */}
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
            {...register("dueDays", {
              required: "Due days offset is required",
            })}
            className="w-full h-8 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:border-2 focus:border-blue-500 text-xs"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            Days offset when process launched.
          </p>
        </div>

        {/* Assignee */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Assigned To<span className="text-red-500">*</span>
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
                placeholder="Search and select lead approver..."
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
                options={approverSourceOptions}
                className="react-select-container text-xs"
                classNamePrefix="react-select"
                styles={selectStyles}
                placeholder="Select collaborators for notifications..."
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

      {/* Attachments Section */}
      <div>
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
          Attachments <span className="text-xs text-gray-400 font-normal ml-1">(Max 5MB total)</span>
        </label>
        <div
          className={`w-full border-2 border-dashed p-3 text-center cursor-pointer rounded-md transition-colors ${
            isDragActive ? "border-indigo-500 bg-indigo-50" : "border-gray-300 bg-gray-50/60"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => attachmentsInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <p className="text-xs font-semibold text-indigo-600">Drag &amp; Drop files or click to browse</p>
          <p className="text-[11px] text-gray-400">PDF, DOC, images supported</p>
        </div>
        <input
          ref={attachmentsInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
          onChange={handleFileUpload}
          className="hidden"
        />

        {uploadedFiles.length > 0 && (
          <div className="mt-2 space-y-1">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded text-xs"
              >
                <div className="flex items-center gap-2">
                  <Paperclip className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-gray-700 font-medium">{file.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="text-gray-400 hover:text-red-500 text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Linked Task Selector */}
      <LinkedTaskSelector
        parentTaskId={parentTask?._id || parentTask?.id}
        sequence={1}
        excludeTaskId={stepToEdit?.id}
        linkedTaskId={linkedTaskId}
        onLinkedTaskChange={(selectedId) => {
          setLinkedTaskId(selectedId);
          if (selectedId) setContextTaskError("");
        }}
        autoInitiate={autoInitiate}
        onAutoInitiateChange={setAutoInitiate}
        disabled={false}
        label="Context Task (Prerequisite Dependency)"
        isRequired={true}
        error={contextTaskError}
        previousSteps={previousSteps}
      />



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
