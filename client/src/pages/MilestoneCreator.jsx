import React, { useState, useEffect } from "react";
import ReactQuill from "react-quill";
import { Button } from "@/components/ui/button";
import SearchableSelect from "./SearchableSelect";
import { calculateDueDateFromPriority } from "./newComponents/PriorityManager";
import { useTaskPriorities } from "@/hooks/useTaskPriorities";
import useTasksStore from "../stores/tasksStore";

export default function MilestoneCreator({
  onClose,
  onSubmit,
  preFilledDate,
  selectedDate,
  initialData, // Assuming initialData is passed for editing
}) {
  const { tasks } = useTasksStore();
  const { data: taskPriorities = [] } = useTaskPriorities();

  const getDefaultPriority = () => {
    const defaultPriority = taskPriorities.find(p => p.isDefault);
    return defaultPriority?.code || "medium";
  };

  const [formData, setFormData] = useState({
    taskName: initialData?.taskName || "",
    isMilestone:
      initialData?.isMilestone !== undefined ? initialData.isMilestone : true,
    milestoneType: initialData?.milestoneType || "standalone",
    linkedTasks: initialData?.linkedTasks || [],
    dueDate: initialData?.dueDate || preFilledDate || selectedDate || "",
    assignedTo: initialData?.assignedTo || "Current User",
    assigneeId: initialData?.assigneeId || 1,
    description: initialData?.description || "",
    visibility: initialData?.visibility || "private",
    priority: initialData?.priority || getDefaultPriority(),
    collaborators: initialData?.collaborators || [],
    status: initialData?.status || "not_started", // Prompt 3: Initial status
    id: initialData?.id || null, // Include ID for editing
  });

  const [errors, setErrors] = useState({});
  const [availableTasks, setAvailableTasks] = useState([]);

  const teamMembers = []; // Empty for production - fetch from API

  // Filter available tasks (no recursive milestones)
  useEffect(() => {
    const filteredTasks = tasks.filter(
      (task) => task.taskType !== "milestone" && task.id !== formData.id, // Prevent self-reference
    );
    setAvailableTasks(filteredTasks);
  }, [tasks, formData.id]);

  // Calculate latest dependency due date when linked tasks change
  useEffect(() => {
    if (
      formData.milestoneType === "linked" &&
      formData.linkedTasks.length > 0
    ) {
      const linkedTaskObjects = availableTasks.filter((task) =>
        formData.linkedTasks.includes(task.id),
      );

      if (linkedTaskObjects.length > 0) {
        const latestDueDate = linkedTaskObjects.reduce((latest, task) => {
          const taskDueDate = new Date(task.dueDate);
          const latestDate = new Date(latest);
          return taskDueDate > latestDate ? task.dueDate : latest;
        }, linkedTaskObjects[0].dueDate);

        setFormData((prev) => ({
          ...prev,
          dueDate: latestDueDate,
        }));
      }
    }
  }, [formData.linkedTasks, formData.milestoneType, availableTasks]);

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

  const handleCollaboratorToggle = (memberId) => {
    setFormData((prev) => ({
      ...prev,
      collaborators: prev.collaborators.includes(memberId)
        ? prev.collaborators.filter((id) => id !== memberId)
        : [...prev.collaborators, memberId],
    }));
  };

  const handleLinkedTaskToggle = (taskId) => {
    setFormData((prev) => ({
      ...prev,
      linkedTasks: prev.linkedTasks.includes(taskId)
        ? prev.linkedTasks.filter((id) => id !== taskId)
        : [...prev.linkedTasks, taskId],
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    // Task name validation (≤80 chars, required) - Prompt 5
    if (!formData.taskName.trim()) {
      newErrors.taskName = "Milestone name is required.";
    } else if (formData.taskName.length > 100) {
      newErrors.taskName = "Task name must be 100 characters or less";
    }

    // Due date validation (≥today) - Prompt 5
    if (!formData.dueDate) {
      newErrors.dueDate = "Due date is required";
    } else {
      const selectedDate = new Date(formData.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        newErrors.dueDate = "Milestone due date must be today or later.";
      }
    }

    // Milestone toggle validation
    if (!formData.isMilestone) {
      newErrors.isMilestone = "Milestone toggle must be enabled";
    }

    // Linked tasks validation
    if (
      formData.milestoneType === "linked" &&
      formData.linkedTasks.length === 0
    ) {
      newErrors.linkedTasks =
        "Please select at least one task to link to this milestone";
    }

    // Circular dependency validation - Prompt 5
    if (
      formData.milestoneType === "linked" &&
      formData.linkedTasks.length > 0
    ) {
      const linkedTaskObjects = availableTasks.filter((task) =>
        formData.linkedTasks.includes(task.id),
      );

      // Check for circular dependencies (milestone linking to itself or other milestones)
      const hasCircularDependency = linkedTaskObjects.some(
        (task) => task.taskType === "milestone" || task.id === formData.id,
      );

      if (hasCircularDependency) {
        newErrors.linkedTasks = "Circular dependency not allowed.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (validateForm()) {
      const milestoneData = {
        ...formData,
        type: "milestone",
        taskType: "milestone",
      };
      onSubmit(milestoneData);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white p-4">
      {/* Header Section */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded bg-purple-500 flex items-center justify-center flex-shrink-0">
          <span className="text-sm">🎯</span>
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-gray-900">
            {initialData ? "Update Milestone Task" : "Create Milestone Task"}
          </h4>
          <p className="text-xs text-gray-500">
            Checkpoint for significant progress
          </p>
        </div>
      </div>

      {/* Form Content */}
      <form
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto space-y-3"
      >
        {/* Basic Information */}
        <div className="space-y-2">
          {/* Task Name */}
          <div className="form-group">
            <label
              htmlFor="taskName"
              className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1"
            >
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
              placeholder="Enter milestone name (max 100 characters)"
              className={`w-full h-9 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${errors.taskName ? "border-red-500" : ""}`}
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

          {/* Milestone Toggle */}
          <div className="form-group">
            <div className="bg-purple-50 border border-purple-200 rounded p-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isMilestone}
                  onChange={(e) =>
                    handleInputChange("isMilestone", e.target.checked)
                  }
                  className="w-4 h-4 rounded border-2 border-purple-300 text-purple-600 focus:ring-purple-500"
                />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-purple-800">
                    Milestone Task
                  </span>
                  <p className="text-xs text-purple-700">
                    Enable milestone checkpoint
                  </p>
                </div>
              </label>
              {errors.isMilestone && (
                <span className="text-red-500 text-xs mt-1 block">
                  {errors.isMilestone}
                </span>
              )}
            </div>
          </div>

          {/* Milestone Type */}
          {formData.isMilestone && (
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
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                Milestone Type
              </label>
              <SearchableSelect
                options={[
                  {
                    value: "standalone",
                    label: "🎯 Standalone - Independent milestone",
                  },
                  {
                    value: "linked",
                    label: "🔗 Linked - Dependent on other tasks",
                  },
                ]}
                value={{
                  value: formData.milestoneType,
                  label:
                    formData.milestoneType === "standalone"
                      ? "🎯 Standalone - Independent milestone"
                      : "🔗 Linked - Dependent on other tasks",
                }}
                onChange={(selectedOption) =>
                  handleInputChange("milestoneType", selectedOption.value)
                }
              />
            </div>
          )}

          {/* Link to Tasks - Only show when milestone type is "linked" */}
          {formData.isMilestone && formData.milestoneType === "linked" && (
            <div className="form-group">
              <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                <svg
                  className="w-3 h-3 text-indigo-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                  />
                </svg>
                Link to Tasks/Subtasks *
              </label>
              <div className="border border-gray-200 rounded p-2 bg-gray-50 max-h-32 overflow-y-auto">
                <div className="space-y-2">
                  {availableTasks.length > 0 ? (
                    availableTasks.map((task) => (
                      <label
                        key={task.id}
                        className="flex items-center space-x-2 p-1.5 bg-white rounded border hover:border-indigo-300 transition-colors cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.linkedTasks.includes(task.id)}
                          onChange={() => handleLinkedTaskToggle(task.id)}
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-blue-500">⚙️</span>
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              {task.title}
                            </span>
                            <p className="text-xs text-gray-500">
                              Due: {task.dueDate}
                            </p>
                          </div>
                        </div>
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No available tasks to link. Create some tasks first.
                    </p>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-3 flex items-center gap-1">
                  <svg
                    className="w-3 h-3"
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
                  Select tasks that must be completed before this milestone. No
                  recursive milestones allowed.
                </p>
              </div>
              {errors.linkedTasks && (
                <span className="text-red-500 text-sm">
                  {errors.linkedTasks}
                </span>
              )}
            </div>
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
            {formData.milestoneType === "linked" &&
              formData.linkedTasks.length > 0 && (
                <p className="text-xs text-blue-600 mt-1">
                  Auto-set to latest dependency due date
                </p>
              )}
            {errors.dueDate && (
              <span className="text-red-500 text-sm">{errors.dueDate}</span>
            )}
          </div>

          {/* Assigned To */}
          <div className="form-group">
            <label className="form-label flex items-center gap-2">
              <svg
                className="w-4 h-4 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              Assigned To *
            </label>
            <SearchableSelect
              options={teamMembers.map((member) => ({
                value: member.id,
                label: `👤 ${member.name}`,
              }))}
              value={{
                value: formData.assigneeId,
                label: `👤 ${teamMembers.find((m) => m.id === formData.assigneeId)?.name || "Current User"}`,
              }}
              onChange={(selectedOption) => {
                const member = teamMembers.find(
                  (m) => m.id === selectedOption.value,
                );
                handleInputChange("assigneeId", member.id);
                handleInputChange("assignedTo", member.name);
              }}
            />
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
                { value: "medium", label: "🟡 Medium (Default)" },
                { value: "high", label: "🟠 High" },
                { value: "critical", label: "🔴 Critical" },
              ]}
              value={{
                value: formData.priority,
                label:
                  formData.priority === "low"
                    ? "🟢 Low"
                    : formData.priority === "medium"
                      ? "🟡 Medium (Default)"
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
          <div className="form-group">
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
                { value: "private", label: "🔒 Private" },
                { value: "public", label: "👥 Public" },
              ]}
              value={{
                value: formData.visibility,
                label:
                  formData.visibility === "private"
                    ? "🔒 Private"
                    : "👥 Public",
              }}
              onChange={(selectedOption) =>
                handleInputChange("visibility", selectedOption.value)
              }
            />
            <p className="text-xs text-gray-500 mt-1">
              Inherits from parent project settings
            </p>
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
            placeholder="Describe what this milestone represents..."
          />
        </div>

        {/* Milestone Restrictions Info - Prompt 4 */}
        <div className="bg-amber-50 border border-amber-200 rounded p-2">
          <div className="flex items-start gap-2">
            <svg
              className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5"
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
              <h4 className="font-semibold text-amber-800 mb-1 text-sm">
                Milestone Restrictions
              </h4>
              <ul className="text-xs text-amber-700 space-y-0.5">
                <li>• No sub-tasks under milestones</li>
                <li>• Cannot be recurring</li>
                <li>• No milestone dependencies</li>
                <li>• No circular dependencies</li>
              </ul>
            </div>
          </div>
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
          <div className="border border-gray-200 rounded p-2 bg-gray-50 max-h-28 overflow-y-auto">
            <div className="space-y-1.5">
              {teamMembers
                .filter((member) => member.id !== formData.assigneeId)
                .map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center space-x-2 p-1.5 bg-white rounded border hover:border-gray-300 transition-colors cursor-pointer"
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

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
          <Button
            type="button"
            variant="outline"
            className="h-9"
            onClick={onClose}
          >
            <svg
              className="w-4 h-4 mr-1"
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
            type="submit"
            variant="primary"
            className="h-9 flex items-center gap-1"
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
            {initialData ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </div>
  );
}
