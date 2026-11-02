import React from "react";
import {
  X,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  RotateCcw,
  ShieldCheck,
  FileText,
  ArrowRight,
  PauseCircle,
  PlayCircle,
  HelpCircle,
} from "lucide-react";
import { useTaskAuditTimeline } from "../hooks/usePerformanceReports";

export const TaskAuditDrawer = ({ taskId, onClose }) => {
  const { data, isLoading, error } = useTaskAuditTimeline(taskId, {
    enabled: Boolean(taskId),
  });

  if (!taskId) return null;

  const task = data?.data?.task || data?.task;
  const timeline = data?.data?.timeline || data?.timeline || [];

  const getEventIcon = (type) => {
    switch (type) {
      case "TASK_CREATED":
        return <FileText className="w-4 h-4 text-blue-600" />;
      case "DEADLINE_EXTENDED":
      case "EXTENSION_APPROVED":
        return <Calendar className="w-4 h-4 text-emerald-600" />;
      case "DEADLINE_CHANGED":
        return <Clock className="w-4 h-4 text-amber-600" />;
      case "STATUS_CHANGED":
        return <CheckCircle2 className="w-4 h-4 text-purple-600" />;
      case "REASSIGNED":
      case "TASK_REASSIGNED":
        return <UserCheck className="w-4 h-4 text-indigo-600" />;
      case "PRIORITY_CHANGED":
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "TASK_BLOCKED":
        return <PauseCircle className="w-4 h-4 text-rose-600" />;
      case "TASK_UNBLOCKED":
        return <PlayCircle className="w-4 h-4 text-emerald-600" />;
      case "REWORK_RETURNED":
        return <RotateCcw className="w-4 h-4 text-orange-600" />;
      case "CHANGE_REQUEST_APPROVED":
        return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
      case "CHANGE_REQUEST_REJECTED":
        return <AlertTriangle className="w-4 h-4 text-rose-600" />;
      case "CHANGE_REQUEST_SUBMITTED":
        return <HelpCircle className="w-4 h-4 text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-gray-200 transform transition-transform">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-sm">
                Audit Timeline
              </span>
              {task?.priority && (
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-600 bg-gray-100 px-2 py-0.5 rounded-sm">
                  {task.priority}
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-gray-900 mt-1 line-clamp-1">
              {task?.title || "Task Audit History"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-sm hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Task Summary Banner */}
        {task && (
          <div className="px-6 py-3 bg-blue-50/40 border-b border-blue-100/60 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-gray-500 block">Original Deadline</span>
              <span className="font-semibold text-gray-800">
                {task.originalDueDate ? formatDate(task.originalDueDate).split(",")[0] : "None"}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block">Current Deadline</span>
              <span className="font-semibold text-gray-800">
                {task.currentDueDate ? formatDate(task.currentDueDate).split(",")[0] : "None"}
              </span>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-gray-500">
              Loading task timeline and audit logs...
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-rose-600">
              Failed to load audit history: {error.message}
            </div>
          ) : timeline.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              No historical events recorded for this task.
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
              {timeline.map((event, idx) => (
                <div key={idx} className="relative group">
                  {/* Event Marker */}
                  <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-white border border-gray-300 flex items-center justify-center shadow-xs">
                    {getEventIcon(event.type)}
                  </div>

                  {/* Event Content */}
                  <div className="bg-gray-50/70 hover:bg-gray-50 rounded-sm border border-gray-200/80 p-3.5 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gray-900">
                        {event.title}
                      </span>
                      <span className="text-[11px] text-gray-400 font-medium">
                        {formatDate(event.timestamp)}
                      </span>
                    </div>

                    <div className="text-xs text-gray-600 mt-1">
                      <span className="font-medium text-gray-700">By:</span>{" "}
                      {event.actor || "System"}
                    </div>

                    {/* Specific Event Details */}
                    {event.details && (
                      <div className="mt-2 text-xs space-y-1 bg-white p-2.5 rounded-sm border border-gray-100">
                        {event.details.oldDueDate && (
                          <div className="flex items-center gap-1.5 text-gray-700">
                            <span className="text-gray-400 line-through">
                              {formatDate(event.details.oldDueDate).split(",")[0]}
                            </span>
                            <ArrowRight size={12} className="text-gray-400" />
                            <span className="font-semibold text-emerald-600">
                              {formatDate(event.details.newDueDate).split(",")[0]}
                            </span>
                          </div>
                        )}

                        {event.details.oldStatus && event.details.newStatus && (
                          <div className="flex items-center gap-1.5 text-gray-700">
                            <span className="text-gray-500 font-medium">{event.details.oldStatus}</span>
                            <ArrowRight size={12} className="text-gray-400" />
                            <span className="font-semibold text-blue-600">{event.details.newStatus}</span>
                          </div>
                        )}

                        {event.details.oldAssignee && event.details.newAssignee && (
                          <div className="flex items-center gap-1.5 text-gray-700">
                            <span className="text-gray-500">{event.details.oldAssignee}</span>
                            <ArrowRight size={12} className="text-gray-400" />
                            <span className="font-semibold text-indigo-600">{event.details.newAssignee}</span>
                          </div>
                        )}

                        {event.details.reason && (
                          <div className="text-gray-600 italic mt-1">
                            "{event.details.reason}"
                          </div>
                        )}

                        {event.details.initialDueDate && (
                          <div className="text-gray-500">
                            Initial Deadline: {formatDate(event.details.initialDueDate).split(",")[0]}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-sm hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskAuditDrawer;
