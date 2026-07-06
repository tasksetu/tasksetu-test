import React, { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import CustomEditor from "../components/common/CustomEditor";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import { usePermissions } from "@/features/shared/hooks/usePermissions";
import {
  ProtectedFormField,
  AssignmentFieldGuard,
  VisibilityFieldGuard,
  PriorityFieldGuard,
  AdvancedFeaturesGuard,
} from "@/components/forms/ProtectedFormField";

/**
 * Enhanced Regular Task Form with RBAC Integration
 * Shows how to integrate permission-based field controls
 */
const EnhancedRegularTaskForm = ({
  user,
  onSubmit,
  isOrgUser,
  assignmentOptions = [],
  defaultValues = {},
}) => {
  const { fields, task } = usePermissions();
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
      assignedTo: isOrgUser ? null : { value: "self", label: "Self" },
      priority: { value: "Low", label: "Low" },
      dueDate: "",
      visibility: "private",
      tags: [],
      attachments: [],
      ...defaultValues,
    },
  });

  const [taskNameLength, setTaskNameLength] = useState(0);
  const watchedTaskName = watch("taskName");
  const watchedPriority = watch("priority");

  useEffect(() => {
    setTaskNameLength(watchedTaskName?.length || 0);
  }, [watchedTaskName]);

  // Auto-set due date based on priority
  useEffect(() => {
    if (watchedPriority?.value) {
      const today = new Date();
      let daysToAdd = 7;

      switch (watchedPriority.value) {
        case "critical":
        case "urgent":
          daysToAdd = 1;
          break;
        case "high":
          daysToAdd = 3;
          break;
        case "medium":
          daysToAdd = 5;
          break;
        default:
          daysToAdd = 7;
      }

      const dueDate = new Date(today);
      dueDate.setDate(today.getDate() + daysToAdd);
      setValue("dueDate", toDatetimeLocal(dueDate));
    }
  }, [watchedPriority, setValue]);

  // Priority options with RBAC filtering
  const basePriorityOptions = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "critical", label: "Critical" },
    { value: "urgent", label: "Urgent" },
  ];

  const toDatetimeLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const getCurrentDateTime = () => toDatetimeLocal(new Date());

  const handleFormSubmit = (data) => {
    // Ensure visibility is set appropriately based on permissions
    if (!fields.canManageVisibility) {
      data.visibility = "private";
    }

    onSubmit(data);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-3">
        {/* Task Name */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Task Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              {...register("taskName", {
                required: "Task name is required",
                maxLength: {
                  value: 20,
                  message: "Task name cannot exceed 20 characters",
                },
              })}
              type="text"
              className="w-full h-9 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="Enter task name..."
              data-testid="input-task-name"
            />
            <div className="absolute right-3 top-2 text-xs text-gray-500">
              {taskNameLength}/20
            </div>
          </div>
          {errors.taskName && (
            <p
              className="text-red-500 text-xs mt-1"
              data-testid="error-task-name"
            >
              {errors.taskName.message}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
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
                className="border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* Assignment Field with RBAC */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Assigned To{" "}
              {fields.canAssignToOthers && (
                <span className="text-red-500">*</span>
              )}
            </label>
            <AssignmentFieldGuard assignmentOptions={assignmentOptions}>
              <Controller
                name="assignedTo"
                control={control}
                rules={
                  fields.canAssignToOthers
                    ? { required: "Assignment is required" }
                    : {}
                }
                render={({ field }) => (
                  <Select
                    {...field}
                    menuPlacement="auto"
                    options={assignmentOptions}
                    isSearchable={fields.canAssignToOthers}
                    isDisabled={
                      !fields.canAssignToOthers && assignmentOptions.length <= 1
                    }
                    className="react-select-container"
                    classNamePrefix="react-select"
                    placeholder="Select assignee"
                    data-testid="select-assigned-to"
                  />
                )}
              />
            </AssignmentFieldGuard>
            {errors.assignedTo && (
              <p
                className="text-red-500 text-xs mt-1"
                data-testid="error-assigned-to"
              >
                {errors.assignedTo.message}
              </p>
            )}
            {!fields.canAssignToOthers && (
              <p className="text-blue-600 text-xs mt-1">
                ℹ️ You can only assign tasks to yourself
              </p>
            )}
          </div>

          {/* Priority Field with RBAC */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Priority <span className="text-red-500">*</span>
            </label>
            <PriorityFieldGuard priorityOptions={basePriorityOptions}>
              <Controller
                name="priority"
                control={control}
                rules={{ required: "Priority is required" }}
                render={({ field }) => (
                  <Select
                    {...field}
                    menuPlacement="auto"
                    options={basePriorityOptions}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    placeholder="Select priority..."
                    data-testid="select-priority"
                  />
                )}
              />
            </PriorityFieldGuard>
            {errors.priority && (
              <p
                className="text-red-500 text-xs mt-1"
                data-testid="error-priority"
              >
                {errors.priority.message}
              </p>
            )}
            {!fields.canSetCriticalPriority && (
              <p className="text-blue-600 text-xs mt-1">
                ℹ️ Critical priority requires manager role
              </p>
            )}
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Due Date <span className="text-red-500">*</span>
            </label>
            <input
              {...register("dueDate", {
                required: "Due date is required",
                validate: (value) => {
                  const now = getCurrentDateTime();
                  return value >= now || "Due date must be today or later";
                },
              })}
              type="datetime-local"
              min={getCurrentDateTime()}
              className="w-full h-9 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              data-testid="input-due-date"
            />
            {errors.dueDate && (
              <p
                className="text-red-500 text-xs mt-1"
                data-testid="error-due-date"
              >
                {errors.dueDate.message}
              </p>
            )}
          </div>
        </div>

        {/* Visibility Field with RBAC */}
        <VisibilityFieldGuard defaultValue="private">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
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
              <label className="flex items-center">
                <input
                  {...register("visibility")}
                  type="radio"
                  value="public"
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  data-testid="radio-public"
                />
                <span className="ml-2 text-sm text-gray-900">Public</span>
              </label>
            </div>
            <p className="text-blue-600 text-xs mt-1">
              ℹ️ Visibility settings control who can see this task
            </p>
          </div>
        </VisibilityFieldGuard>

        {/* Advanced Features - Show only to managers and above */}
        <AdvancedFeaturesGuard feature="milestones">
          <div className="bg-blue-50 p-4 rounded-sm">
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              Advanced Options (Manager+)
            </h4>
            <div className="flex space-x-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  data-testid="checkbox-milestone"
                />
                <span className="ml-2 text-sm text-blue-900">
                  Mark as Milestone
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  data-testid="checkbox-approval"
                />
                <span className="ml-2 text-sm text-blue-900">
                  Requires Approval
                </span>
              </label>
            </div>
          </div>
        </AdvancedFeaturesGuard>

        {/* Form Actions */}
        <div className="flex justify-between items-center pt-6 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            Role:{" "}
            <span className="font-medium capitalize">
              {user?.role || "Unknown"}
            </span>
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-sm font-medium transition-colors"
              data-testid="button-cancel"
            >
              Cancel
            </button>

            <ProtectedFormField permission="create_task">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-sm font-medium transition-colors"
                data-testid="button-create-task"
              >
                Create Task
              </button>
            </ProtectedFormField>
          </div>
        </div>
      </form>
    </div>
  );
};

export default EnhancedRegularTaskForm;
