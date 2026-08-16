/**
 * ApprovalRejectModal — Phase 10 Frontend Component
 *
 * Popup modal shown when an approver clicks "Reject".
 * Prompts for:
 *  - Rejection Reason (mandatory)
 *  - Action: "Reject & Terminate" vs "Reject & Re-initiate Context Task"
 */

import React, { useState } from "react";
import { AlertTriangle, X, RefreshCw, StopCircle } from "lucide-react";
import { RejectionAction } from "../../constants/workflowEnums";

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Function} props.onSubmit - Called with { reason, rejectionAction }
 * @param {boolean} [props.hasContextTask] - If true, enables the Re-initiate option
 * @param {boolean} [props.isSubmitting]
 */
export default function ApprovalRejectModal({
  isOpen,
  onClose,
  onSubmit,
  hasContextTask = false,
  isSubmitting = false,
}) {
  const [reason, setReason] = useState("");
  const [action, setAction] = useState(
    hasContextTask ? RejectionAction.REINITIATE : RejectionAction.TERMINATE,
  );
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Rejection reason is required.");
      return;
    }
    setError("");
    onSubmit({ reason: reason.trim(), rejectionAction: action });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-red-50/50">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-base">Reject Approval Task</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this approval request is being rejected..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-2 focus:border-red-500 font-sans"
              autoFocus
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>

          {/* Action Choice */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rejection Action
            </label>

            <div className="space-y-2">
              {/* Option 1: Terminate */}
              <label
                className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  action === RejectionAction.TERMINATE
                    ? "border-red-500 bg-red-50/40"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="rejectionAction"
                  value={RejectionAction.TERMINATE}
                  checked={action === RejectionAction.TERMINATE}
                  onChange={() => setAction(RejectionAction.TERMINATE)}
                  className="mt-1 text-red-600 focus:ring-red-500"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                    <StopCircle className="w-4 h-4 text-red-600" />
                    Reject & Terminate Process
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Mark approval task as Rejected. Parent process follows parent cancellation mode.
                  </p>
                </div>
              </label>

              {/* Option 2: Re-initiate Context Task */}
              <label
                className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  !hasContextTask ? "opacity-50 cursor-not-allowed bg-gray-50" : ""
                } ${
                  action === RejectionAction.REINITIATE
                    ? "border-blue-500 bg-blue-50/40"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="rejectionAction"
                  value={RejectionAction.REINITIATE}
                  checked={action === RejectionAction.REINITIATE}
                  onChange={() => hasContextTask && setAction(RejectionAction.REINITIATE)}
                  disabled={!hasContextTask}
                  className="mt-1 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 text-blue-600" />
                    Reject & Re-initiate Context Task
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {hasContextTask
                      ? "Re-opens the context task for revision. Approval task enters a new cycle upon resubmission."
                      : "No Context Task configured for this approval task."}
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              {isSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
              Confirm Rejection
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
