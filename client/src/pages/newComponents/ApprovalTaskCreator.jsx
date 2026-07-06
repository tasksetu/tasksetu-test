import React, { useState, useEffect } from "react";
import ReactQuill from "react-quill";
import SearchableSelect from "../SearchableSelect";
import FileUploadComponent from "./FileUploadComponent";
import { useTaskPriorities } from "@/hooks/useTaskPriorities";
import useTasksStore from "../../stores/tasksStore";
import { Button } from "@/components/ui/button";

export default function ApprovalTaskCreator({
  onClose,
  onSubmit,
  preFilledDate,
  selectedDate,
  initialData,
}) {
  const { tasks, addTask, addNotification } = useTasksStore();
  const { data: taskPriorities = [] } = useTaskPriorities();
  const [notifications, setNotifications] = useState([]);

  const getDefaultPriority = () => {
    const defaultPriority = taskPriorities.find((p) => p.isDefault);
    return defaultPriority?.code || "medium";
  };

  const [formData, setFormData] = useState({
    taskName: initialData?.taskName || "",
    isApprovalTask:
      initialData?.isApprovalTask !== undefined
        ? initialData.isApprovalTask
        : false,
    approvers: initialData?.approvers || [],
    approvalMode: initialData?.approvalMode || "any_one",
    dueDate: initialData?.dueDate || preFilledDate || selectedDate || "",
    autoApproveAfter: initialData?.autoApproveAfter || "",
    description: initialData?.description || "",
    attachments: initialData?.attachments || [],
    collaborators: initialData?.collaborators || [],
    visibility: initialData?.visibility || "private",
    priority: initialData?.priority || getDefaultPriority(),
    assignedTo: initialData?.assignedTo || "Current User",
    assigneeId: initialData?.assigneeId || 1,
    status: initialData?.status || "not_started",
    id: initialData?.id || null,
  });

  const [errors, setErrors] = useState({});
  const [sequentialOrder, setSequentialOrder] = useState(
    initialData?.sequentialOrder || [],
  );

  const teamMembers = []; // Empty for production - fetch from API

  const approvalModes = [
    { value: "any_one", label: "⚡ Any One - First approver decides" },
    {
      value: "all_must_approve",
      label: "👥 All Must Approve - Unanimous decision",
    },
    { value: "sequential", label: "🔄 Sequential - Approvers act in order" },
  ];

  // Set default approver to creator when approval task is enabled
  useEffect(() => {
    if (formData.isApprovalTask && formData.approvers.length === 0) {
      setFormData((prev) => ({
        ...prev,
        approvers: [1], // Default to current user
      }));
    }
  }, [formData.isApprovalTask]);

  // Handle sequential order when mode changes
  useEffect(() => {
    if (
      formData.approvalMode === "sequential" &&
      formData.approvers.length > 0
    ) {
      setSequentialOrder(formData.approvers);
    }
  }, [formData.approvalMode, formData.approvers]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const handleApproverToggle = (memberId) => {
    setFormData((prev) => ({
      ...prev,
      approvers: prev.approvers.includes(memberId)
        ? prev.approvers.filter((id) => id !== memberId)
        : [...prev.approvers, memberId],
    }));
  };

  const handleCollaboratorToggle = (memberId) => {
    setFormData((prev) => ({
      ...prev,
      collaborators: prev.collaborators.includes(member.id)
        ? prev.collaborators.filter((id) => id !== member.id)
        : [...prev.collaborators, member.id],
    }));
  };

  const handleSequentialOrderChange = (approvers) => {
    setSequentialOrder(approvers);
  };

  const validateForm = () => {
    const newErrors = {};

    // Task name validation - Prompt 7
    if (!formData.taskName.trim()) {
      newErrors.taskName = "Task name is required.";
    } else if (formData.taskName.length > 100) {
      newErrors.taskName = "Task name must be 100 characters or less";
    }

    // Due date validation - Prompt 7
    if (!formData.dueDate) {
      newErrors.dueDate = "Due date is required";
    } else {
      const selectedDate = new Date(formData.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        newErrors.dueDate = "Approval due date must be today or later.";
      }
    }

    // Approval task specific validations
    if (formData.isApprovalTask) {
      // Approver validation - Prompt 7
      if (formData.approvers.length === 0) {
        newErrors.approvers = "At least one approver must be assigned.";
      }

      // Auto-approve validation - Prompt 7
      if (formData.autoApproveAfter && formData.autoApproveAfter < 0) {
        newErrors.autoApproveAfter = "Auto-approve days must be 0 or greater.";
      }

      // Sequential mode validation - Prompt 7
      if (
        formData.approvalMode === "sequential" &&
        formData.approvers.length > 1 &&
        sequentialOrder.length === 0
      ) {
        newErrors.approvalMode =
          "Sequential mode requires defining approver order.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (validateForm()) {
      const approvalTaskData = {
        ...formData,
        type: "approval",
        taskType: "approval",
        sequentialOrder:
          formData.approvalMode === "sequential" ? sequentialOrder : [],
        approvalHistory: [],
        currentApproverIndex: formData.approvalMode === "sequential" ? 0 : -1,
      };
      onSubmit(approvalTaskData);
      // Notification would be handled by the parent component or store
      console.log(
        `Approval task "${approvalTaskData.taskName}" created successfully!`,
      );
    }
  };

  return (
    <div className="h-full flex flex-col bg-white p-4">
      {/* Header Section */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-8 h-8 rounded-sm bg-green-500 flex items-center justify-center flex-shrink-0">
          <span className="text-lg">✅</span>
        </div>
        <div className="flex-1">
          <h4 className="text-base font-bold text-gray-900 mb-1">
            {initialData ? "Update Approval Task" : "Create Approval Task"}
          </h4>
          <p className="text-xs text-gray-600">
            An approval task requires designated approvers to make decisions
            (Approve/Reject)
          </p>
        </div>
      </div>

      {/* Form Content */}
      <form
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto space-y-3"
      >
        {/* Basic Information */}
        <div className="space-y-3">
          {/* Task Name */}
          <div className="form-group">
            <label
              htmlFor="taskName"
              className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1"
            >
              <svg
                className="w-3 h-3 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              Task Name *
            </label>
            <input
              type="text"
              id="taskName"
              value={formData.taskName}
              onChange={(e) => handleInputChange("taskName", e.target.value)}
              placeholder="Enter approval task name (max 100 characters)"
              className={`w-full h-9 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${errors.taskName ? "border-red-500" : ""}`}
              maxLength={100}
              required
            />
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-gray-500">
                {formData.taskName.length}/100 characters
              </span>
              {errors.taskName && (
                <span className="text-red-500 text-xs">{errors.taskName}</span>
              )}
            </div>
          </div>

          {/* Approval Task Toggle */}
          <div className="form-group">
            <div className="bg-green-50 border border-green-200 rounded-sm p-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={formData.isApprovalTask}
                    onChange={(e) =>
                      handleInputChange("isApprovalTask", e.target.checked)
                    }
                    className="w-4 h-4 rounded border-2 border-green-300 text-green-600 focus:ring-green-500"
                  />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-semibold text-green-800">
                    Approval Task
                  </span>
                  <p className="text-xs text-green-700 mt-0.5">
                    Enable this to create an approval decision task
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Approval Task Specific Fields */}
          {formData.isApprovalTask && (
            <>
              {/* Approvers */}
              <div className="form-group">
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <svg
                    className="w-3 h-3 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  Approvers *
                </label>
                <div className="border border-gray-200 rounded-sm p-3 bg-gray-50 max-h-40 overflow-y-auto">
                  <div className="space-y-2">
                    {teamMembers.map((member) => (
                      <label
                        key={member.id}
                        className="flex items-center space-x-3 p-2 bg-white rounded border hover:border-green-300 transition-colors cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.approvers.includes(member.id)}
                          onChange={() => handleApproverToggle(member.id)}
                          className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                        <div className="flex items-center gap-2 flex-1">
                          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
                            {member.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {member.name}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                {errors.approvers && (
                  <span className="text-red-500 text-xs mt-1 block">
                    {errors.approvers}
                  </span>
                )}
              </div>

              {/* Approval Mode */}
              <div className="form-group">
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <svg
                    className="w-3 h-3 text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 4h6m-6 4h6"
                    />
                  </svg>
                  Approval Mode
                </label>
                <SearchableSelect
                  options={approvalModes}
                  value={approvalModes.find(
                    (mode) => mode.value === formData.approvalMode,
                  )}
                  onChange={(selectedOption) =>
                    handleInputChange("approvalMode", selectedOption.value)
                  }
                />
                {errors.approvalMode && (
                  <span className="text-red-500 text-xs mt-1 block">
                    {errors.approvalMode}
                  </span>
                )}
              </div>

              {/* Sequential Order - Only show for sequential mode */}
              {formData.approvalMode === "sequential" &&
                formData.approvers.length > 1 && (
                  <div className="form-group">
                    <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                      <svg
                        className="w-3 h-3 text-purple-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6h16M4 10h16M4 14h16M4 18h16"
                        />
                      </svg>
                      Sequential Order
                    </label>
                    <div className="bg-purple-50 border border-purple-200 rounded-sm p-3">
                      <p className="text-xs text-purple-700 mb-2">
                        Drag to reorder approvers. First person will approve
                        first, then next, and so on.
                      </p>
                      <div className="space-y-1">
                        {sequentialOrder.map((approverId, index) => {
                          const approver = teamMembers.find(
                            (m) => m.id === approverId,
                          );
                          return (
                            <div
                              key={approverId}
                              className="flex items-center gap-2 p-2 bg-white rounded border"
                            >
                              <span className="text-xs font-bold text-purple-600 w-6">
                                #{index + 1}
                              </span>
                              <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                {approver?.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </div>
                              <span className="text-sm text-gray-900">
                                {approver?.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

              {/* Auto-Approve After */}
              <div className="form-group">
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <svg
                    className="w-3 h-3 text-orange-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Auto-Approve After (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={formData.autoApproveAfter}
                    onChange={(e) =>
                      handleInputChange("autoApproveAfter", e.target.value)
                    }
                    placeholder="0"
                    min="0"
                    className={`w-20 h-9 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors.autoApproveAfter ? "border-red-500" : ""}`}
                  />
                  <span className="text-sm text-gray-600">
                    days after due date
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  If no response by this time, system will auto-approve the task
                </p>
                {errors.autoApproveAfter && (
                  <span className="text-red-500 text-xs mt-1 block">
                    {errors.autoApproveAfter}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Configuration Grid */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-3">
          {/* Due Date */}
          <div className="form-group">
            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
              <svg
                className="w-3 h-3 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Due Date *
            </label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => handleInputChange("dueDate", e.target.value)}
              className={`form-input ${errors.dueDate ? "border-red-500" : ""}`}
              min={new Date().toISOString().split("T")[0]}
              required
            />
            {errors.dueDate && (
              <span className="text-red-500 text-xs mt-1 block">
                {errors.dueDate}
              </span>
            )}
          </div>

          {/* Priority */}
          <div className="form-group">
            <label className="form-label flex items-center gap-2">
              <svg
                className="w-4 h-4 text-orange-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
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

          {/* Visibility */}
          <div className="form-group md:col-span-2">
            <label className="form-label flex items-center gap-2">
              <svg
                className="w-4 h-4 text-yellow-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              Visibility
            </label>
            <SearchableSelect
              options={[
                { value: "private", label: "🔒 Private (Default)" },
                { value: "public", label: "👥 Public" },
              ]}
              value={{
                value: formData.visibility,
                label:
                  formData.visibility === "private"
                    ? "🔒 Private (Default)"
                    : "👥 Public",
              }}
              onChange={(selectedOption) =>
                handleInputChange("visibility", selectedOption.value)
              }
            />
          </div>
        </div>

        {/* Description */}
        <div className="form-group">
          <label className="form-label flex items-center gap-2">
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
                d="M4 6h16M4 12h16M4 18h7"
              />
            </svg>
            Description (Optional)
          </label>
          <ReactQuill
            className="custom-editor"
            value={formData.description}
            onChange={(value) => handleInputChange("description", value)}
            placeholder="Describe what needs approval..."
          />
        </div>

        {/* Attachments */}
        <div className="form-group">
          <label className="form-label flex items-center gap-2">
            <svg
              className="w-4 h-4 text-indigo-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
            Attachments (Optional)
          </label>
          <FileUploadComponent
            onFileUpload={(files) => handleInputChange("attachments", files)}
            maxFiles={5}
            acceptedTypes={[".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"]}
          />
        </div>

        {/* Collaborators */}
        <div className="form-group">
          <label className="form-label flex items-center gap-2">
            <svg
              className="w-4 h-4 text-teal-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            Collaborators (Optional)
          </label>
          <div className="border border-gray-200 rounded-sm p-4 bg-gray-50">
            <p className="text-xs text-gray-600 mb-3">
              Collaborators will be notified but cannot approve. They can only
              comment.
            </p>
            <div className="space-y-2">
              {teamMembers
                .filter((member) => !formData.approvers.includes(member.id))
                .map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center space-x-3 p-2 bg-white rounded border hover:border-gray-300 transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData.collaborators.includes(member.id)}
                      onChange={() => handleCollaboratorToggle(member.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2 flex-1">
                      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                        {member.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {member.name}
                      </span>
                    </div>
                  </label>
                ))}
            </div>
          </div>
        </div>

        {/* Approval Restrictions Info */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h4 className="font-semibold text-amber-800 mb-2">
                Approval Task Rules
              </h4>
              <ul className="text-xs text-amber-700 space-y-1">
                <li>
                  • Creator cannot approve their own task unless explicitly
                  added as approver
                </li>
                <li>
                  • Approvers cannot be edited once first decision is taken
                </li>
                <li>
                  • Approval task toggle is irreversible (cannot convert back to
                  normal task)
                </li>
                <li>• Auto-approval happens after due date + specified days</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-6 border-t-2 border-gray-100 sticky bottom-0 bg-white">
          <Button
            variant="outline"
            type="button"
            className="h-9 px-8 text-sm font-semibold"
            onClick={onClose}
          >
            <svg
              className="w-4 h-4 mr-2"
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
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            className="h-9 px-8 text-sm font-semibold flex items-center gap-2"
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
            {initialData ? "Update Approval Task" : "Create Approval Task"}
          </Button>
        </div>
      </form>
    </div>
  );
}
