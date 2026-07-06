import React, { useState, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import CustomEditor from "../components/common/CustomEditor";
import "quill/dist/quill.snow.css";
import "../styles/quill-custom.css";
import Select from "react-select";
import AssigneeSearchSelect from "../components/common/AssigneeSearchSelect";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  XCircle,
  Info,
  AlertCircle,
  GripVertical,
  Users,
  Loader2,
} from "lucide-react";
import { useTaskPriorities } from "@/hooks/useTaskPriorities";

const ApprovalTaskForm = ({
  user,
  onSubmit,
  isOrgUser,
  approverOptions = [], // API data
  collaboratorOptions = [], // API data
  isLoadingApprovers = false,
  isLoadingCollaborators = false,
  drawer = false,
}) => {
  const [taskNameLength, setTaskNameLength] = useState(0);
  const [approverOrder, setApproverOrder] = useState([]);
  const [attachmentSize, setAttachmentSize] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const attachmentsInputRef = useRef(null);

  useEffect(() => {
    const style = document.createElement("style");
    style.id = "h-8-select-styles";
    style.textContent = `
      .h-8-select .react-select__control {
        min-height: 32px !important;
        height: 32px !important;
        display: flex !important;
        align-items: center !important;
      }
      .h-8-select .react-select__value-container {
        min-height: 30px !important;
        height: 100% !important;
        padding: 0 8px !important;
        display: flex !important;
        align-items: center !important;
        align-content: center !important;
        flex-wrap: wrap !important;
      }
      .h-8-select .react-select__indicators {
        min-height: 30px !important;
        height: 100% !important;
      }
      .h-8-select .react-select__single-value,
      .h-8-select .react-select__placeholder {
        position: absolute !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
      }
      .h-8-select .react-select__multi-value {
        display: inline-flex !important;
        align-items: center !important;
        margin: 0 4px 0 0 !important;
        background-color: #f3f4f6 !important;
        border-radius: 4px !important;
        height: 24px !important;
      }
      .h-8-select .react-select__multi-value__label {
        display: flex !important;
        align-items: center !important;
        padding: 0 6px !important;
        color: #1f2937 !important;
        font-size: 13px !important;
        height: 100% !important;
      }
      .h-8-select .react-select__multi-value__remove {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        height: 100% !important;
        padding: 0 4px !important;
        cursor: pointer !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById("h-8-select-styles");
      if (el) el.remove();
    };
  }, []);

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
      dueDate: new Date().toISOString().slice(0, 16),
      approvers: [],
      approvalMode: "any", // Changed from "any_one" to "any" for backend compatibility
      autoApproval: false,
      autoApprovalDays: 3,
      autoApproveAfter: null, // Added for backend
      priority: { value: "medium", label: "Medium" },
      assignedTo: isOrgUser
        ? null
        : { value: "self", label: user?.name || "Self" },
      collaborators: [],
      visibility: "private",
    },
  });

  const watchedTaskName = watch("taskName");
  const watchedApprovers = watch("approvers");
  const watchedApprovalMode = watch("approvalMode");
  const watchedAutoApproval = watch("autoApproval");
  const watchedPriority = watch("priority");
  const watchedDueDate = watch("dueDate");
  const { data: taskPriorities = [] } = useTaskPriorities();

  useEffect(() => {
    setTaskNameLength(watchedTaskName?.length || 0);
  }, [watchedTaskName]);

  // Auto-set due date based on priority
  useEffect(() => {
    if (watchedPriority?.value) {
      const today = new Date();
      const cfg = (Array.isArray(taskPriorities) ? taskPriorities : []).find(
        (p) => p && p.code === watchedPriority.value,
      );
      const daysToAdd = Number.isFinite(Number(cfg?.daysToDue))
        ? Number(cfg.daysToDue)
        : watchedPriority.value === "critical"
          ? 2
          : watchedPriority.value === "high"
            ? 7
            : watchedPriority.value === "low"
              ? 30
              : 14;

      const dueDate = new Date(today);
      dueDate.setDate(today.getDate() + daysToAdd);
      setValue("dueDate", dueDate.toISOString().slice(0, 16));
    }
  }, [watchedPriority, setValue, taskPriorities]);

  // Update approver order when approvers change
  useEffect(() => {
    if (watchedApprovers && watchedApprovers.length > 0) {
      const newOrder = watchedApprovers.map((approver, index) => ({
        ...approver,
        order: index + 1,
      }));
      setApproverOrder(newOrder);
    } else {
      setApproverOrder([]);
    }
  }, [watchedApprovers]);

  // Get today's datetime for validation
  const getTodayDate = () => {
    return new Date().toISOString().slice(0, 16);
  };

  // Priority options
  const priorityOptions = (Array.isArray(taskPriorities) ? taskPriorities : [])
    .filter((p) => p && p.active)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((p) => ({ value: p.code, label: p.label }));

  // Approval mode options (updated to match backend values)
  const approvalModeOptions = [
    { value: "any", label: "Any One" },
    { value: "all", label: "All Must Approve" },
    { value: "sequential", label: "Sequential" },
  ];

  // Assignment options (for org users) - Build from collaboratorOptions
  const assignmentOptions = isOrgUser
    ? [{ value: "self", label: "Self" }, ...collaboratorOptions]
    : [{ value: "self", label: "Self" }];

  // Debug logging
  console.log("ApprovalTaskForm - Assignment Debug:", {
    isOrgUser,
    collaboratorOptionsCount: collaboratorOptions.length,
    collaboratorOptions,
    assignmentOptions,
    isLoadingCollaborators,
  });

  // Move approver up in order
  const moveApproverUp = (index) => {
    if (index > 0) {
      const newOrder = [...approverOrder];
      [newOrder[index], newOrder[index - 1]] = [
        newOrder[index - 1],
        newOrder[index],
      ];
      setApproverOrder(newOrder);
      setValue("approvers", newOrder);
    }
  };

  // Move approver down in order
  const moveApproverDown = (index) => {
    if (index < approverOrder.length - 1) {
      const newOrder = [...approverOrder];
      [newOrder[index], newOrder[index + 1]] = [
        newOrder[index + 1],
        newOrder[index],
      ];
      setApproverOrder(newOrder);
      setValue("approvers", newOrder);
    }
  };

  // Shared attachment processing for click + drag/drop flows
  const processFiles = (files) => {
    if (!files || files.length === 0) return;
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const currentSize = uploadedFiles.reduce((sum, file) => sum + file.size, 0);

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

  // File upload handler (input picker)
  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files || []);
    processFiles(files);
    event.target.value = "";
  };

  // Drag/drop handlers
  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragActive(false);
    const files = Array.from(event.dataTransfer?.files || []);
    processFiles(files);
  };

  // Remove file
  const removeFile = (fileId) => {
    setUploadedFiles((prev) => {
      const updated = prev.filter((f) => f.id !== fileId);
      const newSize = updated.reduce((sum, file) => sum + file.file.size, 0);
      setAttachmentSize(newSize);
      return updated;
    });
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Quill editor configuration (handled by CustomEditor component)

  const onFormSubmit = (data) => {
    // Transform frontend data to match backend API expectations
    const formData = {
      taskName: data.taskName,
      description: data.description,
      dueDate: data.dueDate,
      attachments: uploadedFiles,
      priority: data.priority?.value || data.priority,
      assignedTo: data.assignedTo?.value || data.assignedTo,
      visibility: data.visibility,
      collaborators:
        data.collaborators?.map((c) => ({ id: c.value, value: c.value })) || [],
      taskType: "approval",

      // Approval-specific fields matching backend expectations
      approvalMode: data.approvalMode, // "any", "all", or "sequential"
      approverIds: data.approvers?.map((a) => a.value) || [], // Array of user IDs
      autoApproveEnabled: data.autoApproval || false,
      autoApproveAfter:
        data.autoApproval && data.autoApproveAfter
          ? data.autoApproveAfter
          : null,

      // Include approver order for sequential mode (frontend reference only, backend rebuilds from approverIds)
      approverOrder:
        watchedApprovalMode === "sequential" ? approverOrder : null,
    };

    console.log("📋 [APPROVAL FORM] Submitting approval task data:", formData);
    console.log("📋 [APPROVAL FORM] Approval mode:", formData.approvalMode);
    console.log("📋 [APPROVAL FORM] Approver IDs:", formData.approverIds);
    console.log(
      "📋 [APPROVAL FORM] Auto-approval enabled:",
      formData.autoApproveEnabled,
    );
    console.log(
      "📋 [APPROVAL FORM] Auto-approve after:",
      formData.autoApproveAfter,
    );

    setIsSubmitting(true);
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-3">
      {/* Task Name */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Task Name <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            {...register("taskName", {
              required: "Task name is required",
              maxLength: {
                value: 100,
                message: "Task name cannot exceed 100 characters",
              },
            })}
            type="text"
            maxLength={100}
            className="w-full h-8 min-h-8 max-h-8 box-border px-3 pr-16 py-0 border border-gray-300 rounded-md text-sm leading-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            style={{
              height: "32px",
              minHeight: "32px",
              maxHeight: "32px",
              paddingTop: 0,
              paddingBottom: 0,
            }}
            placeholder="Enter task name..."
            data-testid="input-task-name"
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
              className="border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="Describe what needs approval..."
            />
          )}
        />
      </div>

      {/* Approvers */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Approvers <span className="text-red-500">*</span>
          {isLoadingApprovers && (
            <Loader2 className="w-4 h-4 animate-spin inline-block ml-2" />
          )}
        </label>
        <Controller
          name="approvers"
          control={control}
          rules={{
            required: "At least one approver must be assigned",
            validate: (value) => {
              if (!value || value.length === 0) {
                return "At least one approver must be assigned";
              }
              return true;
            },
          }}
          render={({ field }) => (
            <Select
              {...field}
              menuPlacement="auto"
              isMulti
              options={approverOptions}
              isLoading={isLoadingApprovers}
              className="react-select-container h-8-select"
              classNamePrefix="react-select"
              placeholder={
                isLoadingApprovers
                  ? "Loading approvers..."
                  : "Search and select approvers..."
              }
              noOptionsMessage={() =>
                isLoadingApprovers ? "Loading..." : "No approvers available"
              }
              formatOptionLabel={(option, { context }) => {
                const roles = Array.isArray(option.role)
                  ? option.role
                  : option.role
                    ? [option.role]
                    : [];
                const displayName =
                  option.name || option.label?.split(" (")[0] || "User";

                if (context === "value") {
                  return (
                    <div className="flex items-center gap-1.5 max-w-full h-full my-auto">
                      <span className="truncate font-medium leading-none">
                        {displayName}
                      </span>
                      {roles.slice(0, 1).map((r) => {
                        const getRoleBadgeClass = (roleName) => {
                          switch (String(roleName).toLowerCase()) {
                            case "org_admin":
                              return "bg-red-50 text-red-700 border-red-200";
                            case "manager":
                              return "bg-blue-50 text-blue-700 border-blue-200";
                            case "employee":
                              return "bg-green-50 text-green-700 border-green-200";
                            default:
                              return "bg-gray-50 text-gray-700 border-gray-200";
                          }
                        };
                        return (
                          <span
                            key={r}
                            className={`text-[10px] font-bold px-2 py-[2px] rounded border uppercase tracking-wider leading-none flex items-center justify-center ${getRoleBadgeClass(r)}`}
                          >
                            {r}
                          </span>
                        );
                      })}
                      {option.isSelf && (
                        <span className="text-[10px] font-bold px-2 py-[2px] rounded border border-amber-200 bg-amber-50 text-amber-700 uppercase tracking-wider leading-none flex items-center justify-center">
                          You
                        </span>
                      )}
                    </div>
                  );
                }

                return (
                  <div className="flex items-center justify-between w-full flex-wrap gap-1">
                    <span className="truncate text-gray-900 font-medium">
                      {displayName}{" "}
                      <span className="text-gray-500 font-normal">
                        ({option.email})
                      </span>
                    </span>
                    <div className="flex gap-1 items-center">
                      {roles.map((r) => {
                        const getRoleBadgeClass = (roleName) => {
                          switch (String(roleName).toLowerCase()) {
                            case "org_admin":
                              return "bg-red-50 text-red-700 border-red-200";
                            case "manager":
                              return "bg-blue-50 text-blue-700 border-blue-200";
                            case "employee":
                              return "bg-green-50 text-green-700 border-green-200";
                            default:
                              return "bg-gray-50 text-gray-700 border-gray-200";
                          }
                        };
                        return (
                          <span
                            key={r}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wider ${getRoleBadgeClass(r)}`}
                          >
                            {r}
                          </span>
                        );
                      })}
                      {option.isSelf && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700 uppercase tracking-wider">
                          You
                        </span>
                      )}
                    </div>
                  </div>
                );
              }}
              data-testid="select-approvers"
            />
          )}
        />
        <p className="text-xs text-gray-500 mt-1">
          Task creator is not auto-added as approver unless explicitly selected
        </p>
        {errors.approvers && (
          <p className="text-red-500 text-xs mt-1 flex items-center">
            <AlertCircle className="w-3 h-3 mr-1" />
            {errors.approvers.message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Approval Mode */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1 flex items-center">
            Approval Mode <span className="text-red-500">*</span>
            <div className="relative group ml-2">
              <Info className="w-4 h-4 text-gray-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-72 z-10">
                <div className="flex space-x-1 mt-1">
                  <div>
                    <strong>Any One:</strong> First approver's decision is final
                  </div>
                  <div>
                    <strong>All Must Approve:</strong> Every approver must
                    approve
                  </div>
                  <div>
                    <strong>Sequential:</strong> Approvers review in order
                  </div>
                </div>
              </div>
            </div>
          </label>
          <div className="flex space-x-3">
            {approvalModeOptions.map((option) => (
              <label key={option.value} className="flex items-center">
                <input
                  {...register("approvalMode")}
                  type="radio"
                  value={option.value}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  data-testid={`radio-approval-${option.value}`}
                />
                <span className="ml-2 text-sm text-gray-900">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Auto-Approval */}
        <div>
          <div className="flex items-center space-x-3">
            <input
              {...register("autoApproval")}
              type="checkbox"
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 align-middle"
              data-testid="checkbox-auto-approval"
            />
            <label className="text-sm font-medium text-gray-900 select-none">
              Enable Auto-Approval
            </label>
          </div>
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
                const autoApproveDate = new Date(value);
                const dueDate = new Date(watchedDueDate);
                return (
                  autoApproveDate >= dueDate ||
                  "Auto-approval date must be on or after the due date"
                );
              },
            })}
            type="datetime-local"
            min={watchedDueDate || getTodayDate()}
            disabled={!watchedAutoApproval}
            className={`w-full h-8 min-h-8 max-h-8 box-border px-3 py-0 border rounded-md text-sm leading-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              watchedAutoApproval
                ? "border-gray-300"
                : "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
            style={{
              height: "32px",
              minHeight: "32px",
              maxHeight: "32px",
              paddingTop: 0,
              paddingBottom: 0,
            }}
            data-testid="input-auto-approval-date"
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

      {/* Sequential Order - Only show if Sequential mode */}
      {watchedApprovalMode === "sequential" && approverOrder.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Approval Order
          </label>
          <div className="space-y-1.5 bg-gray-50 p-3 rounded-md border border-gray-200">
            {approverOrder.map((approver, index) => (
              <div
                key={approver.value}
                className="flex items-center justify-between bg-white px-2 py-1 rounded-md border border-gray-200 shadow-sm hover:shadow transition-all duration-150"
              >
                <div className="flex items-center space-x-2">
                  <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-semibold">
                    {index + 1}
                  </span>
                  <span
                    className="text-sm font-medium text-gray-800 truncate"
                    title={approver.label}
                  >
                    {approver.label}
                  </span>
                </div>

                <div className="flex items-center space-x-0.5">
                  <Button
                    type="button"
                    onClick={() => moveApproverUp(index)}
                    disabled={index === 0}
                    variant="ghost"
                    size="icon"
                    className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    data-testid={`button-move-up-${index}`}
                    title="Move Up"
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    onClick={() => moveApproverDown(index)}
                    disabled={index === approverOrder.length - 1}
                    variant="ghost"
                    size="icon"
                    className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    data-testid={`button-move-down-${index}`}
                    title="Move Down"
                  >
                    📋 ↓
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-500 mt-1">
            Approvers will review in this order. Use arrows to reorder.
          </p>
        </div>
      )}

      <div className={`grid ${!drawer ? "grid-cols-3" : "grid-cols-2"} gap-3`}>
        {/* Approval Due Date */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Approval Due Date <span className="text-red-500">*</span>
          </label>
          <input
            {...register("dueDate", {
              required: "Approval due date is required",
              validate: (value) => {
                const today = getTodayDate();
                return (
                  value >= today || "Approval due date must be today or later"
                );
              },
            })}
            type="datetime-local"
            min={getTodayDate()}
            className="w-full h-8 min-h-8 max-h-8 box-border px-3 py-0 border border-gray-300 rounded-md text-sm leading-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            style={{
              height: "32px",
              minHeight: "32px",
              maxHeight: "32px",
              paddingTop: 0,
              paddingBottom: 0,
            }}
            data-testid="input-due-date"
          />
          {errors.dueDate && (
            <p className="text-red-500 text-xs mt-1 flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" />
              {errors.dueDate.message}
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
                placeholder="Select priority..."
                data-testid="select-priority"
              />
            )}
          />
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
                isDisabled={!isOrgUser}
                placeholder={
                  isOrgUser ? "Search and select assignee..." : "Self"
                }
                required={isOrgUser}
                data-testid="select-assigned-to"
              />
            )}
          />
          <p className="text-xs text-gray-500 mt-1">
            Search by name, email, department, or designation
          </p>
          {errors.assignedTo && (
            <p className="text-red-500 text-xs mt-1 flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" />
              {errors.assignedTo.message}
            </p>
          )}
        </div>
      </div>

      {/* Collaborators */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1 flex items-center">
          <Users className="w-4 h-4 mr-1" />
          Collaborators
          {isLoadingCollaborators && (
            <Loader2 className="w-4 h-4 animate-spin ml-2" />
          )}
        </label>
        <Controller
          name="collaborators"
          control={control}
          render={({ field }) => (
            <Select
              {...field}
              menuPlacement="auto"
              isMulti
              options={collaboratorOptions.filter(
                (opt) =>
                  opt.value !== "self" &&
                  !watchedApprovers?.some(
                    (approver) => approver.value === opt.value,
                  ),
              )}
              isLoading={isLoadingCollaborators}
              className="react-select-container h-8-select"
              classNamePrefix="react-select"
              placeholder={
                isLoadingCollaborators
                  ? "Loading collaborators..."
                  : "Select collaborators for notifications..."
              }
              noOptionsMessage={() =>
                isLoadingCollaborators
                  ? "Loading..."
                  : "No collaborators available"
              }
              formatOptionLabel={(option, { context }) => {
                const roles = Array.isArray(option.role)
                  ? option.role
                  : option.role
                    ? [option.role]
                    : [];
                const displayName =
                  option.name || option.label?.split(" (")[0] || "User";

                if (context === "value") {
                  return (
                    <div className="flex items-center gap-1.5 max-w-full h-full my-auto">
                      <span className="truncate font-medium leading-none">
                        {displayName}
                      </span>
                      {roles.slice(0, 1).map((r) => {
                        const getRoleBadgeClass = (roleName) => {
                          switch (String(roleName).toLowerCase()) {
                            case "org_admin":
                              return "bg-red-50 text-red-700 border-red-200";
                            case "manager":
                              return "bg-blue-50 text-blue-700 border-blue-200";
                            case "employee":
                              return "bg-green-50 text-green-700 border-green-200";
                            default:
                              return "bg-gray-50 text-gray-700 border-gray-200";
                          }
                        };
                        return (
                          <span
                            key={r}
                            className={`text-[10px] font-bold px-2 py-[2px] rounded border uppercase tracking-wider leading-none flex items-center justify-center ${getRoleBadgeClass(r)}`}
                          >
                            {r}
                          </span>
                        );
                      })}
                      {option.isSelf && (
                        <span className="text-[10px] font-bold px-2 py-[2px] rounded border border-amber-200 bg-amber-50 text-amber-700 uppercase tracking-wider leading-none flex items-center justify-center">
                          You
                        </span>
                      )}
                    </div>
                  );
                }

                return (
                  <div className="flex items-center justify-between w-full flex-wrap gap-1">
                    <span className="truncate text-gray-900 font-medium">
                      {displayName}{" "}
                      <span className="text-gray-500 font-normal">
                        ({option.email})
                      </span>
                    </span>
                    <div className="flex gap-1 items-center">
                      {roles.map((r) => {
                        const getRoleBadgeClass = (roleName) => {
                          switch (String(roleName).toLowerCase()) {
                            case "org_admin":
                              return "bg-red-50 text-red-700 border-red-200";
                            case "manager":
                              return "bg-blue-50 text-blue-700 border-blue-200";
                            case "employee":
                              return "bg-green-50 text-green-700 border-green-200";
                            default:
                              return "bg-gray-50 text-gray-700 border-gray-200";
                          }
                        };
                        return (
                          <span
                            key={r}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wider ${getRoleBadgeClass(r)}`}
                          >
                            {r}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              }}
              data-testid="select-collaborators"
            />
          )}
        />
        <p className="text-xs text-gray-500 mt-1">
          Collaborators will be notified but are not approvers
        </p>
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
      </div>

      {/* Restrictions Information */}
      {/* <div className="bg-amber-50 border border-amber-200 rounded-sm p-4">
        <div className="flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-amber-900">
              Approval Task Restrictions
            </h4>
            <ul className="text-xs text-amber-700 mt-1 space-y-1">
              <li>Approvers cannot be changed after first approval action</li>
              <li>
                Cannot revert approval task back to normal task once created
              </li>
              <li>Task creator must explicitly choose to be an approver</li>
            </ul>
          </div>
        </div>
      </div> */}

      {/* Attachments */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Attachments
          <span className="text-xs text-gray-500 ml-2">(Max 5MB total)</span>
        </label>
        <div
          className={`w-full border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${isDragActive ? "border-blue-500 bg-blue-50" : "border-blue-300 bg-white"}`}
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
          data-testid="dropzone-attachments"
        >
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center bg-blue-100 text-blue-600">
            +
          </div>
          <p className="text-sm font-semibold text-blue-600">
            Drag & Drop files
          </p>
          <p className="text-xs text-gray-500">PDF, DOC, images supported</p>
        </div>
        <input
          ref={attachmentsInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
          onChange={handleFileUpload}
          className="hidden"
          data-testid="input-attachments"
        />

        {/* File List */}
        {uploadedFiles.length > 0 && (
          <div className="mt-3 space-y-1">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between bg-gray-50 px-2 rounded"
              >
                <div className="flex items-center space-x-2">
                  <svg
                    className="w-4 h-4 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="text-sm text-gray-700">{file.name}</span>
                  <span className="text-xs text-gray-500">
                    ({formatFileSize(file.size)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="text-red-500 hover:text-red-700 text-sm"
                  data-testid={`remove-file-${file.id}`}
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

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 mt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => window.history.back()}
          data-testid="button-cancel"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          className="bg-blue-600 hover:bg-blue-700 text-white"
          disabled={
            isLoadingApprovers || isLoadingCollaborators || isSubmitting
          }
          data-testid="button-save"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Approval Task"
          )}
        </Button>
      </div>
    </form>
  );
};

export default ApprovalTaskForm;
