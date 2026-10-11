import React, { useState, useEffect } from "react";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import {
  X,
  AlertTriangle,
  ArrowRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { useShowToast } from "@/utils/ToastMessage";

export default function TaskChangeApprovalModal({
  isOpen,
  onClose,
  changeRequestId,
  onDecisionComplete,
}) {
  const [loading, setLoading] = useState(true);
  const [requestData, setRequestData] = useState(null);
  const [hasConflict, setHasConflict] = useState(false);
  const [conflictingFields, setConflictingFields] = useState([]);
  const [approverReason, setApproverReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [decisionResult, setDecisionResult] = useState(null); // { type: 'APPROVED' | 'REJECTED', message: string }

  const queryClient = useQueryClient();
  const { showSuccessToast, showErrorToast } = useShowToast();

  useEffect(() => {
    if (isOpen && changeRequestId) {
      fetchRequestDetails();
    } else {
      // Reset state when closed
      setRequestData(null);
      setHasConflict(false);
      setConflictingFields([]);
      setApproverReason("");
      setReasonError("");
      setDecisionResult(null);
    }
  }, [isOpen, changeRequestId]);

  const fetchRequestDetails = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await axios.get(`/api/task-change-requests/${changeRequestId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.success) {
        setRequestData(res.data.data);
        setHasConflict(res.data.hasConflict || false);
        setConflictingFields(res.data.conflictingFields || []);
      } else {
        showErrorToast(res.data.message || "Failed to load request details.");
      }
    } catch (err) {
      console.error("Error fetching change request details:", err);
      showErrorToast(err.response?.data?.message || "Could not load change request.");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (actionType) => {
    const trimmedReason = approverReason.trim();
    if (!trimmedReason) {
      setReasonError("Reason is required to proceed with this action.");
      return;
    }
    setReasonError("");

    try {
      setSubmitting(true);
      const token = localStorage.getItem("token");
      const endpoint =
        actionType === "APPROVE"
          ? `/api/task-change-requests/${changeRequestId}/approve`
          : `/api/task-change-requests/${changeRequestId}/reject`;

      const res = await axios.post(
        endpoint,
        {
          reason: trimmedReason,
          confirmConflict: Boolean(hasConflict),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        // Invalidate queries to refresh task and notifications
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        if (requestData?.taskId?._id) {
          queryClient.invalidateQueries({
            queryKey: [`/api/tasks/${requestData.taskId._id}`],
          });
          queryClient.invalidateQueries({
            queryKey: [`/api/task-change-requests/task/${requestData.taskId._id}/pending`],
          });
        }

        const msg =
          actionType === "APPROVE"
            ? "Task changes approved and applied successfully!"
            : "Task change request rejected.";
        showSuccessToast(msg);

        setDecisionResult({
          type: actionType,
          message: msg,
          approverReason: trimmedReason,
        });

        if (onDecisionComplete) {
          onDecisionComplete({ actionType, request: res.data.changeRequest });
        }
      } else {
        showErrorToast(res.data.message || "Action failed.");
      }
    } catch (err) {
      console.error("Action error:", err);
      if (err.response?.status === 409) {
        setHasConflict(true);
        setConflictingFields(err.response?.data?.conflictDetails || []);
        showErrorToast("Conflict detected: This task has changed since submission.");
      } else {
        showErrorToast(err.response?.data?.message || "Failed to complete action.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const formatFieldValue = (field, val) => {
    if (val === null || val === undefined || val === "") return "Not set";
    if (field === "dueDate" || field === "startDate") {
      try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        }
      } catch (e) {}
    }
    return String(val);
  };

  const fieldLabels = {
    dueDate: "Due Date",
    status: "Status",
    priority: "Priority",
    assignedTo: "Assignee",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-slate-900">Task Change Request</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
              <p className="text-sm text-slate-600">Loading request details...</p>
            </div>
          ) : decisionResult ? (
            /* Decision Completed State */
            <div className="py-6 text-center">
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner ${
                  decisionResult.type === "APPROVE"
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-rose-100 text-rose-600"
                }`}
              >
                {decisionResult.type === "APPROVE" ? (
                  <CheckCircle2 className="w-8 h-8" />
                ) : (
                  <XCircle className="w-8 h-8" />
                )}
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {decisionResult.type === "APPROVE" ? "Changes Approved" : "Changes Rejected"}
              </h3>
              <p className="text-sm text-slate-600 mt-1 max-w-sm mx-auto">
                {decisionResult.message}
              </p>
              <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-left text-xs">
                <span className="font-semibold text-slate-700">Approver Reason:</span>
                <p className="text-slate-600 italic mt-0.5">"{decisionResult.approverReason}"</p>
              </div>
              <div className="mt-6">
                <button
                  onClick={onClose}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : requestData?.status && ["APPROVED", "REJECTED", "CANCELLED"].includes(requestData.status) ? (
            /* Already processed request */
            <div className="py-6 text-center">
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ${
                  requestData.status === "APPROVED"
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-rose-100 text-rose-600"
                }`}
              >
                {requestData.status === "APPROVED" ? (
                  <CheckCircle2 className="w-8 h-8" />
                ) : (
                  <XCircle className="w-8 h-8" />
                )}
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                This request has already been {requestData.status.toLowerCase()}
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Reviewed on {new Date(requestData.reviewedAt || requestData.updatedAt).toLocaleString()}
              </p>
              {requestData.approverReason && (
                <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-left text-xs">
                  <span className="font-semibold text-slate-700">Approver Reason:</span>
                  <p className="text-slate-600 italic mt-0.5">"{requestData.approverReason}"</p>
                </div>
              )}
              <div className="mt-6">
                <button
                  onClick={onClose}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* Active Pending State */
            <>
              {/* Conflict warning banner if applicable */}
              {hasConflict && (
                <div className="p-3 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-amber-900">Task Evolution Detected</p>
                    <p className="text-amber-800 mt-0.5">
                      This task has changed since the request was submitted. Approving will apply the requested values and update the task.
                    </p>
                  </div>
                </div>
              )}

              {/* Task Details */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Task</span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {requestData?.taskId?.title || "Task"}
                </h3>
                <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-500">
                  <span>
                    Requested by:{" "}
                    <strong className="text-slate-700">
                      {requestData?.requestedBy?.firstName} {requestData?.requestedBy?.lastName}
                    </strong>
                  </span>
                  <span>
                    Date: <strong className="text-slate-700">{new Date(requestData?.createdAt).toLocaleDateString()}</strong>
                  </span>
                </div>
              </div>

              {/* Changes comparison table */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Requested Changes</h4>
                <div className="overflow-hidden border border-slate-200 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                      <tr>
                        <th className="px-3 py-2">Field</th>
                        <th className="px-3 py-2">Current Value</th>
                        <th className="px-3 py-2">Requested Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {Object.entries(requestData?.requestedChanges || {}).map(([field, change]) => (
                        <tr key={field} className="bg-white">
                          <td className="px-3 py-2.5 font-semibold text-slate-800">{fieldLabels[field] || field}</td>
                          <td className="px-3 py-2.5 text-slate-400 line-through">
                            {formatFieldValue(field, change.old)}
                          </td>
                          <td className="px-3 py-2.5 text-emerald-600 font-bold flex items-center gap-1">
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            {formatFieldValue(field, change.new)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Employee Reason */}
              <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-3">
                <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Employee's Reason</span>
                <p className="mt-0.5 text-xs text-slate-700 italic">
                  "{requestData?.reason || "No specific reason provided."}"
                </p>
              </div>

              {/* Mandatory Approver Reason input */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Your Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={approverReason}
                  onChange={(e) => {
                    setApproverReason(e.target.value);
                    if (reasonError) setReasonError("");
                  }}
                  rows={2}
                  placeholder="Mandatory reason for approving or rejecting..."
                  className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none focus:ring-2 transition-all ${
                    reasonError
                      ? "border-rose-400 focus:ring-rose-200"
                      : "border-slate-300 focus:border-blue-500 focus:ring-blue-100"
                  }`}
                  disabled={submitting}
                />
                {reasonError ? (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">{reasonError}</p>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-1">
                    * Required for both Approval and Rejection
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!loading && !decisionResult && (requestData?.status === "PENDING" || requestData?.status === "CONFLICT") && (
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleAction("REJECT")}
              disabled={submitting}
              className="px-4 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {submitting ? "Processing..." : "Reject"}
            </button>
            <button
              type="button"
              onClick={() => handleAction("APPROVE")}
              disabled={submitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {hasConflict ? "Approve & Apply" : "Approve"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
