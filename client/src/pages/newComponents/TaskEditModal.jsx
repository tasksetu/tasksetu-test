import React, { useState, useEffect } from "react";
import CustomEditor from "../../components/common/CustomEditor";
import SearchableSelect from "../SearchableSelect";
import FileUploadComponent from "./FileUploadComponent";
import { Button } from "@/components/ui/button";
import { useTaskStatuses } from "../../hooks/useTaskStatuses";
import { useTaskPriorities } from "../../hooks/useTaskPriorities";
import { useAssignmentOptions } from "../../features/shared/hooks/useAssignmentOptions";
// Calculate due date based on priority
const calculateDueDateFromPriority = (priorityCode, taskPriorities = []) => {
  const today = new Date();
  const code = String(priorityCode || "").toLowerCase();
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
          : code === "urgent"
            ? 1
            : 14;
  const dueDate = new Date(today.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  return dueDate.toISOString().split("T")[0];
};

export default function TaskEditModal({ task, onSave, onClose, permissions }) {
  // Safety check - if no task is provided, close the modal
  if (!task) {
    console.error("TaskEditModal: No task provided");
    onClose();
    return null;
  }

  const { data: taskStatuses = [] } = useTaskStatuses();
  const { data: taskPriorities = [] } = useTaskPriorities();
  const { canAssignToOthers } = useAssignmentOptions();

  const [formData, setFormData] = useState({
    title: task?.title || "",
    description: task?.description || "",
    status: task?.status || "OPEN",
    priority: task?.priority || "medium",
    assignee: task?.assignee || "",
    assigneeId: task?.assigneeId || 1,
    dueDate: task?.dueDate || "",
    startDate: task?.startDate || "",
    timeEstimate: task?.timeEstimate || "",
    tags: Array.isArray(task?.tags)
      ? task.tags
      : task?.tags
        ? task.tags.split(",").map((tag) => tag.trim())
        : [],
    taskType: task?.taskType || "regular",
    isRisky: task?.isRisky || false,
    riskNote: task?.riskNote || "",
    colorCode: task?.colorCode || "#3B82F6",
    visibility: task?.visibility || "private",
    collaborators: task?.collaborators || [],
    attachments: task?.attachments || [],
    isRecurring: task?.isRecurring || false,
    repeatFrequency: task?.repeatFrequency || "none",
  });

  const [errors, setErrors] = useState({});
  const [isManualDueDate, setIsManualDueDate] = useState(false);
  const [tagInput, setTagInput] = useState("");

  // ✅ Calculate valid status options based on current status and allowedTransitions
  const getValidStatusOptions = () => {
    const currentStatusCode = String(task?.status || formData.status || "")
      .trim()
      .toUpperCase();
    const currentStatusObj = taskStatuses.find(
      (s) => s.code === currentStatusCode,
    );

    // If no current status or status not found, show all active statuses
    if (!currentStatusObj) {
      return taskStatuses.filter((s) => s && s.active);
    }

    // Always include the current status in options
    const validCodes = new Set([currentStatusCode]);

    // Add allowed transitions if defined
    if (Array.isArray(currentStatusObj.allowedTransitions)) {
      currentStatusObj.allowedTransitions.forEach((code) =>
        validCodes.add(code),
      );
    } else {
      // If allowedTransitions not defined, allow all (backward compatibility)
      taskStatuses
        .filter((s) => s && s.active)
        .forEach((s) => validCodes.add(s.code));
    }

    // Return statuses that match valid codes
    return taskStatuses
      .filter((s) => s && s.active && validCodes.has(s.code))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  };

  // Auto-calculate due date when priority changes (unless manually overridden)
  useEffect(() => {
    if (!isManualDueDate && formData.priority) {
      const calculatedDueDate = calculateDueDateFromPriority(
        formData.priority,
        taskPriorities,
      );
      setFormData((prev) => ({
        ...prev,
        dueDate: calculatedDueDate,
      }));
    }
  }, [formData.priority, isManualDueDate, taskPriorities]);

  const teamMembers = []; // Empty for production - fetch from API

  const priorityOptions = (Array.isArray(taskPriorities) ? taskPriorities : [])
    .filter((p) => p && p.active)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((p) => ({ value: p.code, label: p.label }));

  const repeatFrequencyOptions = [
    { value: "none", label: "No Repeat" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "custom", label: "Custom" },
  ];

  const handleChange = (field, value) => {
    if (field === "dueDate") {
      setIsManualDueDate(true);
    }
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear errors when user makes changes
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData?.title?.trim()) {
      newErrors.title = "Task title is required";
    }

    if (!formData?.assigneeId) {
      newErrors.assigneeId = "Assignee is required";
    }

    if (!formData?.dueDate) {
      newErrors.dueDate = "Due date is required";
    } else {
      try {
        const selectedDate = new Date(formData.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate < today) {
          newErrors.dueDate = "Due date cannot be in the past";
        }
      } catch (error) {
        newErrors.dueDate = "Invalid date format";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const assignee = teamMembers.find(
      (member) => member.id === parseInt(formData.assigneeId),
    );

    const updatedTask = {
      ...task,
      ...formData,
      assignee: assignee ? assignee.name : formData.assignee,
      assigneeId: parseInt(formData.assigneeId),
      tags: formData.tags,
      updatedAt: new Date().toISOString(),
    };

    onSave(updatedTask);
  };

  // Handle keyboard events for modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleTagInputKeyDown = (e) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (!formData.tags.includes(newTag)) {
        handleChange("tags", [...formData.tags, newTag]);
      }
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove) => {
    handleChange(
      "tags",
      formData.tags.filter((tag) => tag !== tagToRemove),
    );
  };

  const handleFileUpload = (files) => {
    handleChange("attachments", [...formData.attachments, ...files]);
  };

  const removeAttachment = (fileId) => {
    handleChange(
      "attachments",
      formData.attachments.filter((file) => file.id !== fileId),
    );
  };

  const handleAssigneeChange = (selectedOption) => {
    if (selectedOption) {
      handleChange("assigneeId", selectedOption.value);
      const assigneeName = selectedOption.label.replace("👤 ", "");
      handleChange("assignee", assigneeName);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overlay-animate"
      onClick={onClose}
    >
      <div
        className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto modal-animate-slide-right"
        style={{
          boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
          border: "1px solid rgba(255,255,255,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-sm flex items-center justify-center">
              <span className="text-white text-lg">✏️</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Edit Task</h2>
              <p className="text-sm text-gray-600">
                Modify task details and properties
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-sm hover:bg-gray-100"
          >
            <svg
              className="w-6 h-6"
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

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Basic Information */}
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Basic Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Title */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Task Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.title ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="Enter task title..."
                  required
                  maxLength={100}
                />
                {errors.title && (
                  <span className="text-red-500 text-sm mt-1">
                    {errors.title}
                  </span>
                )}
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <CustomEditor
                  value={formData.description}
                  onChange={(value) => handleChange("description", value)}
                  placeholder="Enter task description..."
                />
              </div>

              {/* Task Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Task Type
                </label>
                <select
                  value={formData.taskType}
                  onChange={(e) => handleChange("taskType", e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!permissions.canEdit}
                >
                  <option value="regular">Regular Task</option>
                  <option value="milestone">Milestone</option>
                  <option value="approval">Approval Task</option>
                  <option value="recurring">Recurring Task</option>
                </select>
              </div>

              {/* Color Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color Code
                </label>
                <input
                  type="color"
                  value={formData.colorCode}
                  onChange={(e) => handleChange("colorCode", e.target.value)}
                  className="w-full h-12 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Assignment & Status */}
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Assignment & Status
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Assignee */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assignee *
                </label>
                <SearchableSelect
                  options={teamMembers}
                  value={teamMembers.find(
                    (member) => member.value === formData.assigneeId,
                  )}
                  onChange={handleAssigneeChange}
                  placeholder="Select assignee"
                  className={errors.assigneeId ? "border-red-500" : ""}
                  isDisabled={!permissions?.canReassign}
                />
                {errors.assigneeId && (
                  <span className="text-red-500 text-sm mt-1">
                    {errors.assigneeId}
                  </span>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleChange("status", e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!permissions.canChangeStatus}
                >
                  {getValidStatusOptions().map((s) => (
                    <option key={s._id || s.code} value={s.code}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <SearchableSelect
                  options={priorityOptions}
                  value={priorityOptions.find(
                    (option) => option.value === formData.priority,
                  )}
                  onChange={(selectedOption) =>
                    handleChange("priority", selectedOption.value)
                  }
                  placeholder="Select priority..."
                />
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Timeline
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleChange("startDate", e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date *
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleChange("dueDate", e.target.value)}
                  className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.dueDate ? "border-red-500" : "border-gray-300"
                  }`}
                  min={new Date().toISOString().split("T")[0]}
                  required
                />
                {errors.dueDate && (
                  <span className="text-red-500 text-sm mt-1">
                    {errors.dueDate}
                  </span>
                )}
                {!isManualDueDate && (
                  <p className="text-xs text-blue-600 mt-1">
                    Auto-calculated from priority
                  </p>
                )}
              </div>

              {/* Time Estimate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time Estimate
                </label>
                <input
                  type="text"
                  value={formData.timeEstimate}
                  onChange={(e) => handleChange("timeEstimate", e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 40 hours, 3 days"
                />
              </div>
            </div>
          </div>

          {/* Repeat Frequency */}
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Recurrence
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Repeat Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Repeat Frequency
                </label>
                <SearchableSelect
                  options={repeatFrequencyOptions}
                  value={repeatFrequencyOptions.find(
                    (option) => option.value === formData.repeatFrequency,
                  )}
                  onChange={(selectedOption) => {
                    handleChange("repeatFrequency", selectedOption.value);
                    handleChange(
                      "isRecurring",
                      selectedOption.value !== "none",
                    );
                  }}
                  placeholder="Select frequency..."
                />
              </div>

              <div>
                {/* Placeholder for custom recurrence settings */}
                {formData.repeatFrequency === "custom" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Pattern
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Every 2 weeks"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tags & Risk */}
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Tags & Risk Management
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <div className="space-y-3">
                  {/* Tag chips display */}
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                        >
                          {tag}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTag(tag)}
                            className="ml-2 text-blue-600 hover:text-blue-800 h-auto w-auto p-0"
                          >
                            ×
                          </Button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Tag input */}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    className="w-full h-9 px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Type a tag and press Enter..."
                  />
                  <p className="text-xs text-gray-500">
                    Press Enter to add tags
                  </p>
                </div>
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visibility
                </label>
                <select
                  value={formData.visibility}
                  onChange={(e) => handleChange("visibility", e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="private">Private</option>
                  {canAssignToOthers && <option value="team">Team</option>}
                  <option value="company">Company</option>
                </select>
              </div>
            </div>

            {/* Risk Status */}
            <div className="mt-6">
              <div className="flex items-center space-x-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isRisky}
                    onChange={(e) => handleChange("isRisky", e.target.checked)}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Mark as at risk
                  </span>
                </label>
              </div>

              {formData.isRisky && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Risk Note
                  </label>
                  <textarea
                    value={formData.riskNote}
                    onChange={(e) => handleChange("riskNote", e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Describe the risk..."
                    rows={3}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Attachments */}
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Attachments
            </h3>

            <div className="space-y-3">
              {/* File Upload Component */}
              <FileUploadComponent
                onFilesSelected={handleFileUpload}
                allowMultiple={true}
                maxFileSize={2 * 1024 * 1024} // 2MB per file
                maxTotalSize={5 * 1024 * 1024} // 5MB total
              />

              {/* Display existing attachments */}
              {formData.attachments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">
                    Current Attachments:
                  </h4>
                  {formData.attachments.map((file, index) => (
                    <div
                      key={file.id || index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-sm"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="text-gray-600">📎</div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {file.size
                              ? `${(file.size / 1024).toFixed(1)} KB`
                              : "Unknown size"}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeAttachment(file.id || index)}
                        className="text-red-600 hover:text-red-800 text-sm h-auto"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between gap-3 pt-6 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="gradient"
              disabled={!formData.title.trim()}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
