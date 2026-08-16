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
}) {
  const [eligibleTasks, setEligibleTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (parentTaskId) {
      fetchEligibleLinkedTasks();
    } else {
      setEligibleTasks([]);
    }
  }, [parentTaskId, sequence, excludeTaskId]);

  const fetchEligibleLinkedTasks = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(
        `/api/workflow/tasks/${parentTaskId}/eligible-linked-tasks`,
        {
          params: { sequence, excludeId: excludeTaskId },
        },
      );
      if (res.data?.success) {
        setEligibleTasks(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch eligible linked tasks", err);
    } finally {
      setLoading(false);
    }
  };

  // If no existing subtasks are available to link to, show first task notice
  if (!loading && eligibleTasks.length === 0) {
    return (
      <div className="mb-4 text-xs text-gray-500 italic bg-gray-50 p-2.5 rounded-md border border-gray-200 flex items-center gap-1.5">
        <Link2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <span>First task in sequence (no previous subtasks available to link).</span>
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
      <div>
        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1 flex items-center gap-1.5">
          <Link2 className="w-4 h-4 text-blue-600" /> {label}
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
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:border-2 bg-white"
        >
          <option value="">— No dependency (Can start anytime) —</option>
          {eligibleTasks.map((t, idx) => (
            <option key={t._id} value={t._id}>
              Subtask {t.sequence || idx + 1}: {t.title} ({t.taskType || "regular"})
            </option>
          ))}
        </select>
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
