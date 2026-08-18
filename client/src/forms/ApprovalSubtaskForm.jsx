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
  Clock,
  UserCheck,
  AlertCircle,
  Info,
  Users,
  Loader2,
} from "lucide-react";
import { useTaskPriorities } from "@/hooks/useTaskPriorities";
import LinkedTaskSelector from "../components/workflow/LinkedTaskSelector";

const ApprovalSubtaskForm = ({
  user,
  onSubmit,
  onCancel,
  isOrgUser = false,
  parentTask = null,
  editData = null,
  collaboratorOptions = [],
  isLoadingCollaborators = false,
  isSubmitting = false,
}) => {
  const [localApproverOptions, setLocalApproverOptions] = useState([]);
  const [localIsLoadingApprovers, setLocalIsLoadingApprovers] = useState(false);
  const [taskNameLength, setTaskNameLength] = useState(0);
  const [approverOrder, setApproverOrder] = useState([]);

  // Linked task dependency state
  const [linkedTaskId, setLinkedTaskId] = useState(editData?.linkedTaskId || null);
  const [autoInitiate, setAutoInitiate] = useState(
    editData?.configuration?.autoInitiate || editData?.autoInitiate || false
  );

  // Approval Context state
  const [approvalContext, setApprovalContext] = useState(
    editData?.approvalContext || editData?.context || ""
  );

  // Attachments state
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [attachmentSize, setAttachmentSize] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const attachmentsInputRef = useRef(null);

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

  const approvalModeOptions = [
    { value: "any", label: "Any One" },
    { value: "all", label: "All Must Approve" },
    { value: "sequential", label: "Sequential" },
  ];

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

  const getTodayDate = () => new Date().toISOString().slice(0, 16);

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
        : getTomorrowDateTime(),
      priority: editData?.priority
        ? {
            value: typeof editData.priority === "object" ? editData.priority.value : editData.priority,
            label: typeof editData.priority === "object" ? editData.priority.label : String(editData.priority).toUpperCase(),
          }
        : { value: "medium", label: "Medium" },
      assignedTo: editData?.assignedTo || (isOrgUser ? null : { value: "self", label: user?.name || "Self" }),
      approvers: editData?.approvers || [],
      approvalMode: editData?.approvalMode || "any",
      autoApproval: editData?.autoApproval || false,
      autoApproveAfter: editData?.autoApproveAfter || null,
      visibility: editData?.visibility || "private",
      collaborators: editData?.collaborators || [],
      status: editData?.status || "OPEN",
    },
  });

  const watchedTaskName = watch("taskName");
  const watchedApprovers = watch("approvers");
  const watchedApprovalMode = watch("approvalMode");
  const watchedAutoApproval = watch("autoApproval");
  const watchedDueDate = watch("dueDate");
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

  // Sync approver order when approvers change
  useEffect(() => {
    if (watchedApprovers && watchedApprovers.length > 0) {
      setApproverOrder(
        watchedApprovers.map((approver, index) => ({
          ...approver,
          order: index + 1,
        })),
      );
    } else {
      setApproverOrder([]);
    }
  }, [watchedApprovers]);

  // Move approver up
  const moveApproverUp = (index) => {
    if (index > 0) {
      const newOrder = [...approverOrder];
      [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
      setApproverOrder(newOrder);
      setValue("approvers", newOrder);
    }
  };

  // Move approver down
  const moveApproverDown = (index) => {
    if (index < approverOrder.length - 1) {
      const newOrder = [...approverOrder];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      setApproverOrder(newOrder);
      setValue("approvers", newOrder);
    }
  };

  // Attachment helpers
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const processFiles = (files) => {
    if (!files || files.length === 0) return;
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const currentSize = uploadedFiles.reduce((sum, f) => sum + f.file.size, 0);
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
      setAttachmentSize(updated.reduce((sum, f) => sum + f.file.size, 0));
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
    const formattedData = {
      title: data.taskName,
      taskName: data.taskName,
      description: data.description,
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
      autoApproveEnabled: data.autoApproval || false,
      autoApproveAfter:
        data.autoApproval && data.autoApproveAfter ? data.autoApproveAfter : null,
      approverOrder:
        data.approvalMode === "sequential" ? approverOrder : null,
      collaborators: data.collaborators?.map((c) => c.value) || [],
      attachments: uploadedFiles,
      approvalContext: approvalContext,
      context: approvalContext,
      linkedTaskId: linkedTaskId || null,
      configuration: {
        autoInitiate: !!linkedTaskId && autoInitiate,
      },
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
        <label className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-1.5">
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
              styles={selectStyles}
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

      {/* Row 1: Approval Mode — horizontal single line */}
      <div>
        <label className="text-sm font-medium text-gray-900 mb-1 flex items-center gap-1">
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

      {/* Row 2: Enable Auto-Approval + Auto-Approval Date side by side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Enable Auto-Approval */}
        <div className="flex items-center gap-2 pt-1">
          <input
            {...register("autoApproval")}
            type="checkbox"
            id="autoApprovalCheckbox"
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label
            htmlFor="autoApprovalCheckbox"
            className="text-sm font-medium text-gray-900 select-none cursor-pointer"
          >
            Enable Auto-Approval
          </label>
        </div>

        {/* Auto-Approval Date */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Auto-approval Date{" "}
            {watchedAutoApproval && <span className="text-red-500">*</span>}
          </label>
          <input
            {...register("autoApproveAfter", {
              required: watchedAutoApproval
                ? "Auto-approval date is required when auto-approval is enabled"
                : false,
              validate: (value) => {
                if (!watchedAutoApproval) return true;
                if (!value) return "Auto-approval date is required";
                const autoDate = new Date(value);
                const dueDate = new Date(watchedDueDate);
                return (
                  autoDate >= dueDate ||
                  "Auto-approval date must be on or after the due date"
                );
              },
            })}
            type="datetime-local"
            min={watchedDueDate || getTodayDate()}
            disabled={!watchedAutoApproval}
            className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:border-2 focus:border-blue-500 ${
              watchedAutoApproval
                ? "border-gray-300"
                : "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          />
          {errors.autoApproveAfter && (
            <p className="text-red-500 text-xs mt-1 flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" />
              {errors.autoApproveAfter.message}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Auto-approved if no approver action.
          </p>
        </div>
      </div>

      {/* Sequential Order - Only show if Sequential mode & approvers selected */}
      {watchedApprovalMode === "sequential" && approverOrder.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Approval Order
          </label>
          <div className="space-y-1.5 bg-gray-50 p-3 rounded-md border border-gray-200">
            {approverOrder.map((approver, index) => (
              <div
                key={approver.value}
                className="flex items-center justify-between bg-white px-2 py-1.5 rounded-md border border-gray-200 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-semibold">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {approver.label}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveApproverUp(index)}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                    title="Move Up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveApproverDown(index)}
                    disabled={index === approverOrder.length - 1}
                    className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                    title="Move Down"
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Approvers will review in this order. Use arrows to reorder.
          </p>
        </div>
      )}

      {/* Due Date & Assignee Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Due Date */}
        <div>
          <label className="text-sm font-medium text-gray-900 mb-1 flex items-center gap-1">
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
          {errors.dueDate && (
            <p className="text-red-500 text-xs mt-1 flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" />
              {errors.dueDate.message}
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
                collaboratorOptions={approverSourceOptions}
                isLoadingCollaborators={isLoadingCollaborators || localIsLoadingApprovers}
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
                styles={selectStyles}
                placeholder="Select priority..."
              />
            )}
          />
        </div>

        {/* Collaborators */}
        <div>
          <label className="text-sm font-medium text-gray-900 mb-1 flex items-center gap-1">
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
                styles={selectStyles}
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

      {/* Attachments */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Attachments{" "}
          <span className="text-xs text-gray-500 ml-1">(Max 5MB total)</span>
        </label>
        <div
          className={`w-full border-2 border-dashed p-4 text-center cursor-pointer rounded-md transition-colors ${
            isDragActive ? "border-blue-500 bg-blue-50" : "border-blue-300 bg-white"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => attachmentsInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              attachmentsInputRef.current?.click();
            }
          }}
        >
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center bg-blue-100 text-blue-600 rounded">
            +
          </div>
          <p className="text-sm font-semibold text-blue-600">Drag &amp; Drop files</p>
          <p className="text-xs text-gray-500">PDF, DOC, images supported</p>
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
          <div className="mt-3 space-y-1">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm text-gray-700">{file.name}</span>
                  <span className="text-xs text-gray-500">({formatFileSize(file.size)})</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="text-xs text-gray-500">
              Total size: {formatFileSize(attachmentSize)} / 5MB
            </div>
          </div>
        )}
      </div>

      {/* Context Task Dependency & Auto Initiate */}
      <LinkedTaskSelector
        parentTaskId={parentTask?._id || parentTask?.id}
        sequence={(parentTask?.subtaskCount || 0) + 1}
        excludeTaskId={editData?._id}
        linkedTaskId={linkedTaskId}
        onLinkedTaskChange={setLinkedTaskId}
        autoInitiate={autoInitiate}
        onAutoInitiateChange={setAutoInitiate}
        disabled={isSubmitting}
        label="Context Task (Prerequisite Dependency)"
      />

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
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </span>
          ) : (
            "Create Approval Subtask"
          )}
        </Button>
      </div>
    </form>
  );
};

export default ApprovalSubtaskForm;
