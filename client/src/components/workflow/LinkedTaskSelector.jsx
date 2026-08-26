/**
 * LinkedTaskSelector — Phase 4 & 6 Frontend Component
 *
 * Linked Task Engine (Dependency) & Auto Initiate configuration.
 * Rules:
 *  - Displays eligible previous tasks (lower sequence, same parent, unlinked)
 *  - When a linked task is selected, shows the "Auto Initiate" toggle option.
 */

import React, { useState, useEffect } from "react";
import { Link2, PlayCircle, AlertCircle } from "lucide-react";
import { apiClient } from "../../utils/apiClient";

/**
 * @param {Object} props
 * @param {string} props.parentTaskId - Parent process/task ID
 * @param {number} props.sequence - Current task sequence order
 * @param {string} [props.excludeTaskId] - Current task ID to exclude
 * @param {string} props.linkedTaskId - Currently selected linked task ID
 * @param {Function} props.onLinkedTaskChange - Called with selected linkedTaskId
 * @param {boolean} props.autoInitiate - Current autoInitiate boolean value
 * @param {Function} props.onAutoInitiateChange - Called with boolean autoInitiate value
 * @param {boolean} [props.disabled]
 */
export default function LinkedTaskSelector({
  parentTaskId,
  sequence = 1,
  excludeTaskId = null,
  linkedTaskId = null,
  onLinkedTaskChange,
  autoInitiate = false,
  onAutoInitiateChange,
  disabled = false,
  label = "Linked Task (Prerequisite Dependency)",
  isRequired = false,
  error = null,
  previousSteps = [],
}) {
  const [eligibleTasks, setEligibleTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  const prevStepsKey = JSON.stringify(previousSteps || []);

  useEffect(() => {
    let isCancelled = false;

    if (previousSteps && previousSteps.length > 0) {
      const formatted = previousSteps.map((st, idx) => ({
        _id: st.id || `step_${idx}`,
        title: st.name || st.title || `Step ${idx + 1}`,
        sequence: idx + 1,
        taskType: (st.taskType || "regular").toLowerCase(),
      }));
      setEligibleTasks(formatted);
      setLoading(false);
    } else if (parentTaskId) {
      setLoading(true);
      apiClient
        .get(`/api/workflow/tasks/${parentTaskId}/eligible-linked-tasks`, {
          params: { sequence, excludeId: excludeTaskId },
        })
        .then((res) => {
          if (!isCancelled && res.data?.success) {
            setEligibleTasks(res.data.data || []);
          }
        })
        .catch((err) => {
          if (!isCancelled) {
            console.error("Failed to fetch eligible linked tasks", err);
          }
        })
        .finally(() => {
          if (!isCancelled) {
            setLoading(false);
          }
        });
    } else {
      setEligibleTasks([]);
      setLoading(false);
    }

    return () => {
      isCancelled = true;
    };
  }, [parentTaskId, sequence, excludeTaskId, prevStepsKey]);

  // If no existing subtasks are available to link to, show notice
  if (!loading && eligibleTasks.length === 0) {
    return (
      <div className="mb-4 space-y-1">
        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1 flex items-center gap-1.5">
          <Link2 className="w-4 h-4 text-blue-600" /> {label}
          {isRequired && <span className="text-red-500">*</span>}
        </label>
        <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-md border border-amber-200 flex items-center gap-1.5 font-medium">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            {isRequired
              ? "An Approval Subtask requires a previous subtask as a prerequisite context task, but no previous subtasks exist under this parent task."
              : "First task in sequence (no previous subtasks available to link)."}
          </span>
        </div>
        {error && (
          <p className="text-red-500 text-xs mt-1 flex items-center gap-1 font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`mb-4 space-y-3 p-3 bg-gray-50 border rounded-lg ${error ? "border-red-400 bg-red-50/20" : "border-gray-200"}`}>
      <div>
        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1 flex items-center gap-1.5">
          <Link2 className="w-4 h-4 text-blue-600" /> {label}
          {isRequired && <span className="text-red-500">*</span>}
        </label>
        <select
          value={linkedTaskId || ""}
          onChange={(e) => {
            const selected = e.target.value || null;
            onLinkedTaskChange(selected);
            if (!selected && onAutoInitiateChange) {
              onAutoInitiateChange(false);
            }
          }}
          disabled={disabled || loading}
          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:border-2 bg-white ${
            error ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"
          }`}
        >
          <option value="">
            {isRequired ? "— Select a prerequisite context task (Required) —" : "— No dependency (Can start anytime) —"}
          </option>
          {eligibleTasks.map((t, idx) => (
            <option key={t._id} value={t._id}>
              Subtask {t.sequence || idx + 1}: {t.title} ({t.taskType || "regular"})
            </option>
          ))}
        </select>
        {error && (
          <p className="text-red-500 text-xs mt-1 flex items-center gap-1 font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          This task will depend on the selected subtask being completed.
        </p>
      </div>

      {/* Auto Initiate Toggle — Only available when a linked task is selected */}
      {linkedTaskId && (
        <div className="pt-2 border-t border-gray-200">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoInitiate}
              onChange={(e) => onAutoInitiateChange && onAutoInitiateChange(e.target.checked)}
              disabled={disabled}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
              <PlayCircle className="w-4 h-4 text-green-600" /> Auto Initiate Task
            </span>
          </label>
          <p className="text-xs text-gray-500 ml-6 mt-0.5">
            Automatically transition this task from <code className="bg-gray-100 px-1 rounded text-blue-600 font-mono">OPEN</code> → <code className="bg-gray-100 px-1 rounded text-blue-600 font-mono">IN_PROGRESS</code> as soon as the linked task is Completed. No manual click required.
          </p>
        </div>
      )}
    </div>
  );
}
