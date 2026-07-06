import React, { useState, useCallback } from "react";
import { RegularTaskForm } from "./RegularTaskForm";
import { MilestoneForm } from "./MilestoneForm";
import { ApprovalForm } from "./ApprovalForm";
import { RecurringForm } from "./RecurringForm";

const toDatetimeLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getCurrentDateTime = () => toDatetimeLocal(new Date());

export function TaskForm({ onSubmit, onSaveDraft, onClose, initialData = {} }) {
  const [formData, setFormData] = useState(() => ({
    // Base task fields
    title: "",
    description: "",
    dueDate: getCurrentDateTime(),
    assignee: "",
    priority: "medium",
    visibility: "private",
    category: "",
    tags: [],
    collaborators: [],
    attachments: [],
    notes: "",

    // Toggle states
    isMilestone: false,
    isApproval: false,
    isRecurring: false,

    // Milestone data
    milestone: {
      type: "standalone",
      linkedTasks: [],
      dueDate: getCurrentDateTime(),
      assignedTo: "self",
      description: "",
      visibility: "private",
      priority: "medium",
      collaborators: [],
    },

    // Approval data
    approval: {
      approvers: [],
      approvalMode: "any_one",
      approverOrder: [],
      autoApproval: false,
      autoApprovalDays: 0,
    },

    // Recurring data
    recurring: {
      pattern: "daily",
      repeatEvery: 1,
      startDate: "",
      endDate: "",
      endCondition: "never",
      occurrences: 10,
      weekdays: [],
      monthlyType: "date",
      monthlyDates: [],
    },

    // Advanced fields
    advanced: {
      referenceProcess: "",
      customForm: "",
      dependencies: [],
      taskType: "simple",
    },

    ...initialData,
  });

  const [validationErrors, setValidationErrors] = useState({});

  const handleInputChange = useCallback(
    (field, value) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));

      // Clear validation error when user starts typing
      if (validationErrors[field]) {
        setValidationErrors((prev) => ({
          ...prev,
          [field]: undefined,
        }));
      }
    },
    [validationErrors],
  );

  const handleToggleChange = useCallback((toggleType, enabled) => {
    setFormData((prev) => {
      const newData = { ...prev };

      // Ensure mutual exclusivity for special task types
      if (enabled) {
        if (toggleType === "isMilestone") {
          newData.isRecurring = false;
          newData.isApproval = false;
        } else if (toggleType === "isRecurring") {
          newData.isMilestone = false;
          newData.isApproval = false;
        } else if (toggleType === "isApproval") {
          newData.isMilestone = false;
          newData.isRecurring = false;
        }
      }

      newData[toggleType] = enabled;
      return newData;
    });
  }, []);

  const validateForm = useCallback(() => {
    const errors = {};

    // Base validation
    if (!formData.title?.trim()) {
      errors.title = "Task title is required";
    } else if (formData.title.length > 100) {
      errors.title = "Task title must be 100 characters or less";
    }

    // Due date validation for regular tasks
    if (!formData.isMilestone && !formData.isRecurring && !formData.dueDate) {
      errors.dueDate = "Due date is required";
    }

    // Assignee validation for regular tasks
    if (!formData.isMilestone && !formData.assignee) {
      errors.assignee = "Please assign this task to someone";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(
    (isDraft = false) => {
      if (!isDraft && !validateForm()) {
        return;
      }

      const submissionData = {
        ...formData,
        taskType: formData.isMilestone
          ? "milestone"
          : formData.isApproval
            ? "approval"
            : formData.isRecurring
              ? "recurring"
              : "regular",
      };

      if (isDraft) {
        onSaveDraft?.(submissionData);
      } else {
        onSubmit?.(submissionData);
      }
    },
    [formData, validateForm, onSubmit, onSaveDraft],
  );

  return (
    <div className="task-form-container max-w-5xl mx-auto bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4 mb-3">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span className="text-2xl">📋</span>
          Create Task
        </h2>
        <p className="text-gray-600 mt-1">
          Create a new task with optional milestone, approval, or recurring
          settings
        </p>
      </div>

      <div className="space-y-3">
        {/* Base Task Form */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">
              Basic Task Information
            </h3>
            <p className="text-sm text-gray-600">
              Core task details and assignment
            </p>
          </div>
          <RegularTaskForm
            formData={formData}
            setFormData={setFormData}
            validationErrors={validationErrors}
            onInputChange={handleInputChange}
            showTogglePanels={true}
            onToggleChange={handleToggleChange}
          />
        </div>

        {/* Milestone Panel */}
        {formData.isMilestone && (
          <div className="card border-yellow-200 bg-yellow-50">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⭐</span>
                  <h3 className="text-lg font-semibold text-yellow-800">
                    Milestone Configuration
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleChange("isMilestone", false)}
                  className="text-yellow-600 hover:text-yellow-800 text-sm"
                  data-testid="toggle-milestone-off"
                >
                  Remove Milestone
                </button>
              </div>
              <p className="text-sm text-yellow-700 mt-1">
                Configure milestone objectives and dependencies
              </p>
            </div>
            <MilestoneForm
              formData={formData}
              handleInputChange={handleInputChange}
              validationErrors={validationErrors}
            />
          </div>
        )}

        {/* Approval Panel */}
        {formData.isApproval && (
          <div className="card border-emerald-200 bg-emerald-50">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">✅</span>
                  <h3 className="text-lg font-semibold text-emerald-800">
                    Approval Configuration
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleChange("isApproval", false)}
                  className="text-emerald-600 hover:text-emerald-800 text-sm"
                  data-testid="toggle-approval-off"
                >
                  Remove Approval
                </button>
              </div>
              <p className="text-sm text-emerald-700 mt-1">
                Configure approval workflow and approvers
              </p>
            </div>
            <ApprovalForm
              formData={formData}
              onInputChange={handleInputChange}
              validationErrors={validationErrors}
            />
          </div>
        )}

        {/* Recurring Panel */}
        {formData.isRecurring && (
          <div className="card border-blue-200 bg-blue-50">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔄</span>
                  <h3 className="text-lg font-semibold text-blue-800">
                    Recurring Configuration
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleChange("isRecurring", false)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                  data-testid="toggle-recurring-off"
                >
                  Remove Recurrence
                </button>
              </div>
              <p className="text-sm text-blue-700 mt-1">
                Configure recurring schedule and patterns
              </p>
            </div>
            <RecurringForm
              formData={formData}
              onInputChange={handleInputChange}
              validationErrors={validationErrors}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            {formData.isMilestone && "Milestone task"}
            {formData.isApproval && "Approval task"}
            {formData.isRecurring && "Recurring task"}
            {!formData.isMilestone &&
              !formData.isApproval &&
              !formData.isRecurring &&
              "Regular task"}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-sm transition-colors"
              data-testid="button-cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              className="px-4 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-sm transition-colors"
              data-testid="button-save-draft"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-sm transition-colors"
              data-testid="button-create-task"
            >
              Create Task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TaskForm;
