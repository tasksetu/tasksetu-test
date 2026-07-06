import React, { useState, useEffect } from "react";
import { apiClient } from "../utils/apiClient";
import { SearchableSelect } from "../components/ui/SearchableSelect";
import { MultiSelect } from "../components/ui/MultiSelect";
import ReactQuill from "react-quill";
import { useTaskPriorities } from "../hooks/useTaskPriorities";
import { getPriorityOptions } from "../utils/priorityUtils";
export function MilestoneForm({
  formData,
  handleInputChange,
  validationErrors = {},
  today,
}) {
  const [existingTasks, setExistingTasks] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState(null);

  const { data: taskPriorities = [] } = useTaskPriorities();
  const priorityOptions = getPriorityOptions(taskPriorities);

  const toDatetimeLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const getCurrentDateTime = () => toDatetimeLocal(new Date());

  const handleMilestoneChange = (field, value) => {
    handleInputChange("milestone", {
      ...formData.milestone,
      [field]: value,
    });
  };

  // Fetch existing tasks for linking
  useEffect(() => {
    const fetchExistingTasks = async () => {
      try {
        setIsLoadingTasks(true);
        setTasksError(null);
        const response = await apiClient.get(
          "/api/tasks/available-for-linking",
        );

        console.log("🔹 [MILESTONE FORM] Fetched tasks:", response.data);

        if (
          response.data.success &&
          response.data.data &&
          response.data.data.tasks
        ) {
          // First map tasks to a flat list with hierarchy indicators, then set state
          // MAP TASKS AND SUBTASKS WITH HIERARCHY

          const taskOptions = [];

          response.data.data.tasks.forEach((task) => {
            console.log(`🚀 [MILESTONE FORM] Processing task: ${task.title}`, {
              _id: task._id,
              hasSubtasks: task.hasSubtasks,
              subtaskCount: task.subtaskCount || 0,
            });

            // Add parent task
            taskOptions.push({
              value: task._id,
              label: `🚀 ${task.title} ${task.status ? `(${task.status})` : ""}`,
              taskType: task.taskType,
              status: task.status,
              isParent: true,
            });

            // Add subtasks if available
            if (task.subtasks && task.subtasks.length > 0) {
              task.subtasks.forEach((subtask) => {
                console.log(`   🔹 [MILESTONE FORM] Subtask: ${subtask.title}`);
                taskOptions.push({
                  value: subtask._id,
                  label: `   🔹 ${subtask.title} (Subtask) ${subtask.status ? `(${subtask.status})` : ""}`,
                  taskType: "subtask",
                  status: subtask.status,
                  isSubtask: true,
                  parentTaskId: subtask.parentTaskId,
                });
              });
            }
          });

          console.log(
            "🔹 [MILESTONE FORM] Mapped task options:",
            taskOptions.length,
            "(tasks + subtasks)",
          );
          setExistingTasks(taskOptions);
        }
      } catch (error) {
        console.error("⚠️ [MILESTONE FORM] Error fetching tasks:", error);
        setTasksError("Failed to load tasks");
        setExistingTasks([]);
      } finally {
        setIsLoadingTasks(false);
      }
    };

    // Only fetch when milestone type is 'linked'
    if (formData.milestone?.type === "linked") {
      fetchExistingTasks();
    }
  }, [formData.milestone?.type]);

  return (
    <div className="space-y-3">
      {/* Milestone Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Milestone Type *
        </label>
        <select
          value={formData.milestone?.type || "standalone"}
          onChange={(e) => handleMilestoneChange("type", e.target.value)}
          className="w-full h-9 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="select-milestone-type"
          required
        >
          <option value="standalone">Standalone</option>
          <option value="linked">Linked</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Standalone milestones are independent. Linked milestones depend on
          other tasks.
        </p>
      </div>

      {/* Link to Tasks/Sub-tasks - Only visible if Milestone Type = Linked */}
      {formData.milestone?.type === "linked" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Link to Tasks/Sub-tasks
          </label>
          {isLoadingTasks ? (
            <div className="w-full h-9 px-3 flex items-center border border-gray-300 rounded-sm bg-gray-50 text-gray-500 text-sm">
              Loading tasks...
            </div>
          ) : tasksError ? (
            <div className="w-full h-9 px-3 flex items-center border border-red-300 rounded-sm bg-red-50 text-red-600 text-sm">
              {tasksError}
            </div>
          ) : existingTasks.length === 0 ? (
            <div className="w-full h-9 px-3 flex items-center border border-gray-300 rounded-sm bg-gray-50 text-gray-500 text-sm">
              No tasks available for linking. Create some regular tasks first.
            </div>
          ) : (
            <MultiSelect
              options={existingTasks}
              value={formData.milestone?.linkedTasks || []}
              onChange={(selectedValues) =>
                handleMilestoneChange("linkedTasks", selectedValues)
              }
              placeholder="Search and select tasks..."
              dataTestId="multi-select-milestone-tasks"
            />
          )}
          <p className="text-xs text-gray-500 mt-1">
            Select tasks to link to this milestone. Progress will auto-calculate
            based on linked task completion.
          </p>
          {validationErrors.linkedTasks && (
            <p
              className="text-red-600 text-sm mt-1"
              data-testid="error-linked-tasks"
            >
              {validationErrors.linkedTasks}
            </p>
          )}
        </div>
      )}

      {/* Due Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Due Date *
        </label>
        <input
          type="datetime-local"
          value={formData.milestone?.dueDate || ""}
          onChange={(e) => handleMilestoneChange("dueDate", e.target.value)}
          min={getCurrentDateTime()}
          className={`w-full h-9 px-3 border rounded-md focus:outline-none focus:ring-2 transition-colors ${
            validationErrors.milestoneDueDate
              ? "border-red-300 focus:ring-red-500"
              : "border-gray-300 focus:ring-blue-500"
          }`}
          required
          data-testid="input-milestone-due-date"
        />
        {formData.milestone?.type === "linked" && (
          <p className="text-xs text-blue-600 mt-1">
            If Linked: default = latest due date among dependencies
          </p>
        )}
        {validationErrors.milestoneDueDate && (
          <p
            className="text-red-600 text-sm mt-1"
            data-testid="error-milestone-due-date"
          >
            {validationErrors.milestoneDueDate}
          </p>
        )}
      </div>

      {/* Assigned To */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Assigned To *
        </label>
        <SearchableSelect
          options={[{ value: "self", label: "Self" }]}
          value={formData.milestone?.assignedTo || "self"}
          onChange={(option) =>
            handleMilestoneChange("assignedTo", option ? option.value : "self")
          }
          placeholder="Select assignee"
          dataTestId="searchable-select-milestone-assignee"
        />
        <p className="text-xs text-gray-500 mt-1">
          Single select search dropdown (1 user only).
        </p>
        {validationErrors.assignedTo && (
          <p
            className="text-red-600 text-sm mt-1"
            data-testid="error-assigned-to"
          >
            {validationErrors.assignedTo}
          </p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description (Optional)
        </label>
        <div className="border border-gray-300 rounded-sm">
          <ReactQuill
            value={formData.milestone?.description || ""}
            onChange={(content) =>
              handleMilestoneChange("description", content)
            }
            theme="snow"
            placeholder="Describe the milestone objectives and success criteria..."
            className="custom-editor bg-white"
            data-testid="rich-text-milestone-description"
            modules={{
              toolbar: [
                [{ header: [1, 2, 3, false] }],
                ["bold", "italic", "underline"],
                [{ list: "ordered" }, { list: "bullet" }],
                ["link"],
                ["clean"],
              ],
            }}
          />
        </div>
      </div>

      {/* Visibility */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Visibility *
        </label>
        <select
          value={formData.milestone?.visibility || "private"}
          onChange={(e) => handleMilestoneChange("visibility", e.target.value)}
          className="w-full h-9 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="select-milestone-visibility"
          required
        >
          <option value="private">Private</option>
          <option value="project">Project Team</option>
          <option value="organization">Organization</option>
          <option value="public">Public</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          If created under a project: inherit project visibility.
        </p>
      </div>

      {/* Priority */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Priority (Optional)
        </label>
        <select
          value={formData.milestone?.priority || "medium"}
          onChange={(e) => handleMilestoneChange("priority", e.target.value)}
          className="w-full h-9 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="select-milestone-priority"
        >
          {priorityOptions.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Collaborators */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Collaborators (Optional)
        </label>
        <MultiSelect
          options={[]}
          value={formData.milestone?.collaborators || []}
          onChange={(selectedValues) =>
            handleMilestoneChange("collaborators", selectedValues)
          }
          placeholder="Select collaborators..."
          dataTestId="multi-select-milestone-collaborators"
        />
        <p className="text-xs text-gray-500 mt-1">
          Notify collaborators on milestone completion.
        </p>
      </div>
    </div>
  );
}

export default MilestoneForm;
