import React, { useState, useEffect } from "react";
import { ClipboardList, RotateCcw, Target, CheckCircle } from "lucide-react";
import { useAuth } from "../features/shared/hooks/useAuth";
import {
  TASK_TYPE_PERMISSIONS,
  canCreateTaskType,
} from "../utils/taskPermissions";
import { useShowToast } from "@/utils/ToastMessage";
import CustomEditor from "./common/CustomEditor";

export function TaskCreationModal({ isOpen, onClose, onSubmit }) {
  const [selectedTaskType, setSelectedTaskType] = useState("regular");
  const [taskName, setTaskName] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [contributors, setContributors] = useState([]);
  const [priority, setPriority] = useState("Normal");
  const [dueDate, setDueDate] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const { showSuccessToast, showErrorToast } = useShowToast();
  const [recurrence, setRecurrence] = useState({
    patternType: "",
    repeatEvery: 1,
    startDate: "", // Don't set default, let user select
    startTime: "09:00",
    endCondition: "never",
    weekdays: [],
    monthDays: [],
    monthlyMode: "specific_date",
    specificDate: "",
    yearMonths: [],
    yearDay: "",
    occurrences: "",
    endDate: "",
    customDates: [],
  });

  // Phase I RBAC: Get real user role from auth context
  const { user, role: userRole } = useAuth();

  // Get permission configuration for user's role
  const userPermissions =
    TASK_TYPE_PERMISSIONS[userRole] || TASK_TYPE_PERMISSIONS["individual"];

  // Role-based assignment restrictions
  const getAssignmentRestrictions = () => {
    return {
      canAssignToOthers: userPermissions.canAssignToOthers,
      restriction: userPermissions.description,
      assignmentScope: userPermissions.assignmentScope,
    };
  };

  const assignmentRestrictions = getAssignmentRestrictions();

  // Mock assignment options - shifted to dynamic in production
  const getAssignmentOptions = () => {
    const options = [{ value: "self", label: "Myself" }];

    // Dynamic users should be fetched from API and added here

    return options;
  };

  const assignmentOptions = getAssignmentOptions();

  // Mock collaborator options - initialized empty
  const collaboratorOptions = [];

  if (!isOpen) return null;

  // Helper functions for recurrence
  const getTodayDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  const handleRecurrenceToggle = (checked) => {
    setIsRecurring(checked);
    if (checked) {
      // When recurring is enabled, clear due date
      setDueDate("");
    }
  };

  const handleRecurrenceChange = (field, value) => {
    setRecurrence((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const generatePreview = () => {
    if (!recurrence.patternType || !recurrence.startDate) return [];

    const dates = [];
    const startDate = new Date(recurrence.startDate);
    const repeatEvery = recurrence.repeatEvery || 1;

    // Generate next 5 dates based on pattern
    for (let i = 0; i < 5; i++) {
      const nextDate = new Date(startDate);

      switch (recurrence.patternType) {
        case "daily":
          nextDate.setDate(startDate.getDate() + i * repeatEvery);
          break;
        case "weekly":
          nextDate.setDate(startDate.getDate() + i * 7 * repeatEvery);
          break;
        case "monthly":
          nextDate.setMonth(startDate.getMonth() + i * repeatEvery);
          break;
        case "yearly":
          nextDate.setFullYear(startDate.getFullYear() + i * repeatEvery);
          break;
        default:
          continue;
      }

      dates.push(nextDate.toLocaleDateString());
    }

    return dates;
  };

  const weekdayOptions = [
    { value: "monday", label: "Monday" },
    { value: "tuesday", label: "Tuesday" },
    { value: "wednesday", label: "Wednesday" },
    { value: "thursday", label: "Thursday" },
    { value: "friday", label: "Friday" },
    { value: "saturday", label: "Saturday" },
    { value: "sunday", label: "Sunday" },
  ];

  const monthOptions = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  const taskTypes = [
    {
      id: "regular",
      name: "Regular Task",
      description: "Standard one-time task",
      icon: <ClipboardList size={20} />,
      color: "blue",
    },
    {
      id: "recurring",
      name: "Recurring Task",
      description: "Normal task + recurrence pattern",
      icon: <RotateCcw size={20} />,
      color: "blue",
      note: "Creates multiple task instances automatically",
    },
    {
      id: "milestone",
      name: "Milestone",
      description: "Project checkpoint",
      icon: <Target size={20} />,
      color: "red",
    },
    {
      id: "approval",
      name: "Approval Task",
      description: "Requires approval",
      icon: <CheckCircle size={20} />,
      color: "green",
    },
  ];

  // Phase I RBAC: Filter task types based on user permissions
  const availableTaskTypes = taskTypes.filter((type) =>
    canCreateTaskType(userRole, type.id),
  );

  const handleSubmit = (e) => {
    e.preventDefault();

    console.log("🔍 DEBUG - Form submission started");
    console.log("🔍 DEBUG - isRecurring:", isRecurring);
    console.log("🔍 DEBUG - recurrence object:", recurrence);
    console.log("🔍 DEBUG - selected start date:", recurrence.startDate);
    console.log("🔍 DEBUG - selected pattern:", recurrence.patternType);

    // Validation for recurring tasks
    if (isRecurring) {
      console.log("🔍 DEBUG - Validating recurring task...");

      if (!recurrence.patternType) {
        showErrorToast("Please select a recurrence pattern");
        return;
      }
      if (
        recurrence.patternType === "weekly" &&
        recurrence.weekdays.length === 0
      ) {
        showErrorToast("Please select at least one day for weekly pattern");
        return;
      }
      if (
        recurrence.patternType === "monthly" &&
        recurrence.monthlyMode === "specific_date" &&
        !recurrence.specificDate
      ) {
        showErrorToast("Please specify day of month for monthly pattern");
        return;
      }
      if (
        recurrence.patternType === "yearly" &&
        recurrence.yearMonths.length === 0
      ) {
        showErrorToast("Please select at least one month for yearly pattern");
        return;
      }
      if (
        recurrence.endCondition === "after" &&
        (!recurrence.occurrences || recurrence.occurrences < 1)
      ) {
        showErrorToast("Please specify number of occurrences");
        return;
      }
      if (recurrence.endCondition === "by_date" && !recurrence.endDate) {
        showErrorToast("Please specify end date");
        return;
      }
      if (
        recurrence.endCondition === "by_date" &&
        recurrence.endDate < recurrence.startDate
      ) {
        showErrorToast("End date cannot be earlier than start date");
        return;
      }

      // Validate that the pattern will produce valid future dates
      const preview = generatePreview();
      if (preview.length === 0) {
        showErrorToast(
          "This recurrence pattern produces no valid future dates. Please check your settings.",
        );
        return;
      }

      console.log("✅ DEBUG - Recurring task validation passed");
    }

    const taskData = {
      type: selectedTaskType,
      taskType: selectedTaskType,
      name: taskName,
      title: taskName, // Backend expects 'title'
      description,
      assignedTo,
      contributors,
      priority: priority.toLowerCase(),
      isRecurring,
      dueDate: isRecurring ? null : dueDate,
      startDate: isRecurring ? recurrence.startDate : dueDate,
      // Convert recurrence data to the format expected by backend
      ...(isRecurring
        ? {
            recurrencePattern: {
              patternType: recurrence.patternType,
              frequency: recurrence.patternType, // Alias for compatibility
              interval: recurrence.repeatEvery,
              repeatEvery: recurrence.repeatEvery,
              startDate: recurrence.startDate,
              startTime: recurrence.startTime,
              endCondition: recurrence.endCondition,
              endDate:
                recurrence.endCondition === "by_date"
                  ? recurrence.endDate
                  : null,
              occurrences:
                recurrence.endCondition === "after"
                  ? parseInt(recurrence.occurrences)
                  : null,
              weekdays: recurrence.weekdays,
              monthDays: recurrence.monthDays,
              monthlyMode: recurrence.monthlyMode,
              specificDate: recurrence.specificDate
                ? parseInt(recurrence.specificDate)
                : null,
              yearMonths: recurrence.yearMonths,
              yearDay: recurrence.yearDay ? parseInt(recurrence.yearDay) : null,
              customDates: recurrence.customDates,
              anchorField: "startDate", // Use startDate as anchor
            },
          }
        : {}),
      collaborators: contributors,
      visibility: "private",
      tags: [],
    };

    console.log(
      "🔄 DEBUG - Final task data being submitted:",
      JSON.stringify(taskData, null, 2),
    );
    console.log(
      "🔄 DEBUG - Recurrence pattern in taskData:",
      taskData.recurrencePattern,
    );
    console.log(
      "🔄 DEBUG - Start date in recurrence pattern:",
      taskData.recurrencePattern?.startDate,
    );

    onSubmit(taskData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-md shadow-xl w-full max-w-xs sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
            Create New Task
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl sm:text-2xl p-1"
            data-testid="close-modal"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-3 sm:p-4 space-y-3 sm:space-y-3"
        >
          {/* Task Type Selection */}
          <div>
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
              Task Type
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-3">
              Choose the type of task you want to create
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {availableTaskTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSelectedTaskType(type.id)}
                  className={`p-3 sm:p-4 rounded-sm border-2 text-left transition-all duration-200 ${
                    selectedTaskType === type.id
                      ? `border-${type.color}-500 bg-${type.color}-50`
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                  data-testid={`task-type-${type.id}`}
                >
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-sm flex items-center justify-center flex-shrink-0 ${
                        selectedTaskType === type.id
                          ? `bg-${type.color}-500 text-white`
                          : `bg-${type.color}-100 text-${type.color}-600`
                      }`}
                    >
                      {React.cloneElement(type.icon, { size: 16 })}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4
                        className="font-medium text-sm sm:text-base text-gray-900 truncate"
                        title={type.name}
                      >
                        {type.name}
                      </h4>
                      <p
                        className="text-xs sm:text-sm text-gray-600 truncate"
                        title={type.description}
                      >
                        {type.description}
                      </p>
                      {type.note && (
                        <p className="text-xs text-blue-600 mt-1 line-clamp-2">
                          {type.note}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Task Details */}
          <div>
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
              Task Details
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-3">
              Fill in the basic information for your task
            </p>

            <div className="space-y-3">
              {/* Task Name */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Task Name *
                  <span className="text-xs text-gray-500 ml-1">0/20</span>
                </label>
                <input
                  type="text"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder="Short, clear title..."
                  maxLength={20}
                  className="w-full h-9 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  data-testid="input-task-name"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Guideline: Short, clear title
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <CustomEditor
                  value={description}
                  onChange={(value) => setDescription(value)}
                  placeholder="Describe your task..."
                  className="border border-gray-300 rounded-sm"
                />
              </div>

              {/* Due Date or Recurring Toggle */}
              <div className="space-y-3 sm:space-y-3">
                {/* Recurring Task Toggle */}
                <div className="bg-blue-50 border border-blue-200 rounded-sm p-3 sm:p-4">
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="recurring-toggle"
                      checked={isRecurring}
                      onChange={(e) => handleRecurrenceToggle(e.target.checked)}
                      className="w-4 h-4 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                      data-testid="checkbox-recurring"
                    />
                    <div className="flex-1 min-w-0">
                      <label
                        htmlFor="recurring-toggle"
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <RotateCcw
                          size={16}
                          className="text-blue-600 flex-shrink-0"
                        />
                        <span className="text-sm font-medium text-blue-900">
                          Recurring Task
                        </span>
                      </label>
                      <p className="text-xs text-blue-700 mt-1 leading-tight">
                        Can only be assigned to Self (Phase I)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Due Date (only if not recurring) */}
                {!isRecurring && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      min={getTodayDate()}
                      className="w-full h-9 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      data-testid="input-due-date"
                    />
                  </div>
                )}

                {/* Recurrence Panel (only if recurring) */}
                {isRecurring && (
                  <div className="bg-blue-50 border border-blue-200 rounded-sm p-3 sm:p-5 space-y-3 sm:space-y-3">
                    <div className="flex items-center space-x-2 mb-3 sm:mb-3">
                      <span className="text-xl sm:text-2xl">
                        <RecurringTaskIcon
                          size={size}
                          className="flex-shrink-0"
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3
                          className="text-sm sm:text-lg font-semibold text-gray-900 truncate"
                          title="Recurrence Settings"
                        >
                          Recurrence Settings
                        </h3>
                        <p className="text-xs sm:text-sm text-blue-700 line-clamp-2">
                          Configure when and how often this task repeats
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3">
                      {/* Pattern Type */}
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-1">
                          Pattern Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={recurrence.patternType}
                          onChange={(e) =>
                            handleRecurrenceChange(
                              "patternType",
                              e.target.value,
                            )
                          }
                          className="w-full h-9 px-2 sm:px-3 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                          data-testid="select-pattern-type"
                          required={isRecurring}
                        >
                          <option value="">Select pattern...</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>

                      {/* Repeat Every */}
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          Repeat Every <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            min="1"
                            value={recurrence.repeatEvery}
                            onChange={(e) =>
                              handleRecurrenceChange(
                                "repeatEvery",
                                parseInt(e.target.value),
                              )
                            }
                            className="w-20 h-9 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            data-testid="input-repeat-every"
                          />
                          <span className="text-sm text-gray-600">
                            {recurrence.patternType || "period(s)"}
                          </span>
                        </div>
                      </div>

                      {/* Start Date */}
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          Start Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={recurrence.startDate}
                          onChange={(e) =>
                            handleRecurrenceChange("startDate", e.target.value)
                          }
                          min={getTodayDate()}
                          className="w-full h-9 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                          data-testid="input-start-date"
                          required={isRecurring}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          ⏰ Times calculated in assignee's timezone
                        </p>
                      </div>

                      {/* Start Time */}
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={recurrence.startTime}
                          onChange={(e) =>
                            handleRecurrenceChange("startTime", e.target.value)
                          }
                          className="w-full h-9 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                          data-testid="input-start-time"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Default: 9:00 AM
                        </p>
                      </div>
                    </div>

                    {/* Pattern-specific controls */}
                    {recurrence.patternType === "weekly" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          Days of Week <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {weekdayOptions.map((day) => (
                            <label
                              key={day.value}
                              className="flex items-center space-x-2"
                            >
                              <input
                                type="checkbox"
                                checked={recurrence.weekdays.includes(
                                  day.value,
                                )}
                                onChange={(e) => {
                                  const newWeekdays = e.target.checked
                                    ? [...recurrence.weekdays, day.value]
                                    : recurrence.weekdays.filter(
                                        (d) => d !== day.value,
                                      );
                                  handleRecurrenceChange(
                                    "weekdays",
                                    newWeekdays,
                                  );
                                }}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                              />
                              <span className="text-sm">
                                {day.label.slice(0, 3)}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {recurrence.patternType === "monthly" && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-2">
                            Monthly Mode <span className="text-red-500">*</span>
                          </label>
                          <div className="flex space-x-3">
                            <label className="flex items-center">
                              <input
                                type="radio"
                                name="monthlyMode"
                                value="specific_date"
                                checked={
                                  recurrence.monthlyMode === "specific_date"
                                }
                                onChange={(e) =>
                                  handleRecurrenceChange(
                                    "monthlyMode",
                                    e.target.value,
                                  )
                                }
                                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                              />
                              <span className="ml-2 text-sm">
                                Specific Date
                              </span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="radio"
                                name="monthlyMode"
                                value="by_date"
                                checked={recurrence.monthlyMode === "by_date"}
                                onChange={(e) =>
                                  handleRecurrenceChange(
                                    "monthlyMode",
                                    e.target.value,
                                  )
                                }
                                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                              />
                              <span className="ml-2 text-sm">By Date(s)</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="radio"
                                name="monthlyMode"
                                value="by_position"
                                checked={
                                  recurrence.monthlyMode === "by_position"
                                }
                                onChange={(e) =>
                                  handleRecurrenceChange(
                                    "monthlyMode",
                                    e.target.value,
                                  )
                                }
                                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                              />
                              <span className="ml-2 text-sm">By Position</span>
                            </label>
                          </div>
                        </div>

                        {recurrence.monthlyMode === "specific_date" && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Day of Month (1-31)
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="31"
                              value={recurrence.specificDate}
                              onChange={(e) =>
                                handleRecurrenceChange(
                                  "specificDate",
                                  e.target.value,
                                )
                              }
                              className="w-20 h-9 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                              placeholder="15"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              If day doesn't exist (e.g., 31st Feb), it will be
                              clamped to the last valid day
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {recurrence.patternType === "yearly" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">
                            Month(s) <span className="text-red-500">*</span>
                          </label>
                          <select
                            multiple
                            value={recurrence.yearMonths}
                            onChange={(e) => {
                              const selected = Array.from(
                                e.target.selectedOptions,
                                (option) => parseInt(option.value),
                              );
                              handleRecurrenceChange("yearMonths", selected);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            size="4"
                          >
                            {monthOptions.map((month) => (
                              <option key={month.value} value={month.value}>
                                {month.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Day of Month
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="31"
                            value={recurrence.yearDay}
                            onChange={(e) =>
                              handleRecurrenceChange("yearDay", e.target.value)
                            }
                            className="w-20 h-9 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            placeholder="1"
                          />
                        </div>
                      </div>
                    )}

                    {/* End Condition */}
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        End Condition <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={recurrence.endCondition}
                        onChange={(e) =>
                          handleRecurrenceChange("endCondition", e.target.value)
                        }
                        className="w-full h-9 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        data-testid="select-end-condition"
                        required={isRecurring}
                      >
                        <option value="never">Never ends</option>
                        <option value="after">Ends after N occurrences</option>
                        <option value="by_date">Ends by Date</option>
                      </select>

                      {recurrence.endCondition === "after" && (
                        <div className="mt-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Number of Occurrences
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={recurrence.occurrences}
                            onChange={(e) =>
                              handleRecurrenceChange(
                                "occurrences",
                                e.target.value,
                              )
                            }
                            className="w-32 h-9 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            placeholder="12"
                          />
                        </div>
                      )}

                      {recurrence.endCondition === "by_date" && (
                        <div className="mt-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            End Date
                          </label>
                          <input
                            type="date"
                            value={recurrence.endDate}
                            onChange={(e) =>
                              handleRecurrenceChange("endDate", e.target.value)
                            }
                            min={recurrence.startDate}
                            className="w-full h-9 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      )}
                    </div>

                    {/* Preview */}
                    {recurrence.patternType && recurrence.startDate && (
                      <div className="bg-white border border-gray-200 rounded-sm p-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">
                          Next 5 Dates Preview
                        </h4>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {generatePreview().map((date, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                            >
                              {date}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-gray-600">
                          💡 System generates task instances automatically for
                          upcoming 30 days using Just-In-Time (JIT) scheduling
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Assigned To, Contributors and Priority */}
              <div className="space-y-3 sm:space-y-3">
                {/* Mobile: Stack all fields, Desktop: Group Assigned To and Priority */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3">
                  {/* Assignment Section - Phase I RBAC: Conditionally show based on permissions */}
                  {assignmentRestrictions.canAssignToOthers ? (
                    <div className="sm:col-span-1">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        Assigned To <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={assignedTo}
                        onChange={(e) => setAssignedTo(e.target.value)}
                        className="w-full h-9 px-2 sm:px-3 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        data-testid="select-assigned-to"
                        required
                      >
                        <option value="">Select assignee</option>
                        {assignmentOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="sm:col-span-1">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        Assigned To <span className="text-red-500">*</span>
                      </label>
                      <div className="w-full h-9 px-2 sm:px-3 flex items-center text-xs sm:text-sm border border-gray-200 rounded-sm bg-gray-50 text-gray-700">
                        Myself (Self-assigned)
                      </div>
                      <p className="text-xs text-amber-600 mt-1 leading-tight">
                        ℹ️ {assignmentRestrictions.restriction}
                      </p>
                    </div>
                  )}

                  {/* Priority */}
                  <div className="sm:col-span-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Priority <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full h-9 px-2 sm:px-3 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      data-testid="select-priority"
                    >
                      <option value="Low">Low</option>
                      <option value="Normal">Normal</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                </div>

                {/* Contributors Section - Full width */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Contributors / Labels / Tags
                  </label>
                  <select
                    multiple
                    value={contributors}
                    onChange={(e) => {
                      const selected = Array.from(
                        e.target.selectedOptions,
                        (option) => option.value,
                      );
                      setContributors(selected);
                    }}
                    className="w-full px-2 sm:px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px]"
                    size="2"
                    data-testid="select-contributors"
                  >
                    {collaboratorOptions
                      .filter((option) => option.value !== assignedTo)
                      .map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1 leading-tight">
                    Contributors can view/comment on tasks
                  </p>
                </div>
              </div>
            </div>

            {/* Notes / Instructions Section */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Notes / Instructions
              </label>
              <textarea
                placeholder="Add any additional notes or instructions..."
                className="w-full px-2 sm:px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
              />
              <p className="text-xs text-gray-500 mt-1 leading-tight">
                Optional additional information
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3 sm:px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors order-2 sm:order-1"
              data-testid="button-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!taskName || !assignedTo}
              className="px-3 sm:px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md transition-colors order-1 sm:order-2"
              data-testid="button-create-task"
            >
              {isRecurring ? "Create Recurring Task" : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TaskCreationModal;
