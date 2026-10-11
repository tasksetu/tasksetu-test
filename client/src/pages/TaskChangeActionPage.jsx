import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import axios from "axios";
import { CheckCircle2, XCircle, AlertTriangle, Clock, ShieldAlert, ArrowRight, Loader2, Sparkles } from "lucide-react";

export default function TaskChangeActionPage() {
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(true);
  const [requestData, setRequestData] = useState(null);
  const [taskData, setTaskData] = useState(null);
  const [pageState, setPageState] = useState("LOADING"); // LOADING, PENDING, APPROVED, REJECTED, EXPIRED, USED, CONFLICT, INVALID
  const [statusMessage, setStatusMessage] = useState("");
  const [hasConflict, setHasConflict] = useState(false);
  const [conflictingFields, setConflictingFields] = useState([]);
  const [approverReason, setApproverReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState("");

  // Extract token from URL
  const queryParams = new URLSearchParams(window.location.search);
  const token = queryParams.get("token");

  useEffect(() => {
    if (!token) {
      setPageState("INVALID");
      setStatusMessage("This approval link is invalid or missing an action token.");
      setVerifying(false);
      setLoading(false);
      return;
    }

    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      setVerifying(true);
      const res = await axios.get(`/api/task-change-requests/action/verify?token=${encodeURIComponent(token)}`);
      const data = res.data;

      if (!data.valid) {
        if (data.state === "EXPIRED_TOKEN") {
          setPageState("EXPIRED");
          setStatusMessage("This approval link has expired. Please open TaskSetu to review the request.");
        } else if (data.state === "USED_TOKEN") {
          setPageState("USED");
          setStatusMessage("This approval link has already been used.");
        } else if (data.state === "ALREADY_APPROVED") {
          setPageState("APPROVED");
          setStatusMessage("This task change request has already been approved.");
          setRequestData(data.changeRequest);
        } else if (data.state === "ALREADY_REJECTED") {
          setPageState("REJECTED");
          setStatusMessage("This task change request has already been rejected.");
          setRequestData(data.changeRequest);
        } else {
          setPageState("INVALID");
          setStatusMessage(data.message || "This approval link is invalid.");
        }
      } else {
        setRequestData(data.changeRequest);
        setTaskData(data.task);

        if (data.hasConflict) {
          setHasConflict(true);
          setPageState("CONFLICT");
          setConflictingFields(data.conflictingFields || []);
          setStatusMessage(data.message || "This task has changed since the request was submitted. Please review before taking action.");
        } else {
          setHasConflict(false);
          setPageState("PENDING");
        }
      }
    } catch (err) {
      console.error("Token verification error:", err);
      setPageState("INVALID");
      setStatusMessage("Failed to verify approval link. Please check your network or try again later.");
    } finally {
      setVerifying(false);
      setLoading(false);
    }
  };

  const handleAction = async (actionType) => {
    // Mandatory reason validation
    const trimmedReason = approverReason.trim();
    if (!trimmedReason) {
      setReasonError("Reason is required to proceed with this action.");
      return;
    }
    setReasonError("");

    try {
      setSubmittingAction(true);
      const endpoint =
        actionType === "APPROVE"
          ? "/api/task-change-requests/action/approve"
          : "/api/task-change-requests/action/reject";

      const res = await axios.post(endpoint, {
        token,
        reason: trimmedReason,
        confirmConflict: Boolean(hasConflict),
      });

      if (res.data.success) {
        if (actionType === "APPROVE") {
          setPageState("APPROVED");
          setActionSuccessMessage("The requested changes have been approved and applied to the task.");
        } else {
          setPageState("REJECTED");
          setActionSuccessMessage("The requested changes have been rejected. The original task remains unchanged.");
        }
      } else {
        alert(res.data.message || "Action failed.");
      }
    } catch (err) {
      console.error("Approval action error:", err);
      if (err.response?.status === 409) {
        setHasConflict(true);
        setPageState("CONFLICT");
        setStatusMessage(err.response?.data?.message || "Task conflict detected.");
        setConflictingFields(err.response?.data?.conflictDetails || []);
      } else {
        alert(err.response?.data?.message || err.message || "An error occurred while processing your decision.");
      }
    } finally {
      setSubmittingAction(false);
    }
  };

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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-800 font-sans">
      <div className="w-full max-w-xl bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-6 py-5 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-amber-300" />
            <h1 className="text-xl font-bold tracking-tight">TaskSetu</h1>
          </div>
          <p className="text-blue-100 text-sm font-medium">Task Change Approval Workflow</p>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {/* State 1: Verifying / Loading */}
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
              <h3 className="text-lg font-semibold text-slate-700">Verifying Approval Request</h3>
              <p className="text-sm text-slate-500 mt-1">Please wait while we validate your secure token...</p>
            </div>
          )}

          {/* State 2: Already Approved */}
          {!loading && pageState === "APPROVED" && (
            <div className="py-8 text-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Task Changes Approved</h2>
              <p className="text-slate-600 mt-2 text-sm max-w-md mx-auto">
                {actionSuccessMessage || statusMessage || "This task change request has already been approved."}
              </p>
              {requestData?.approverReason && (
                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-left text-sm">
                  <span className="font-semibold text-emerald-900">Recorded Reason:</span>
                  <p className="text-emerald-800 mt-1 italic">"{requestData.approverReason}"</p>
                </div>
              )}
              <div className="mt-6">
                <a
                  href="/login"
                  className="inline-flex items-center justify-center px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  Open TaskSetu Dashboard
                </a>
              </div>
            </div>
          )}

          {/* State 3: Already Rejected */}
          {!loading && pageState === "REJECTED" && (
            <div className="py-8 text-center">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                <XCircle className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Task Changes Rejected</h2>
              <p className="text-slate-600 mt-2 text-sm max-w-md mx-auto">
                {actionSuccessMessage || statusMessage || "This task change request has already been rejected."}
              </p>
              {requestData?.approverReason && (
                <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-left text-sm">
                  <span className="font-semibold text-rose-900">Recorded Reason:</span>
                  <p className="text-rose-800 mt-1 italic">"{requestData.approverReason}"</p>
                </div>
              )}
              <div className="mt-6">
                <a
                  href="/login"
                  className="inline-flex items-center justify-center px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  Open TaskSetu Dashboard
                </a>
              </div>
            </div>
          )}

          {/* State 4: Expired Token */}
          {!loading && pageState === "EXPIRED" && (
            <div className="py-8 text-center">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                <Clock className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Approval Link Expired</h2>
              <p className="text-slate-600 mt-2 text-sm max-w-md mx-auto">
                This action link has expired (links are time-limited to 24 hours). Please log in to TaskSetu to review pending requests.
              </p>
              <div className="mt-6">
                <a
                  href="/login"
                  className="inline-flex items-center justify-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  Log In to TaskSetu
                </a>
              </div>
            </div>
          )}

          {/* State 5: Used Token */}
          {!loading && pageState === "USED" && (
            <div className="py-8 text-center">
              <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Link Already Used</h2>
              <p className="text-slate-600 mt-2 text-sm max-w-md mx-auto">
                This action link has already been used. Each email approval link is strictly single-use.
              </p>
              <div className="mt-6">
                <a
                  href="/login"
                  className="inline-flex items-center justify-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  Open TaskSetu
                </a>
              </div>
            </div>
          )}

          {/* State 6: Invalid Token */}
          {!loading && pageState === "INVALID" && (
            <div className="py-8 text-center">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                <ShieldAlert className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Invalid Link</h2>
              <p className="text-slate-600 mt-2 text-sm max-w-md mx-auto">
                {statusMessage || "This approval link is invalid or has been revoked."}
              </p>
              <div className="mt-6">
                <a
                  href="/login"
                  className="inline-flex items-center justify-center px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  Return to Login
                </a>
              </div>
            </div>
          )}

          {/* State 7: Conflict Detected */}
          {!loading && pageState === "CONFLICT" && (
            <div className="py-6">
              <div className="p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg mb-6 flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-900">Conflict Detected</h3>
                  <p className="text-sm text-amber-800 mt-1">
                    This task has changed since the request was submitted. Current values differ from the original values when requested.
                  </p>
                </div>
              </div>

              {conflictingFields.length > 0 && (
                <div className="overflow-hidden border border-slate-200 rounded-lg mb-6">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-700 text-xs uppercase font-semibold">
                      <tr>
                        <th className="px-3 py-2">Field</th>
                        <th className="px-3 py-2">Requested Value</th>
                        <th className="px-3 py-2">Live Current Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {conflictingFields.map((cf) => (
                        <tr key={cf.field} className="bg-white">
                          <td className="px-3 py-2 font-medium text-slate-900">{fieldLabels[cf.field] || cf.field}</td>
                          <td className="px-3 py-2 text-emerald-600 font-semibold">{formatFieldValue(cf.field, cf.requestedNew)}</td>
                          <td className="px-3 py-2 text-amber-700 font-semibold">{formatFieldValue(cf.field, cf.currentTaskValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-sm text-slate-600 text-center mb-6">
                Please review the updated task in TaskSetu before making any changes.
              </p>

              <div className="text-center">
                <a
                  href="/login"
                  className="inline-flex items-center justify-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  Open Task in TaskSetu
                </a>
              </div>
            </div>
          )}

          {/* State 8: Pending Action (The Core Approval Form) */}
          {!loading && pageState === "PENDING" && requestData && (
            <div className="space-y-6">
              {/* Task Details card */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Task Details</span>
                <h2 className="text-lg font-bold text-slate-900 mt-1">
                  {taskData?.title || requestData?.taskId?.title || "Task"}
                </h2>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>
                    Requested by:{" "}
                    <strong className="text-slate-700">
                      {requestData.requestedBy?.firstName} {requestData.requestedBy?.lastName} ({requestData.requestedBy?.email})
                    </strong>
                  </span>
                  {requestData.createdAt && (
                    <span>
                      Date: <strong className="text-slate-700">{new Date(requestData.createdAt).toLocaleDateString()}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Changes comparison table */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">Requested Changes</h3>
                <div className="overflow-hidden border border-slate-200 rounded-lg">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-700 text-xs uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-2.5">Field</th>
                        <th className="px-4 py-2.5">Current Value</th>
                        <th className="px-4 py-2.5">Requested Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {Object.entries(requestData.requestedChanges || {}).map(([field, change]) => (
                        <tr key={field} className="bg-white hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-slate-800">{fieldLabels[field] || field}</td>
                          <td className="px-4 py-3 text-slate-500 line-through">
                            {formatFieldValue(field, change.old)}
                          </td>
                          <td className="px-4 py-3 text-emerald-600 font-bold flex items-center gap-1.5">
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            {formatFieldValue(field, change.new)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Employee Reason */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-4">
                <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Employee's Reason</span>
                <p className="mt-1 text-sm text-slate-700 italic">
                  "{requestData.reason ? requestData.reason : "No specific reason provided."}"
                </p>
              </div>

              {/* Mandatory Approver Reason input */}
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">
                  Rejection / Approval Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={approverReason}
                  onChange={(e) => {
                    setApproverReason(e.target.value);
                    if (reasonError) setReasonError("");
                  }}
                  rows={3}
                  placeholder="Provide mandatory reason for your decision..."
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-all ${
                    reasonError
                      ? "border-rose-400 focus:ring-rose-200"
                      : "border-slate-300 focus:border-blue-500 focus:ring-blue-100"
                  }`}
                  disabled={submittingAction}
                />
                {reasonError ? (
                  <p className="text-xs text-rose-600 mt-1 font-medium">{reasonError}</p>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">
                    * A reason is required whether you approve or reject this request.
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleAction("REJECT")}
                  disabled={submittingAction}
                  className="px-5 py-2.5 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {submittingAction ? "Processing..." : "Reject"}
                </button>
                <button
                  type="button"
                  onClick={() => handleAction("APPROVE")}
                  disabled={submittingAction}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submittingAction && <Loader2 className="w-4 h-4 animate-spin" />}
                  Approve
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
