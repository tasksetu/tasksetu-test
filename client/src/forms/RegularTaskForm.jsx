import React, { useState, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import CustomEditor from "../components/common/CustomEditor";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import AssigneeSearchSelect from "../components/common/AssigneeSearchSelect";
import { useShowToast } from "@/utils/ToastMessage";
import { Button, IconButton } from "@/components/ui/button";
import {
  FormField,
  FormFieldRow,
  FormActions,
} from "@/components/ui/form-field";
import { getReactSelectStyles } from "@/components/ui/design-system.config";
import { useTaskPriorities } from "@/hooks/useTaskPriorities";
import { getDefaultPriorityCode } from "@/utils/priorityUtils";

// Advanced Fields Modal Component
const AdvancedFieldsModal = ({
  isOpen,
  onClose,
  onSubmit,
  defaultValues = {},
}) => {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    defaultValues: {
      referenceProcess: null,
      customForm: null,
      dependencies: [],
      taskType: { value: "Simple", label: "Simple" },
      ...defaultValues,
    },
  });

  if (!isOpen) return null;

  const processOptions = [];

  const formOptions = [];

  const dependencyOptions = [];

  const taskTypeOptions = [
    { value: "Simple", label: "Simple" },
    { value: "Recurring", label: "Recurring" },
    { value: "Approval", label: "Approval" },
  ];

  console.log("onSubmit in AdvancedFieldsModal:", onSubmit);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Advanced Options
          </h3>
          <IconButton
            onClick={onClose}
            variant="ghost"
            data-testid="close-advanced-modal"
          >
            <svg
              className="w-5 h-5 text-gray-600"
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
          </IconButton>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-3">
          {/* Reference Process */}
          <div>
            <label className="block text-sm font-medium text-gray-900  mb-1">
              Reference Process
            </label>
            <Controller
              name="referenceProcess"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  menuPlacement="auto"
                  options={processOptions}
                  isSearchable
                  isClearable
                  className="react-select-container"
                  classNamePrefix="react-select"
                  placeholder="Link to a predefined process..."
                  data-testid="select-reference-process"
                />
              )}
            />
          </div>

          {/* Custom Form */}
          <div>
            <label className="block text-sm font-medium text-gray-900  mb-1">
              Custom Form
            </label>
            <Controller
              name="customForm"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  menuPlacement="auto"
                  options={formOptions}
                  isSearchable
                  isClearable
                  className="react-select-container"
                  classNamePrefix="react-select"
                  placeholder="Attach existing form template..."
                  data-testid="select-custom-form"
                />
              )}
            />
          </div>

          {/* Dependencies */}
          <div>
            <label className="block text-sm font-medium text-gray-900  mb-1">
              Dependencies
            </label>
            <Controller
              name="dependencies"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  menuPlacement="auto"
                  isMulti
                  options={dependencyOptions}
                  isSearchable
                  className="react-select-container"
                  classNamePrefix="react-select"
                  placeholder="Select prerequisite tasks..."
                  data-testid="select-dependencies"
                />
              )}
            />
            <p className="text-xs text-gray-500 mt-1">
              Tasks that must be completed before this one starts
            </p>
          </div>

          {/* Task Type */}
          <div>
            <label className="block text-sm font-medium text-gray-900  mb-1">
              Task Type <span className="text-red-500">*</span>
            </label>
            <Controller
              name="taskType"
              control={control}
              rules={{ required: "Task type is required" }}
              render={({ field }) => (
                <Select
                  {...field}
                  menuPlacement="auto"
                  options={taskTypeOptions}
                  className="react-select-container"
                  classNamePrefix="react-select"
                  placeholder="Select task type..."
                  data-testid="select-task-type"
                />
              )}
            />
            {errors.taskType && (
              <p className="text-red-500 text-xs mt-1">
                {errors.taskType.message}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-testid="button-advanced-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="gradient"
              data-testid="button-advanced-save"
            >
              Apply Advanced Options
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main Regular Task Form Component
const RegularTaskForm = ({
  onSubmit,
  onCancel,
  isOrgUser = false,
  defaultValues = {},
  collaboratorOptions = [],
  isLoadingCollaborators = false,
  drawer = false,
  isSubmitting = false,
}) => {
  const { showSuccessToast, showErrorToast } = useShowToast();
  const { data: taskPriorities = [] } = useTaskPriorities();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      taskName: "",
      description: "",
      assignedTo: isOrgUser ? null : { value: "self", label: "Self" },
      priority: { value: "medium", label: "Medium" }, // Will be updated by useEffect
      dueDate: "",
      visibility: "private",
      tags: [],
      attachments: [],
      ...defaultValues,
    },
  });

  const [attachmentSize, setAttachmentSize] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
  const [advancedData, setAdvancedData] = useState({});
  const attachmentsInputRef = useRef(null);
  const isFirstRender = useRef(true);
  const watchedPriority = watch("priority");

  // Set default priority when taskPriorities loads
  useEffect(() => {
    if (
      taskPriorities &&
      taskPriorities.length > 0 &&
      !defaultValues.priority
    ) {
      const priorityOptions = taskPriorities
        .filter((p) => p && p.active)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((p) => ({ value: p.code, label: p.label }));
      const defaultCode = getDefaultPriorityCode(taskPriorities);
      const defaultOption = priorityOptions.find(
        (p) => p.value === defaultCode,
      ) ||
        priorityOptions[0] || { value: "medium", label: "Medium" };
      setValue("priority", defaultOption);
    }
  }, [taskPriorities, setValue, defaultValues.priority]);

  // Update form when defaultValues prop changes (for Quick Task prefilling)
  useEffect(() => {
    if (defaultValues && Object.keys(defaultValues).length > 0) {
      console.log("🔄 Resetting form with defaultValues:", defaultValues);
      isFirstRender.current = true; // Reset first render flag so we preserve the new due date
      const priorityOptions = (taskPriorities || [])
        .filter((p) => p && p.active)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((p) => ({ value: p.code, label: p.label }));
      const defaultCode = getDefaultPriorityCode(taskPriorities);
      const defaultPriority = priorityOptions.find(
        (p) => p.value === defaultCode,
      ) ||
        priorityOptions[0] || { value: "medium", label: "Medium" };

      reset({
        taskName: "",
        description: "",
        assignedTo: isOrgUser ? null : { value: "self", label: "Self" },
        priority: defaultPriority,
        dueDate: "",
        visibility: "private",
        tags: [],
        attachments: [],
        ...defaultValues,
      });
    }
  }, [defaultValues, reset, isOrgUser, taskPriorities]);

  // Legacy prefill support - for backward compatibility
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const fromQuickTask = searchParams.get("from_quick_task");

    if (fromQuickTask) {
      console.log("🔄 Checking for Quick Task data:", fromQuickTask);

      // Try sessionStorage first (new method)
      let quickTaskData = sessionStorage.getItem("convertingQuickTask");

      // Fallback to localStorage with old key pattern
      if (!quickTaskData) {
        quickTaskData = localStorage.getItem(`quick_task_${fromQuickTask}`);
      }

      if (quickTaskData) {
        try {
          const taskData = JSON.parse(quickTaskData);
          console.log("📋 Quick Task Data from storage:", taskData);

          if (taskData.title) {
            console.log("✅ Setting title:", taskData.title);
            setValue("taskName", taskData.title);
          }

          if (taskData.priority) {
            const priorityValue = String(taskData.priority)
              .trim()
              .toLowerCase();
            const priorityOption = priorityOptions.find(
              (option) => String(option.value).toLowerCase() === priorityValue,
            );
            console.log("✅ Setting priority:", priorityOption);
            if (priorityOption) {
              setValue("priority", priorityOption);
            }
          }

          if (taskData.dueDate && taskData.dueDate !== "") {
            try {
              const date = new Date(taskData.dueDate);
              if (!isNaN(date.getTime())) {
                // If only date (no time), default to current time
                if (taskData.dueDate.length <= 10) {
                  const now = new Date();
                  date.setHours(now.getHours(), now.getMinutes());
                }
                const formattedDate = toDatetimeLocal(date);
                console.log(
                  "✅ Setting due date:",
                  formattedDate,
                  "from",
                  taskData.dueDate,
                );
                setValue("dueDate", formattedDate);
              }
            } catch (dateError) {
              console.error("❌ Error formatting due date:", dateError);
            }
          }

          // Clean up localStorage after use
          localStorage.removeItem(`quick_task_${fromQuickTask}`);
        } catch (error) {
          console.error("❌ Error parsing Quick Task data:", error);
        }
      } else {
        console.log("❌ No Quick Task data found in localStorage");
      }
    }
  }, [setValue]);

  // Auto-set due date based on priority (only if not from Quick Task OR if no due date was prefilled)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const fromQuickTask = searchParams.get("from_quick_task");

    // Skip auto-setting on first render ONLY if converting from Quick Task and it has a prefilled due date
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (fromQuickTask && defaultValues?.dueDate) {
        return; // Preserve the prefilled due date on initial load
      }
    }

    // Only auto-set due date if priority is selected
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
      setValue("dueDate", toDatetimeLocal(dueDate));
    }
  }, [watchedPriority, setValue, taskPriorities, defaultValues?.dueDate]);

  // Priority options
  const priorityOptions = (Array.isArray(taskPriorities) ? taskPriorities : [])
    .filter((p) => p && p.active)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((p) => ({ value: p.code, label: p.label }));

  // Assignment options (for org users)
  const assignmentOptions = isOrgUser
    ? [{ value: "self", label: "Self" }, ...collaboratorOptions]
    : [{ value: "self", label: "Self" }];

  // Debug logging
  console.log("RegularTaskForm - Assignment Debug:", {
    isOrgUser,
    collaboratorOptionsCount: collaboratorOptions.length,
    collaboratorOptions,
    assignmentOptions,
    isLoadingCollaborators,
  });

  // Shared attachment processing for click + drag/drop flows
  const processFiles = (files) => {
    if (!files || files.length === 0) return;
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const currentSize = uploadedFiles.reduce((sum, file) => sum + file.size, 0);

    if (currentSize + totalSize > 5 * 1024 * 1024) {
      // 5MB limit
      showErrorToast("Total file size cannot exceed 5MB");
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

  const handleAdvancedSubmit = (data) => {
    setAdvancedData(data);
    setShowAdvancedModal(false);
  };

  const onFormSubmit = (data) => {
    console.log("🔍 REGULAR FORM DEBUG - Form submission started");
    console.log("🔍 REGULAR FORM DEBUG - Raw form data:", data);
    console.log("🔍 REGULAR FORM DEBUG - Priority value:", data.priority);
    console.log("🔍 REGULAR FORM DEBUG - Priority type:", typeof data.priority);

    const formData = {
      ...data,
      ...advancedData,
      attachments: uploadedFiles,
    };

    if (typeof onSubmit === "function") {
      onSubmit(formData);
    } else {
      showErrorToast("onSubmit is not a function!");
      console.error("onSubmit is not a function!", onSubmit);
    }
  };

  const toDatetimeLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const getCurrentDateTime = () => toDatetimeLocal(new Date());

  return (
    <>
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-3">
        {/* Task Name */}
        <div>
          <label className="block text-sm font-medium text-gray-900  mb-1">
            Task Name <span className="text-red-500">*</span>
          </label>
          <Controller
            name="taskName"
            control={control}
            rules={{
              required: "Task name is required",
              maxLength: {
                value: 100,
                message: "Task name cannot exceed 100 characters",
              },
            }}
            render={({ field }) => (
              <div className="relative">
                <input
                  {...field}
                  type="text"
                  maxLength={100}
                  value={field.value || ""}
                  onChange={(e) => {
                    const v = (e.target.value || "").slice(0, 100);
                    field.onChange(v);
                    try {
                      if (typeof setTaskNameLength === "function")
                        setTaskNameLength(v.length);
                    } catch (err) {}
                  }}
                  className="w-full h-8 min-h-8 max-h-8 box-border px-3 pr-12 py-0 border border-gray-300 rounded-md text-sm leading-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Enter task name..."
                  data-testid="input-task-name"
                  style={{
                    height: "32px",
                    minHeight: "32px",
                    maxHeight: "32px",
                    paddingTop: 0,
                    paddingBottom: 0,
                  }}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                  {field.value?.length || 0}/100
                </div>
              </div>
            )}
          />
          {errors.taskName && (
            <p className="text-red-500 text-xs mt-1">
              {errors.taskName.message}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-900  mb-1">
            Description
          </label>
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <CustomEditor
                value={field.value}
                onChange={field.onChange}
                placeholder="Describe your task..."
                className="regular-task-compact-editor border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            )}
          />
        </div>

        <div
          className={`grid ${
            !drawer
              ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
              : "grid-cols-1 sm:grid-cols-2"
          } gap-3`}
        >
          {/* Priority */}

          {/* Assigned To */}
          <div>
            <label className=" block text-sm font-medium text-gray-900  mb-1">
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
              Search by name, email, department, or designations
            </p>
            {errors.assignedTo && (
              <p className="text-red-500 text-xs mt-1">
                {errors.assignedTo.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900  mb-1">
              Priority <span className="text-red-500">*</span>
            </label>
            <Controller
              name="priority"
              control={control}
              rules={{ required: "Priority is required" }}
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
            {errors.priority && (
              <p className="text-red-500 text-xs mt-1">
                {errors.priority.message}
              </p>
            )}
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-gray-900  mb-1">
              Due Date <span className="text-red-500">*</span>
            </label>
            <Controller
              name="dueDate"
              control={control}
              rules={{
                required: "Due date is required",
                validate: (value) => {
                  const now = getCurrentDateTime();
                  return value >= now || "Due date must be today or later";
                },
              }}
              render={({ field }) => (
                <input
                  {...field}
                  type="datetime-local"
                  min={getCurrentDateTime()}
                  className="w-full h-8 min-h-8 max-h-8 box-border px-3 py-0 border border-gray-300 rounded-md text-sm leading-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  data-testid="input-due-date"
                  style={{
                    height: "32px",
                    minHeight: "32px",
                    maxHeight: "32px",
                    paddingTop: 0,
                    paddingBottom: 0,
                  }}
                />
              )}
            />
            {errors.dueDate && (
              <p className="text-red-500 text-xs mt-1">
                {errors.dueDate.message}
              </p>
            )}
          </div>
          {/* Tags */}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Labels / Tags
          </label>
          <Controller
            name="tags"
            control={control}
            defaultValue={[]}
            render={({ field }) => {
              const [tagInput, setTagInput] = React.useState("");
              const tags = field.value || [];

              const addTag = () => {
                const trimmedTag = tagInput.trim();
                if (trimmedTag && !tags.includes(trimmedTag)) {
                  field.onChange([...tags, trimmedTag]);
                  setTagInput("");
                }
              };

              const removeTag = (tagToRemove) => {
                field.onChange(tags.filter((tag) => tag !== tagToRemove));
              };

              return (
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      placeholder="Type tag and press Enter or comma..."
                      className="w-full h-8 min-h-8 max-h-8 box-border px-3 pr-10 py-0 border border-gray-300 rounded-md text-sm leading-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      data-testid="input-tag-text"
                      style={{
                        height: "32px",
                        minHeight: "32px",
                        maxHeight: "32px",
                        paddingTop: 0,
                        paddingBottom: 0,
                      }}
                    />
                    <Button
                      type="button"
                      onClick={addTag}
                      variant="primary"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                      title="Add tag"
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
                    </Button>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                      {tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                        >
                          {tag}
                          <Button
                            type="button"
                            onClick={() => removeTag(tag)}
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 p-0 hover:text-indigo-900"
                          >
                            ×
                          </Button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900  mb-1">
            Visibility <span className="text-red-500">*</span>
          </label>
          <Controller
            name="visibility"
            control={control}
            defaultValue="private"
            render={({ field }) => (
              <div className="flex space-x-3">
                <label className="flex items-center">
                  <input
                    {...field}
                    type="radio"
                    value="private"
                    checked={field.value === "private"}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    data-testid="radio-private"
                  />
                  <span className="ml-2 text-sm text-gray-900">Private</span>
                </label>

                {isOrgUser && (
                  <label className="flex items-center">
                    <input
                      {...field}
                      type="radio"
                      value="team"
                      checked={field.value === "team"}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      data-testid="radio-team"
                    />
                    <span className="ml-2 text-sm text-gray-900">Team</span>
                  </label>
                )}
              </div>
            )}
          />
        </div>

        {/* Attachments */}
        <div>
          <label className="block text-sm font-medium text-gray-900  mb-1">
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
                  <Button
                    type="button"
                    onClick={() => removeFile(file.id)}
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-700"
                    data-testid={`remove-file-${file.id}`}
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </Button>
                </div>
              ))}
              <div className="text-xs text-gray-500">
                Total size: {formatFileSize(attachmentSize)} / 5MB
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-6">
          {/* <Button
            type="button"
            variant="outline"
            onClick={() => setShowAdvancedModal(true)}
            data-testid="button-more-options">
            More Options ▸
          </Button> */}
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
              "Save Regular Task"
            )}
          </Button>
        </div>
      </form>

      {/* Advanced Fields Modal */}
      <AdvancedFieldsModal
        isOpen={showAdvancedModal}
        onClose={() => setShowAdvancedModal(false)}
        onSubmit={handleAdvancedSubmit}
        defaultValues={advancedData}
      />
    </>
  );
};

export default RegularTaskForm;
  