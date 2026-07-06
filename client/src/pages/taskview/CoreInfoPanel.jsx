import React from "react";
import { CircleX } from "lucide-react";
import getStatusLabel from "./statusUtils";

function CoreInfoPanel({ moreInfo, setMoreInfo, task, onUpdate, permissions }) {
  return (
    <div className="core-info-panel p-4">
      <div className="space-y-3">
        {/* Task Overview */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex justify-between  items-center gap-3 mb-3">
            <div className="fex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <span className="text-blue-600 text-lg">
                  {task.taskType === "milestone"
                    ? "🎯"
                    : task.taskType === "approval"
                      ? "✅"
                      : "📋"}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Task Overview
                </h3>
                <p className="text-sm text-gray-600">
                  Complete task information and details
                </p>
              </div>
            </div>

            <button
              className="action-btn primary "
              onClick={() => setMoreInfo(true)}
            >
              View More
            </button>
          </div>

          {/* Reminders */}
          {task.reminders && task.reminders.length > 0 && (
            <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-sm">
              <div className="flex items-center gap-2">
                <span className="text-yellow-600">⏰</span>
                <span className="font-medium text-yellow-800">
                  Active Reminders:
                </span>
              </div>
              {task.reminders.map((reminder, index) => (
                <div key={index} className="mt-2 text-sm text-yellow-700">
                  {reminder.message} - {reminder.date}
                </div>
              ))}
            </div>
          )}

          {/* Description */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <div className="text-sm text-gray-900 p-3 border border-gray-200 rounded-sm">
              {task.description || "Add task description..."}
            </div>
          </div>
        </div>
        {moreInfo ? (
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-md font-bold text-gray-600">
                Detailed View
              </label>
              <span className="text-sm text-gray-900">
                <CircleX color="red" onClick={() => setMoreInfo(false)} />
              </span>
            </div>
            {/* Basic Information Grid */}
            <div className="grid grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Task Details Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h4 className="text-md font-semibold text-gray-900  flex items-center gap-2">
                  <span className="text-blue-500">📝</span>
                  Task Details
                </h4>
                <div className="space-y-3 mt-4">
                  <div className="space-y-2 flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-600">
                      Type:
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {task.taskType === "regular"
                          ? "📋"
                          : task.taskType === "recurring"
                            ? "🔄"
                            : task.taskType === "milestone"
                              ? "🎯"
                              : task.taskType === "approval"
                                ? "✅"
                                : "📋"}
                      </span>
                      <span className="text-sm text-gray-900 capitalize">
                        {task.taskType === "regular"
                          ? "Regular Task"
                          : task.taskType === "recurring"
                            ? "Recurring Task"
                            : task.taskType === "milestone"
                              ? "Milestone"
                              : task.taskType === "approval"
                                ? "Approval Task"
                                : "Regular Task"}
                      </span>
                      {task.colorCode && (
                        <div
                          className="w-4 h-4 rounded-full border border-gray-300"
                          style={{ backgroundColor: task.colorCode }}
                          title={`Task Color: ${task.colorCode}`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Color Code Display */}
                  <div className="space-y-2 flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-600">
                      Color Code:
                    </label>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full border border-gray-300"
                        style={{ backgroundColor: task.colorCode || "#6B7280" }}
                      />
                      <span className="text-sm text-gray-900 font-mono">
                        {task.colorCode || "#6B7280"}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-600">
                      Visibility:
                    </label>
                    <span className="text-sm text-gray-900 capitalize">
                      {task.visibility || "Private"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Timeline Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2 mb-3">
                  <span className="text-green-500">📅</span>
                  Timeline
                </h4>
                <div className="space-y-3 mt-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-600">
                      Start Date:
                    </label>
                    <span className="text-sm text-gray-900">
                      {task.startDate || "Not set"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-600">
                      Due Date:
                    </label>
                    <span className="text-sm text-gray-900">
                      {task.dueDate || "Not set"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-600">
                      Time Estimate:
                    </label>
                    <span className="text-sm text-gray-900">
                      {task.timeEstimate || "Not set"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Creation Info Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2 mb-3">
                  <span className="text-purple-500">👤</span>
                  Creation Info
                </h4>
                <div className="space-y-3 mt-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-600">
                      Created By:
                    </label>
                    <span className="text-sm text-gray-900">
                      {task.createdBy}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-600">
                      Created:
                    </label>
                    <span className="text-sm text-gray-900">
                      {new Date(task.createdAt)
                        .toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                        .replace(",", "")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-600">
                      Last Updated:
                    </label>
                    <span className="text-sm text-gray-900">
                      {new Date(task.updatedAt)
                        .toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                        .replace(",", "")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Assignment & Status Grid */}
            <div className="grid grid-cols-3 md:grid-cols-3 gap-3">
              {/* Assignment Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="text-orange-500">👥</span>
                  Assignment & Status
                </h4>
                <div className="space-y-3 mt-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-600">
                      Assignee:
                    </label>
                    <span className="text-sm text-gray-900">
                      {task.assignee}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-600">
                      Current Status:
                    </label>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        task.status === "DONE"
                          ? "bg-green-100 text-green-800"
                          : task.status === "INPROGRESS"
                            ? "bg-blue-100 text-blue-800"
                            : task.status === "ONHOLD"
                              ? "bg-yellow-100 text-yellow-800"
                              : task.status === "CANCELLED"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {getStatusLabel(task.status)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-600">
                      Priority:
                    </label>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        task.priority === "critical"
                          ? "bg-red-100 text-red-800"
                          : task.priority === "high"
                            ? "bg-orange-100 text-orange-800"
                            : task.priority === "medium"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-green-100 text-green-800"
                      }`}
                    >
                      {task.priority
                        ? task.priority.charAt(0).toUpperCase() +
                          task.priority.slice(1)
                        : "Medium"}
                    </span>
                  </div>

                  {/* Collaborators */}
                  {task.collaborators && task.collaborators.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-600">
                        Collaborators:
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {task.collaborators.map((collaborator, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                          >
                            {collaborator}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Risk & Snooze Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="text-red-500">⚠️</span>
                  Special Status
                </h4>
                <div className="space-y-3 mt-4">
                  {task.isRisky && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-red-600">⚠️</span>
                        <span className="font-medium text-red-800">
                          At Risk
                        </span>
                      </div>
                      <p className="text-sm text-red-700">{task.riskNote}</p>
                    </div>
                  )}

                  {task.snoozedUntil && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-yellow-600">😴</span>
                        <span className="font-medium text-yellow-800">
                          Snoozed
                        </span>
                      </div>
                      <p className="text-sm text-yellow-700">
                        Until:{" "}
                        {new Date(task.snoozedUntil)
                          .toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })
                          .replace(",", "")}
                      </p>
                      {task.snoozeNote && (
                        <p className="text-sm text-yellow-700 mt-1">
                          Note: {task.snoozeNote}
                        </p>
                      )}
                    </div>
                  )}

                  {!task.isRisky && !task.snoozedUntil && (
                    <div className="text-sm text-gray-500 italic">
                      No special status indicators
                    </div>
                  )}
                </div>
              </div>

              {/* Task Metadata Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="text-indigo-500">🏷️</span>
                  Metadata
                </h4>
                <div className="space-y-3 mt-4">
                  {/* Tags */}
                  {task.tags && task.tags.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-600">
                        Tags:
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {task.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Parent Task */}
                  {task.parentTaskId && (
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-gray-600">
                        Parent Task:
                      </label>
                      <span className="text-sm text-blue-600 underline cursor-pointer">
                        #{task.parentTaskId}
                      </span>
                    </div>
                  )}

                  {/* Approval Status */}
                  {task.isApprovalTask && (
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-gray-600">
                        Approval Status:
                      </label>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          task.approvalStatus === "approved"
                            ? "bg-green-100 text-green-800"
                            : task.approvalStatus === "rejected"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {task.approvalStatus
                          ? task.approvalStatus.charAt(0).toUpperCase() +
                            task.approvalStatus.slice(1)
                          : "Pending"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default CoreInfoPanel;
