import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import SafeHtml from "../../components/common/SafeHtml";

export default function ApprovalTaskDetailModal({
  task,
  onClose,
  currentUser,
  onApproval,
}) {
  const [comment, setComment] = useState("");

  const handleApproval = (action) => {
    onApproval(task.id, currentUser.id, action, comment);
    setComment("");
  };

  const currentUserApprover = task.approvers?.find(
    (a) => a.id === currentUser.id,
  );
  const canApprove =
    currentUserApprover && currentUserApprover.status === "pending";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overlay-animate">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl modal-animate-slide-right">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Approval Task Details
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">{task.title}</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Status:</span>
                <span className="ml-2 font-medium">{task.status}</span>
              </div>
              <div>
                <span className="text-gray-600">Priority:</span>
                <span className="ml-2 font-medium">{task.priority}</span>
              </div>
              <div>
                <span className="text-gray-600">Due Date:</span>
                <span className="ml-2 font-medium">{task.dueDate}</span>
              </div>
              <div>
                <span className="text-gray-600">Approval Mode:</span>
                <span className="ml-2 font-medium capitalize">
                  {task.approvalMode}
                </span>
              </div>
            </div>
          </div>

          {task.description && (
            <div>
              <span className="text-gray-600 font-medium">Description:</span>
              <SafeHtml
                html={task.description}
                className="mt-1 text-gray-900"
              />
            </div>
          )}

          <div>
            <h5 className="font-medium text-gray-900 mb-3">Approvers</h5>
            <div className="space-y-2">
              {task.approvers?.map((approver) => (
                <div
                  key={approver.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-sm"
                >
                  <div>
                    <p className="font-medium text-gray-900">{approver.name}</p>
                    <p className="text-sm text-gray-600">{approver.role}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        approver.status === "approved"
                          ? "bg-green-100 text-green-800"
                          : approver.status === "rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {approver.status}
                    </span>
                    {approver.comment && (
                      <p className="text-xs text-gray-500 mt-1">
                        {approver.comment}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {canApprove && (
            <div className="border-t border-gray-200 pt-6">
              <h5 className="font-medium text-gray-900 mb-3">Your Approval</h5>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    Comment (optional)
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Add a comment..."
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleApproval("approved")}
                    variant="gradient"
                    className="flex-1"
                  >
                    Approve
                  </Button>
                  <Button
                    onClick={() => handleApproval("rejected")}
                    variant="danger"
                    className="flex-1"
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
