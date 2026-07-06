import React from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import TaskStatusDropdown from "./TaskStatusDropdown";
import TaskActionsDropdown from "./TaskActionsDropdown";
import SubtaskActionsDropdown from "./SubtaskActionsDropdown";
import {
  getTaskType,
  getTaskColorCode,
  getPriorityBadge,
  canEditTaskStatus,
  canMarkAsCompleted,
} from "../../utils/taskHelpers";
import { ClockAlert, ClockAlertIcon, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

const TaskTable = React.memo(function TaskTable({
  paginatedTasks,
  statusSort,
  onStatusSortToggle,
  expandedTasks,
  editingTaskId,
  editingTitle,
  setEditingTitle,
  handleTaskTitleClick,
  handleTitleSave,
  handleTitleCancel,
  handleTitleKeyDown,
  editingSubtaskId,
  editingSubtaskTitle,
  setEditingSubtaskTitle,
  handleSubtaskTitleClick,
  handleSubtaskTitleSave,
  handleSubtaskTitleCancel,
  handleSubtaskTitleKeyDown,
  handleToggleTaskExpansion,
  handleNavigateToTask,
  handleSubtaskStatusChange,
  handleSnoozeTask,
  handleMarkAsRisk,
  handleQuickMarkAsDone,
  handleDeleteTask,
  handleEditSubtask,
  handleDeleteSubtask,
  selectedTasks,
  companyStatuses,
  taskPriorities,
  currentUser,
  snoozedTasks,
  getTaskStatus,
  canEditTaskStatusFn,
  canMarkAsCompletedFn,
  applyTaskStatusUpdateFromDropdown,
}) {
  const truncateTitle = (title) => {
    if (!title) return "";
    return title.length > 35 ? title.substring(0, 35) + "..." : title;
  };

  const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const formatDateTime = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";

    const day = d.getUTCDate();
    const month = MONTH_NAMES[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    const utcH = d.getUTCHours();
    const utcM = d.getUTCMinutes();
    const ampm = utcH >= 12 ? "PM" : "AM";
    const hour12 = utcH % 12 || 12;
    const minStr = utcM.toString().padStart(2, "0");

    return `${day} ${month} ${year} at ${hour12}:${minStr} ${ampm}`;
  };

  // For recurring tasks: show date from dueDate (or startDate) + time from recurringConfig.startTime.
  // Pass overrideDateStr to use a different date (e.g. nextDueDate) while still using startTime.
  // For regular tasks: fall back to formatDateTime.
  const getTaskDisplayDueDate = (task, overrideDateStr) => {
    if (task?.isRecurring && task?.recurringConfig?.startTime) {
      const dateStr =
        overrideDateStr || task.dueDate || task.recurringConfig?.startDate;
      if (!dateStr) return "-";
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "-";

      const day = d.getUTCDate();
      const month = MONTH_NAMES[d.getUTCMonth()];
      const year = d.getUTCFullYear();

      // Parse "HH:mm" startTime
      const [hStr, mStr] = task.recurringConfig.startTime.split(":");
      const h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10) || 0;
      const ampm = h >= 12 ? "PM" : "AM";
      const hour12 = h % 12 || 12;
      const minStr = m.toString().padStart(2, "0");

      return `${day} ${month} ${year} at ${hour12}:${minStr} ${ampm}`;
    }
    return formatDateTime(overrideDateStr || task?.dueDate);
  };

  // Helper function to check if task is overdue
  // The backend stores the user's local time directly as UTC (no timezone conversion).
  // So we compare dueDate against a "displayNow" that also uses local time as UTC,
  // keeping both sides on the same convention.
  const getDisplayNow = () => {
    const now = new Date();
    return new Date(Date.UTC(
      now.getFullYear(), now.getMonth(), now.getDate(),
      now.getHours(), now.getMinutes(), now.getSeconds()
    ));
  };

  const isTaskOverdue = (task) => {
    if (!task?.dueDate) return false;
    const status = (task.status || "").toUpperCase();
    // Completed or cancelled tasks are NEVER overdue
    if (status === "DONE" || status === "COMPLETED" || status === "CANCELLED") {
      return false;
    }
    return new Date(task.dueDate) < getDisplayNow();
  };

  return (
    <div className="card p-0 flex-1 flex flex-col min-h-0 border-b-0 rounded-md overflow-hidden">
      <Table
        wrapperClassName="w-full flex-1 overflow-auto scroll-container scrollbar-hide rounded-md"
        className="w-full"
      >
        <TableHeader className="sticky top-0 z-[50] bg-white shadow-sm">
          <TableRow style={{ borderLeft: "4px solid transparent" }}>
            <TableHead className="px-6 py-2 text-left text-xs font-medium text-gray-900 uppercase tracking-wider text-nowrap sticky top-0 bg-white z-[50] w-[320px] min-w-[320px] max-w-[320px]">
              Task
            </TableHead>
            <TableHead className="px-6 py-2 text-left text-xs font-medium text-gray-900 uppercase tracking-wider text-nowrap sticky top-0 bg-white z-[50]">
              Assignee
            </TableHead>
            <TableHead 
              className="px-6 py-2 text-left text-xs font-medium text-gray-900 uppercase tracking-wider text-nowrap sticky top-0 bg-white z-[50] cursor-pointer select-none hover:bg-gray-50 transition-colors"
              onClick={onStatusSortToggle}
            >
              <div className="flex items-center gap-1">
                Status
                <ArrowUpDown 
                  className={`w-3.5 h-3.5 inline-block ${statusSort !== "none" ? "text-blue-600 font-bold" : "text-gray-400"}`} 
                />
              </div>
            </TableHead>
            <TableHead className="px-6 py-2 text-left text-xs font-medium text-gray-900 uppercase tracking-wider text-nowrap sticky top-0 bg-white z-[50]">
              Priority
            </TableHead>
            <TableHead className="px-6 py-2 text-left text-xs font-medium text-gray-900 uppercase tracking-wider text-nowrap sticky top-0 bg-white z-[50]">
              Due Date-Time
            </TableHead>
            <TableHead className="px-6 py-2 text-left text-xs font-medium text-gray-900 uppercase tracking-wider text-nowrap sticky top-0 bg-white z-[50]">
              Progress
            </TableHead>
            <TableHead className="px-6 py-2 text-left text-xs font-medium text-gray-900 uppercase tracking-wider text-nowrap sticky top-0 bg-white z-[50]">
              Tags
            </TableHead>
            <TableHead className="px-6 py-2 text-left text-xs font-medium text-gray-900 uppercase tracking-wider text-nowrap sticky top-0 bg-white z-[50]">
              Task Type
            </TableHead>
            <TableHead className="px-6 py-2 text-left text-xs font-medium text-gray-900 uppercase tracking-wider text-nowrap sticky top-0 right-0 bg-white z-[60] shadow-[-4px_4px_6px_-2px_rgba(0,0,0,0.08)]">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody className="isolate">
          {paginatedTasks.map((task) => {
            const isOverdueTask = isTaskOverdue(task);

            return (
              <React.Fragment key={task.id}>
                {/* Main Task Row */}
                <TableRow
                  className={`hover:bg-gray-50 transition-colors cursor-pointer${
                    isOverdueTask ? " bg-red-50" : ""
                  }${selectedTasks.includes(task.id) ? " bg-blue-50" : ""}`}
                  onClick={() => handleNavigateToTask(task.id || task._id)}
                >
                  {/* Task Title Cell */}
                  <TableCell className="px-6 py-1.5 text-nowrap w-[320px] min-w-[320px] max-w-[320px]" style={{ borderLeft: `4px solid ${getTaskColorCode(task, companyStatuses)}` }}>
                    <div className="font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        {/* Expand Button - Shows for Subtasks OR Recurring Instances */}
                        {(task.subtasks?.length > 0 ||
                          (task.hasRecurringInstances &&
                            task.recurringInstances?.length > 0)) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleTaskExpansion(task.id);
                            }}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200 gap-1"
                            title={
                              expandedTasks.has(task.id) ? "Collapse" : "Expand"
                            }
                          >
                            <svg
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <circle cx="5" cy="5" r="2" fill="currentColor" />
                              <circle
                                cx="5"
                                cy="12"
                                r="2"
                                fill="currentColor"
                              />
                              <circle
                                cx="5"
                                cy="19"
                                r="2"
                                fill="currentColor"
                              />
                              <path
                                d="M5 7V10"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                              <path
                                d="M5 14V17"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                              <path
                                d="M7 12H14"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                              <path
                                d="M7 19H14"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                            </svg>
                            {/* Subtasks count */}
                            {task.subtasks?.length > 0 && (
                              <span title="Subtasks" className="text-xs">
                                {task.subtasks.length} sub
                              </span>
                            )}
                            {/* Recurring instances count +1 (include the parent/pattern task itself) */}
                            {task.hasRecurringInstances &&
                              task.recurringInstances?.length > 0 && (
                                <span
                                  title="Recurring instances"
                                  className="text-xs text-green-700"
                                >
                                  🔄 {task.recurringInstances.length + 1}
                                </span>
                              )}
                          </button>
                        )}

                        {editingTaskId === task.id ? (
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => {
                              e.stopPropagation();
                              setEditingTitle(e.target.value);
                            }}
                            onBlur={() => handleTitleSave(task.id)}
                            onKeyDown={(e) => handleTitleKeyDown(e, task.id)}
                            className="w-full px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                        ) : (
                          <>
                            {task.isRecurringPattern && (
                              <span
                                className="text-green-800 cursor-help"
                                title="Recurring Task Pattern"
                              >
                                <span className="text-green-600">🔄</span>
                              </span>
                            )}
                            {task.isApprovalTask && (
                              <span
                                className="text-orange-600 cursor-help"
                                title="Approval Task"
                              >
                                ✅
                              </span>
                            )}
                            {task.taskType === "milestone" && (
                              <span
                                className="text-purple-600 cursor-help"
                                title="Milestone"
                              >
                                🎯
                              </span>
                            )}
                            <span
                              className="cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-all duration-200 inline-block flex-1 editable-task-title"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTaskTitleClick(task);
                              }}
                              title={task.title}
                            >
                              {task.isRisk && (
                                <span
                                  className="text-yellow-700 cursor-help"
                                  title={`Risk: ${task.riskLevel || "medium"}`}
                                >
                                  ⚠️
                                </span>
                              )}
                              {(snoozedTasks.has(task.id) || task.isSnooze) && (
                                <span
                                  className="text-emerald-700 cursor-help"
                                  title="Snoozed"
                                >
                                  ⏸️
                                </span>
                              )}
                              {/* {isOverdueTask && (
                              <span className="text-red-600 ml-1 text-xs font-bold">
                                [OVERDUE] 
                                <ClockAlertIcon/>
                              </span>
                            )} */}
                              {truncateTitle(task.title)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Assignee Cell */}
                  <TableCell className="px-6 py-1.5 text-nowrap">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                        <span className="text-xs font-medium text-gray-600">
                          {task.assignee
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("") || "UN"}
                        </span>
                      </div>
                      <span className="text-sm text-gray-900">
                        {task.assignee || "Unassigned"}
                      </span>
                    </div>
                  </TableCell>

                  {/* Status Cell */}
                  <TableCell className="px-6 py-1.5 text-nowrap text-left">
                    {task.isApprovalTask ? (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium text-white ${
                          task.status === "CANCELLED"
                            ? "bg-gray-500"
                            : task.approvalStatus === "approved"
                              ? "bg-green-600"
                              : task.approvalStatus === "rejected"
                                ? "bg-red-600"
                                : "bg-yellow-600"
                        }`}
                      >
                        {task.status === "CANCELLED"
                          ? "Cancelled"
                          : task.approvalStatus === "approved"
                            ? "Approved"
                            : task.approvalStatus === "rejected"
                              ? "Rejected"
                              : "Pending"}
                      </span>
                    ) : (
                      <div onClick={(e) => e.stopPropagation()}>
                        <TaskStatusDropdown
                          task={task}
                          currentStatus={task.status}
                          statuses={[
                            ...companyStatuses,
                            {
                              code: "APPROVED",
                              label: "Approved",
                              color: "#16a34a",
                              active: true,
                              allowedTransitions: [],
                            },
                            {
                              code: "REJECTED",
                              label: "Rejected",
                              color: "#dc2626",
                              active: true,
                              allowedTransitions: [],
                            },
                          ]}
                          onStatusChange={(newStatus) =>
                            applyTaskStatusUpdateFromDropdown(
                              task.id ?? task._id,
                              newStatus,
                            )
                          }
                          canEdit={canEditTaskStatusFn(task, currentUser)}
                          canMarkCompleted={canMarkAsCompletedFn(task)}
                        />
                      </div>
                    )}
                  </TableCell>

                  {/* Priority Cell */}
                  <TableCell className="px-6 py-1.5 text-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 uppercase text-gray-900">
                      {task.priority}
                    </span>
                  </TableCell>

                  {/* Due Date-Time Cell */}
                  <TableCell className="px-6 py-2 text-sm text-gray-900 text-nowrap">
                    <div className="flex flex-col">
                      <span
                        className={
                          isOverdueTask ? "text-red-600 font-semibold" : ""
                        }
                      >
                        {getTaskDisplayDueDate(task)}
                      </span>
                      {task.nextDueDate && (
                        <span className="text-xs text-green-600 font-medium mt-0.5">
                          Next: {getTaskDisplayDueDate(task, task.nextDueDate)}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Progress Cell */}
                  <TableCell className="px-6 py-1.5 text-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            task.approvalStatus === "rejected"
                              ? "bg-red-600"
                              : task.approvalStatus === "approved"
                                ? "bg-green-600"
                                : "bg-blue-600"
                          }`}
                          style={{ width: `${task.progress || 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 min-w-[24px]">
                        {task.progress || 0}%
                      </span>
                    </div>
                  </TableCell>

                  {/* Tags Cell */}
                  <TableCell className="px-6 py-1.5 text-nowrap">
                    <div className="flex flex-wrap gap-1 items-center">
                      {task.tags?.length > 0 ? (
                        <>
                          {task.tags.slice(0, 2).map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                            >
                              {tag}
                            </span>
                          ))}
                          {task.tags.length > 2 && (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                              title={task.tags.join(", ")}
                            >
                              +{task.tags.length - 2} more
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </div>
                  </TableCell>

                  {/* Task Type Cell */}
                  <TableCell className="px-6 py-1.5 text-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-900">
                        {task.isRecurringPattern
                          ? "Recurring Task"
                          : getTaskType(task)}
                      </span>
                      {task.source === "email" && (
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700"
                          title="Created from email"
                        >
                          📧
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Actions Cell - sticky right */}
                  <TableCell className="px-6 py-1.5 text-nowrap sticky right-0 bg-white z-[60] shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)]">
                    <div
                      className="flex items-center justify-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <TaskActionsDropdown
                        task={task}
                        currentUser={currentUser}
                        onSnooze={(snoozeData) =>
                          handleSnoozeTask(task.id, snoozeData)
                        }
                        onMarkAsRisk={(riskData) =>
                          handleMarkAsRisk(task.id, riskData)
                        }
                        onMarkAsDone={() => handleQuickMarkAsDone(task.id)}
                        onQuickMarkAsDone={(forceComplete) =>
                          handleQuickMarkAsDone(task.id, forceComplete)
                        }
                        onCancelApproval={(reason) =>
                          applyTaskStatusUpdateFromDropdown(
                            task.id ?? task._id,
                            "CANCELLED",
                            reason,
                          )
                        }
                        onDelete={() => handleDeleteTask(task.id)}
                      />
                    </div>
                  </TableCell>
                </TableRow>

                {/* Subtask Rows */}
                {expandedTasks.has(task.id) &&
                  task.subtasks?.map((subtask) => {
                    const isSubtaskOverdue = isTaskOverdue(subtask);
                    return (
                      <TableRow
                        key={`subtask-${subtask.id}`}
                        className={`bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer ${
                          isSubtaskOverdue ? "bg-red-50" : ""
                        }`}
                        onClick={() =>
                          handleNavigateToTask(subtask.id || subtask._id)
                        }
                      >
                        <TableCell
                          className="px-6 py-1 w-[320px] min-w-[320px] max-w-[320px]"
                          style={{ borderLeft: "4px solid transparent" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-2 pl-8">
                            <span className="text-blue-500">↳</span>
                            {editingSubtaskId ===
                            (subtask._id || subtask.id) ? (
                              <input
                                type="text"
                                value={editingSubtaskTitle}
                                onChange={(e) =>
                                  setEditingSubtaskTitle(e.target.value)
                                }
                                onBlur={() =>
                                  handleSubtaskTitleSave(
                                    subtask._id || subtask.id,
                                    task._id || task.id,
                                  )
                                }
                                onKeyDown={(e) =>
                                  handleSubtaskTitleKeyDown(
                                    e,
                                    subtask._id || subtask.id,
                                    task._id || task.id,
                                  )
                                }
                                className="font-medium text-gray-800 bg-white border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
                                autoFocus
                              />
                            ) : (
                              <span
                                className="font-medium text-gray-800 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-all duration-200 inline-block flex-1"
                                onClick={() =>
                                  handleSubtaskTitleClick(
                                    subtask,
                                    task._id || task.id,
                                  )
                                }
                                title={subtask.title}
                              >
                                {subtask.isRisk && (
                                  <span className="text-yellow-700 cursor-help">
                                    ⚠️
                                  </span>
                                )}
                                {subtask.isSnooze && (
                                  <span className="text-emerald-700 cursor-help">
                                    ⏸️
                                  </span>
                                )}
                                {isSubtaskOverdue && (
                                  <span className="text-red-600 ml-1 text-xs font-bold">
                                    [OVERDUE]
                                  </span>
                                )}
                                {truncateTitle(subtask.title)}
                              </span>
                            )}
                          </div>
                          <div
                            className="text-xs text-gray-500 pl-7 truncate max-w-[190px]"
                            title={`Sub-task of "${task.title}"`}
                          >
                            Sub-task of "{task.title}"
                          </div>
                        </TableCell>

                        <TableCell className="px-6 py-1.5">
                          <div className="flex items-center">
                            <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center mr-2">
                              <span className="text-xs font-medium text-gray-600">
                                {subtask.assignee
                                  ?.split(" ")
                                  .map((n) => n[0])
                                  .join("") || "UN"}
                              </span>
                            </div>
                            <span
                              className="text-sm text-gray-700 truncate max-w-[120px]"
                              title={subtask.assignee || "Unassigned"}
                            >
                              {subtask.assignee || "Unassigned"}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="px-6 py-1.5 text-left">
                          <div onClick={(e) => e.stopPropagation()}>
                            <TaskStatusDropdown
                              task={subtask}
                              currentStatus={subtask.status}
                              statuses={companyStatuses}
                              onStatusChange={(newStatus) =>
                                handleSubtaskStatusChange(
                                  task.id,
                                  subtask.id,
                                  newStatus,
                                )
                              }
                              canEdit={canEditTaskStatusFn(
                                subtask,
                                currentUser,
                              )}
                              canMarkCompleted={true}
                            />
                          </div>
                        </TableCell>

                        <TableCell className="px-6 py-1.5">
                          <span className={getPriorityBadge(subtask.priority)}>
                            {subtask.priority}
                          </span>
                        </TableCell>

                        <TableCell className="px-6 py-1.5 text-sm text-gray-700 text-nowrap">
                          <span
                            className={
                              isSubtaskOverdue
                                ? "text-red-600 font-semibold"
                                : ""
                            }
                          >
                            {formatDateTime(subtask.dueDate)}
                          </span>
                        </TableCell>

                        <TableCell className="px-6 py-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-12 bg-gray-100 h-1 rounded-full overflow-hidden">
                              <div
                                className="bg-blue-500 h-full transition-all duration-300"
                                style={{ width: `${subtask.progress || 0}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-gray-500 min-w-[24px]">
                              {subtask.progress || 0}%
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="px-6 py-1.5">
                          <div className="flex flex-wrap gap-1 items-center">
                            {subtask.tags?.length > 0 ? (
                              <>
                                {subtask.tags.slice(0, 2).map((tag, index) => (
                                  <span
                                    key={index}
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {subtask.tags.length > 2 && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                    +{subtask.tags.length - 2} more
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="px-6 py-1.5">
                          <div className="flex items-center">
                            <span className="text-sm text-gray-700">
                              {getTaskType(subtask)}
                            </span>
                          </div>
                        </TableCell>

                        {/*Subtask actions - also sticky */}
                        <TableCell className="px-6 py-1.5 sticky right-0 bg-gray-50 z-[60] shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)]">
                          <div
                            className="flex items-center justify-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <SubtaskActionsDropdown
                              parentTaskId={task._id || task.id}
                              parentTaskStatus={task?.status}
                              subtask={subtask}
                              onEdit={() => handleEditSubtask(subtask)}
                              onDelete={() =>
                                handleDeleteSubtask(
                                  task._id || task.id,
                                  subtask._id || subtask.id,
                                )
                              }
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                {/* 🔄 Recurring Instance Rows - For grouped recurring tasks */}
                {expandedTasks.has(task.id) &&
                  task.hasRecurringInstances &&
                  task.recurringInstances?.map((instance, idx) => {
                    const displayNow = getDisplayNow();
                    // For recurring instances: build deadline from dueDate's date + startTime
                    // startTime "HH:mm" is local time stored the same way backend stores dueDates
                    let instanceDeadline;
                    if (instance?.recurringConfig?.startTime) {
                      const base = new Date(instance.dueDate);
                      const [hStr, mStr] = instance.recurringConfig.startTime.split(":");
                      const h = parseInt(hStr, 10);
                      const m = parseInt(mStr, 10) || 0;
                      instanceDeadline = new Date(Date.UTC(
                        base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), h, m, 0
                      ));
                    } else {
                      instanceDeadline = new Date(instance.dueDate);
                    }
                    // Completed instances are NOT overdue
                    const isOverdue =
                      instanceDeadline < displayNow &&
                      instance.status !== "DONE" &&
                      instance.status !== "COMPLETED" &&
                      instance.status !== "CANCELLED";
                    const isDone =
                      instance.status === "DONE" ||
                      instance.status === "COMPLETED" ||
                      instance.status === "CANCELLED";

                    return (
                      <TableRow
                        key={`recurring-${instance.id || instance._id}`}
                        className={`transition-colors cursor-pointer ${
                          isOverdue
                            ? "bg-red-50 hover:bg-red-100"
                            : isDone
                              ? "bg-gray-50 hover:bg-gray-100"
                              : "bg-blue-50/40 hover:bg-blue-50"
                        }`}
                        onClick={() =>
                          handleNavigateToTask(instance.id || instance._id)
                        }
                      >
                        <TableCell
                          className="px-6 py-1 w-[320px] min-w-[320px] max-w-[320px]"
                          style={{
                            borderLeft: `4px solid ${getTaskColorCode(instance, companyStatuses)}`,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-2 pl-8">
                            <span
                              className={`text-base ${isOverdue ? "text-red-400" : isDone ? "text-gray-400" : "text-blue-400"}`}
                            >
                              ↻
                            </span>
                            <span
                              className={`font-medium cursor-pointer hover:underline px-1 py-0.5 rounded
                                ${isOverdue ? "text-red-700" : isDone ? "text-gray-400 line-through" : "text-gray-800"}
                              `}
                              onClick={() =>
                                handleNavigateToTask(
                                  instance.id || instance._id,
                                )
                              }
                              title={instance.title}
                            >
                              {truncateTitle(instance.title)}
                              {instance.instanceNumber && (
                                <span className="ml-1 text-xs text-blue-500 font-semibold">
                                  #{instance.instanceNumber}
                                </span>
                              )}
                            </span>
                            {isOverdue && (
                              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                                Overdue
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 pl-10">
                            Recurring instance · Due{" "}
                            {getTaskDisplayDueDate(instance)}
                          </div>
                        </TableCell>

                        <TableCell className="px-6 py-1.5">
                          <div className="flex items-center">
                            <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center mr-2">
                              <span className="text-xs font-medium text-gray-600">
                                {instance.assignee
                                  ?.split(" ")
                                  .map((n) => n[0])
                                  .join("") || "UN"}
                              </span>
                            </div>
                            <span
                              className="text-sm text-gray-700 truncate max-w-[120px]"
                              title={instance.assignee || "Unassigned"}
                            >
                              {instance.assignee || "Unassigned"}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="px-6 py-1.5 text-left">
                          <div onClick={(e) => e.stopPropagation()}>
                            <TaskStatusDropdown
                              task={instance}
                              currentStatus={instance.status}
                              statuses={companyStatuses}
                              onStatusChange={(newStatus) =>
                                applyTaskStatusUpdateFromDropdown(
                                  instance.id ?? instance._id,
                                  newStatus,
                                )
                              }
                              canEdit={canEditTaskStatusFn(
                                instance,
                                currentUser,
                              )}
                              canMarkCompleted={true}
                            />
                          </div>
                        </TableCell>

                        <TableCell className="px-6 py-1.5">
                          <span className="inline-flex items-center px-2.5 py-0.5 uppercase text-gray-900 text-xs">
                            {instance.priority}
                          </span>
                        </TableCell>

                        <TableCell className="px-6 py-2 text-sm text-nowrap">
                          <div className="flex flex-col">
                            <span
                              className={
                                isOverdue
                                  ? "text-red-600 font-semibold"
                                  : "text-gray-700"
                              }
                            >
                              {getTaskDisplayDueDate(instance)}
                            </span>
                            {instance.status === "DONE" &&
                              instance.completedDate && (
                                <span className="text-xs text-green-600 font-medium mt-0.5">
                                  Completed:{" "}
                                  {formatDateTime(instance.completedDate)}
                                </span>
                              )}
                          </div>
                        </TableCell>

                        <TableCell className="px-6 py-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-12 bg-gray-100 h-1 rounded-full overflow-hidden">
                              <div
                                className="bg-blue-400 h-full transition-all duration-300"
                                style={{ width: `${instance.progress || 0}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-gray-500 min-w-[24px]">
                              {instance.progress || 0}%
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="px-6 py-1.5">
                          <div className="flex flex-wrap gap-1 items-center">
                            {instance.tags?.length > 0 ? (
                              <>
                                {instance.tags.slice(0, 2).map((tag, index) => (
                                  <span
                                    key={index}
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {instance.tags.length > 2 && (
                                  <span
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                                    title={instance.tags.join(", ")}
                                  >
                                    +{instance.tags.length - 2} more
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="px-6 py-1.5">
                          <span className="text-xs text-blue-600 font-medium">
                            🔄 Recurring
                          </span>
                        </TableCell>

                        {/* Recurring instance actions - sticky & no subtask options */}
                        <TableCell
                          className="px-6 py-1.5 sticky right-0 z-[60] shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)]"
                          style={{
                            backgroundColor: isOverdue
                              ? "#fef2f2"
                              : isDone
                                ? "#f9fafb"
                                : "#ffffff",
                          }}
                        >
                          <div
                            className="flex items-center justify-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <TaskActionsDropdown
                              task={instance}
                              hideSubtaskOptions={true}
                              onSnooze={(snoozeData) =>
                                handleSnoozeTask(instance.id, snoozeData)
                              }
                              onMarkAsRisk={(riskData) =>
                                handleMarkAsRisk(instance.id, riskData)
                              }
                              onMarkAsDone={() =>
                                handleQuickMarkAsDone(instance.id)
                              }
                              onCancelApproval={(reason) =>
                                applyTaskStatusUpdateFromDropdown(
                                  instance.id ?? instance._id,
                                  "CANCELLED",
                                  reason,
                                )
                              }
                              onQuickMarkAsDone={(forceComplete) =>
                                handleQuickMarkAsDone(
                                  instance.id,
                                  forceComplete,
                                )
                              }
                              onDelete={() => handleDeleteTask(instance.id)}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
});

export default TaskTable;
