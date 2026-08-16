/**
 * ApprovalHistoryTimeline — Phase 10 Frontend Component
 *
 * Displays approval history cycles in a timeline format.
 * Each cycle shows who approved/rejected and when.
 * Immutable — history is never overwritten.
 */

import React from "react";
import { CheckCircle, XCircle, Clock, RefreshCw, Bot } from "lucide-react";

const statusIcon = {
  approved: <CheckCircle className="w-4 h-4 text-green-500" />,
  rejected: <XCircle className="w-4 h-4 text-red-500" />,
  auto_approved: <Bot className="w-4 h-4 text-blue-400" />,
  pending: <Clock className="w-4 h-4 text-gray-400" />,
};

const statusLabel = {
  approved: "Approved",
  rejected: "Rejected",
  auto_approved: "Auto-Approved",
  pending: "Pending",
};

const statusColor = {
  approved: "bg-green-50 border-green-200 text-green-700",
  rejected: "bg-red-50 border-red-200 text-red-700",
  auto_approved: "bg-blue-50 border-blue-200 text-blue-700",
  pending: "bg-gray-50 border-gray-200 text-gray-600",
};

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * @param {Object} props
 * @param {Array} props.history - Array of { cycle, decisions: [...] }
 * @param {boolean} [props.loading]
 */
export default function ApprovalHistoryTimeline({ history = [], loading = false }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-gray-400 text-sm">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Loading approval history...
      </div>
    );
  }

  if (!history.length) {
    return (
      <div className="py-4 text-center text-sm text-gray-400">
        No approval history yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {history.map(({ cycle, decisions }) => (
        <div key={cycle} className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Cycle header */}
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Cycle {cycle}
            </span>
            {cycle > 1 && (
              <span className="text-xs text-blue-500 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                Re-initiated
              </span>
            )}
          </div>

          {/* Decisions in this cycle */}
          <div className="divide-y divide-gray-100">
            {decisions.map((decision, idx) => (
              <div key={idx} className="flex items-start gap-3 px-4 py-3">
                {/* Status icon */}
                <div className="mt-0.5 flex-shrink-0">
                  {statusIcon[decision.status] || <Clock className="w-4 h-4 text-gray-400" />}
                </div>

                {/* Approver info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">
                      {decision.approver?.name || decision.approver?.email || "Unknown Approver"}
                    </span>
                    <span
                      className={`text-xs border rounded px-1.5 py-0.5 font-medium ${
                        statusColor[decision.status] || statusColor.pending
                      }`}
                    >
                      {statusLabel[decision.status] || decision.status}
                    </span>
                    {decision.isAutoApproval && (
                      <span className="text-xs text-gray-400">(Auto)</span>
                    )}
                  </div>

                  {/* Reason */}
                  {decision.reason && (
                    <p className="text-xs text-gray-500 mt-1 italic">
                      "{decision.reason}"
                    </p>
                  )}

                  {/* Rejection action */}
                  {decision.rejectionAction && (
                    <p className="text-xs text-orange-600 mt-0.5">
                      Action:{" "}
                      {decision.rejectionAction === "reinitiate"
                        ? "Rejected & Re-initiated context task"
                        : "Rejected & Terminated"}
                    </p>
                  )}

                  {/* Timestamp */}
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDate(decision.decidedAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
