import React, { useState, useEffect } from "react";
import CustomEditor from "../../components/common/CustomEditor";
import SearchableSelect from "../SearchableSelect";
import { calculateDueDateFromPriority } from "./PriorityManager";
import { useTaskPriorities } from "@/hooks/useTaskPriorities";
import useTasksStore from "../../stores/tasksStore";
import { useShowToast } from "@/utils/ToastMessage";
import { Button } from "@/components/ui/button";

export default function SubtaskCreator({
  parentTask,
  onClose,
  onSubtaskCreated,
  isInline = false,
}) {
  const { showSuccessToast, showErrorToast } = useShowToast();
  const { addSubtask } = useTasksStore();
  const { data: taskPriorities = [] } = useTaskPriorities();

  const getDefaultPriority = () => {
    const defaultPriority = taskPriorities.find((p) => p.isDefault);
    return defaultPriority?.code || "medium";
  };

  const [formData, setFormData] = useState({
    name: "New Sub-task",
    assignee: "self", // Default to self
    assigneeId: 1, // Mock current user ID
    dueDate: parentTask?.dueDate || "",
    priority: getDefaultPriority(),
    status: "To Do",
    visibility: parentTask?.visibility || "private",
    notes: "",
    attachments: [],
  });

  const [dragActive, setDragActive] = useState(false);
  const [isManualDueDate, setIsManualDueDate] = useState(false);
  const [errors, setErrors] = useState({});
  const [userType] = useState("company"); // Mock user type - would come from auth context

  // Team members - empty for production - fetch from API
  const teamMembers = [];

  // Auto-calculate due date when priority changes (unless manually overridden)
  useEffect(() => {
    if (!isManualDueDate && formData.priority) {
      let calculatedDueDate = calculateDueDateFromPriority(formData.priority);

      // Ensure sub-task due date doesn't exceed parent due date
      if (parentTask?.dueDate && calculatedDueDate > parentTask.dueDate) {
        calculatedDueDate = parentTask.dueDate;
      }

      setFormData((prev) => ({
        ...prev,
        dueDate: calculatedDueDate,
      }));
    }
  }, [formData.priority, isManualDueDate, parentTask?.dueDate]);

  const handleInputChange = (field, value) => {
    if (field === "dueDate") {
      setIsManualDueDate(true);

      // Validate due date doesn't exceed parent
      if (parentTask?.dueDate && value > parentTask.dueDate) {
        setErrors((prev) => ({
          ...prev,
          dueDate:
            "Subtask due date must be on or before the parent task due date.",
        }));
        return;
      } else {
        setErrors((prev) => ({ ...prev, dueDate: null }));
      }
    }

    if (field === "name" && value.length > 60) {
      return; // Max 60 chars limit
    }

    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear specific field errors
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Sub-task name is required";
    }

    if (!formData.assignee) {
      newErrors.assignee = "Assignee is required";
    }

    if (!formData.dueDate) {
      newErrors.dueDate = "Due date is required";
    }

    // Validate subtask due date against parent task due date
    if (
      formData.dueDate &&
      parentTask?.dueDate &&
      formData.dueDate > parentTask.dueDate
    ) {
      newErrors.dueDate =
        "Subtask due date must be on or before the parent task due date.";
    }

    if (userType === "individual" && formData.assignee !== "self") {
      newErrors.assignee = "You can only assign to yourself in individual mode";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Create sub-task object
    const newSubtask = {
      id: Date.now() + Math.random(),
      parentTaskId: parentTask.id,
      name: formData.name.trim(),
      assignee:
        formData.assignee === "self"
          ? "Current User"
          : teamMembers.find((m) => m.value === formData.assignee)?.name ||
            formData.assignee,
      assigneeId:
        formData.assignee === "self"
          ? 1
          : teamMembers.find((m) => m.value === formData.assignee)?.id || 2,
      dueDate: formData.dueDate,
      priority: formData.priority,
      status: formData.status,
      visibility: formData.visibility,
      notes: formData.notes,
      attachments: formData.attachments,
      createdAt: new Date().toISOString(),
      createdBy: 1, // Current user ID
      isSubtask: true,
    };

    // Add to store
    addSubtask(parentTask.id, newSubtask);

    // Notify parent component
    if (onSubtaskCreated) {
      onSubtaskCreated(newSubtask);
    }

    // Show success message
    console.log("Sub-task created successfully:", newSubtask);

    // Close modal/form
    if (onClose) {
      onClose();
    }

    // Reset form if inline
    if (isInline) {
      setFormData({
        name: "New Sub-task",
        assignee: "self",
        assigneeId: 1,
        dueDate: parentTask?.dueDate || "",
        priority: "low",
        status: "To Do",
        visibility: parentTask?.visibility || "private",
        notes: "",
        attachments: [],
      });
      setIsManualDueDate(false);
    }
  };

  // File upload handlers
  const handleFiles = async (fileList) => {
    try {
      // Import file upload service
      const { default: FileUploadService } =
        await import("../../utils/fileUpload.js");

      const { validFiles, errors } =
        await FileUploadService.uploadMultipleFiles(
          fileList,
          "subtask-attachments",
        );

      if (errors.length > 0) {
        showErrorToast(`File upload errors:\n${errors.join("\n")}`);
      }

      if (validFiles.length > 0) {
        setFormData((prev) => ({
          ...prev,
          attachments: [...prev.attachments, ...validFiles],
        }));
      }
    } catch (error) {
      showErrorToast(`Upload failed: ${error.message}`);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const removeFile = async (fileId) => {
    try {
      const { default: FileUploadService } =
        await import("../../utils/fileUpload.js");
      await FileUploadService.deleteFile(fileId);

      setFormData((prev) => ({
        ...prev,
        attachments: prev.attachments.filter((file) => file.id !== fileId),
      }));
    } catch (error) {
      console.error("Error removing file:", error);
      // Still remove from UI even if deletion fails
      setFormData((prev) => ({
        ...prev,
        attachments: prev.attachments.filter((file) => file.id !== fileId),
      }));
    }
  };

  const downloadFile = async (fileId, fileName) => {
    try {
      const { default: FileUploadService } =
        await import("../../utils/fileUpload.js");
      await FileUploadService.downloadFile(fileId, fileName);
    } catch (error) {
      showErrorToast(`Download failed: ${error.message}`);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div
      className={`subtask-creator ${isInline ? "inline-creator" : "modal-creator"}`}
    >
      {!isInline && (
        <div className="card-header mb-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Create Sub-task
              </h3>
              <p className="text-sm text-gray-600">
                Add a sub-task under:{" "}
                <span className="font-medium">{parentTask?.title}</span>
              </p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold w-8 h-8 flex items-center justify-center"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Parent Task Context */}
        <div className="bg-blue-50 border border-blue-200 rounded-sm p-3">
          <p className="text-sm text-blue-800">
            <span className="font-medium">Parent Task:</span>{" "}
            {parentTask?.title}
            <span className="ml-2 text-blue-600">
              (Due:{" "}
              {parentTask?.dueDate
                ? new Date(parentTask.dueDate).toLocaleDateString()
                : "No due date"}
              )
            </span>
          </p>
        </div>

        {/* Sub-task Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sub-task Name *
            <span
              className={`ml-2 text-sm ${formData.name.length >= 55 ? "text-red-500" : "text-gray-500"}`}
            >
              ({formData.name.length}/60)
            </span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
            className={`w-full px-3 h-9 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.name ? "border-red-500" : "border-gray-300"
            }`}
            placeholder="Enter sub-task name (max 60 chars)..."
            maxLength="60"
            required
          />
          {errors.name && (
            <p className="text-sm text-red-600 mt-1">{errors.name}</p>
          )}
          {formData.name.length >= 55 && (
            <p className="text-xs text-orange-600 mt-1">
              {60 - formData.name.length} characters remaining
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Assigned To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assigned To *
              {userType === "individual" && (
                <span className="text-xs text-gray-500 ml-2">(Self only)</span>
              )}
            </label>
            <SearchableSelect
              options={
                userType === "individual"
                  ? [{ value: "self", label: "Current User (Self)" }]
                  : teamMembers.map((member) => ({
                      value: member.value,
                      label: member.name,
                    }))
              }
              value={
                teamMembers.find((m) => m.value === formData.assignee)
                  ? {
                      value: formData.assignee,
                      label: teamMembers.find(
                        (m) => m.value === formData.assignee,
                      ).name,
                    }
                  : null
              }
              onChange={(selectedOption) =>
                handleInputChange("assignee", selectedOption?.value || "")
              }
              placeholder="Select assignee"
              isDisabled={userType === "individual"}
            />
            {errors.assignee && (
              <p className="text-sm text-red-600 mt-1">{errors.assignee}</p>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority
            </label>
            <SearchableSelect
              options={[
                { value: "low", label: "🟢 Low" },
                { value: "medium", label: "🟡 Medium" },
                { value: "high", label: "🟠 High" },
                { value: "critical", label: "🔴 Critical" },
              ]}
              value={{
                value: formData.priority,
                label:
                  formData.priority === "low"
                    ? "🟢 Low"
                    : formData.priority === "medium"
                      ? "🟡 Medium"
                      : formData.priority === "high"
                        ? "🟠 High"
                        : "🔴 Critical",
              }}
              onChange={(selectedOption) =>
                handleInputChange("priority", selectedOption.value)
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Due Date *
              {!isManualDueDate && (
                <span className="text-xs text-blue-600 ml-2">
                  (Auto from priority)
                </span>
              )}
            </label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => handleInputChange("dueDate", e.target.value)}
              className={`w-full px-3 h-9 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.dueDate ? "border-red-500" : "border-gray-300"
              }`}
              max={parentTask?.dueDate} // Can't exceed parent due date
              required
            />
            {errors.dueDate && (
              <p className="text-sm text-red-600 mt-1">{errors.dueDate}</p>
            )}
            {!isManualDueDate && (
              <p className="text-xs text-gray-500 mt-1">
                Auto-adjusted from priority. Limited by parent due date.
              </p>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Initial Status
            </label>
            <SearchableSelect
              options={[
                { value: "To Do", label: "📋 To Do" },
                { value: "In Progress", label: "🔄 In Progress" },
                { value: "Blocked", label: "🚫 Blocked" },
                { value: "Completed", label: "✅ Completed" },
              ]}
              value={{
                value: formData.status,
                label:
                  formData.status === "To Do"
                    ? "📋 To Do"
                    : formData.status === "In Progress"
                      ? "🔄 In Progress"
                      : formData.status === "Blocked"
                        ? "🚫 Blocked"
                        : "✅ Completed",
              }}
              onChange={(selectedOption) =>
                handleInputChange("status", selectedOption.value)
              }
            />
          </div>
        </div>

        {/* Visibility */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Visibility
            <span className="text-xs text-gray-500 ml-2">
              (Inherited from parent: {parentTask?.visibility})
            </span>
          </label>
          <SearchableSelect
            options={
              userType === "individual"
                ? [{ value: "private", label: "🔒 Private" }]
                : [
                    { value: "private", label: "🔒 Private" },
                    { value: "public", label: "🌐 Public" },
                  ]
            }
            value={{
              value: formData.visibility,
              label:
                formData.visibility === "public" ? "🌐 Public" : "🔒 Private",
            }}
            onChange={(selectedOption) =>
              handleInputChange("visibility", selectedOption.value)
            }
            isDisabled={userType === "individual"}
          />
          <p className="text-xs text-gray-500 mt-1">
            {userType === "individual"
              ? "Individual users can only create private sub-tasks"
              : "Can override parent visibility if needed"}
          </p>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes
          </label>
          <CustomEditor
            value={formData.notes}
            onChange={(value) => handleInputChange("notes", value)}
            placeholder="Add any additional notes for this sub-task..."
          />
        </div>

        {/* File Attachments */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Attachments
            {formData.attachments.length > 0 && (
              <span className="ml-2 text-sm text-blue-600">
                ({formData.attachments.length} file
                {formData.attachments.length !== 1 ? "s" : ""})
              </span>
            )}
          </label>

          <div
            className={`border-2 border-dashed rounded-sm p-4 text-center transition-colors ${
              dragActive
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-blue-400"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="space-y-2">
              <div className="text-gray-400">📎</div>
              <div>
                <label className="cursor-pointer">
                  <span className="text-blue-600 hover:text-blue-500 font-medium">
                    Upload files
                  </span>
                  <input
                    type="file"
                    className="sr-only"
                    multiple
                    onChange={(e) => handleFiles(e.target.files)}
                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.zip,.xlsx,.xls"
                  />
                </label>
                <p className="text-gray-500 text-sm">or drag and drop</p>
              </div>
            </div>
          </div>

          {/* Uploaded Files List */}
          {formData.attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {formData.attachments.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-md border"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">📎</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {file.name}
                      </p>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <span>{formatFileSize(file.size)}</span>
                        {file.status && (
                          <span
                            className={`px-2 py-1 rounded-full ${
                              file.status === "uploaded"
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {file.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => downloadFile(file.id, file.name)}
                      className="text-blue-500 hover:text-blue-700 text-sm px-2 py-1 rounded hover:bg-blue-50"
                      title="Download file"
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFile(file.id)}
                      className="text-red-500 hover:text-red-700 text-sm px-2 py-1 rounded hover:bg-red-50"
                      title="Remove file"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-between pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="gradient">
            Create Sub-task
          </Button>
        </div>
      </form>
    </div>
  );
}
