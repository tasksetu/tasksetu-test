import React, { useState } from "react";
import axios from "axios";
import { useShowToast } from "@/utils/ToastMessage";
import { Button } from "@/components/ui/button";

const ApprovalActionsPanel = ({ task, currentUser, onApprovalUpdate }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comment, setComment] = useState("");
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const { showSuccessToast, showErrorToast } = useShowToast();

  // Debug logging
  console.log("🔍 ApprovalActionsPanel Debug:", {
    taskId: task?._id,
    isApprovalTask: task?.isApprovalTask,
    approvalMode: task?.approvalMode,
    approvalStatus: task?.approvalStatus,
    approvers: task?.approvers,
    currentUser: currentUser,
    currentUserId: currentUser?.id || currentUser?._id,
    currentApproverIndex: task?.currentApproverIndex,
    approverOrder: task?.approverOrder,
    approvalDecisions: task?.approvalDecisions,
  });

  // Helper to extract ID from approver (handles both ObjectId strings and populated objects)
  const getApproverId = (approver) => {
    if (!approver) return null;
    if (typeof approver === "string") return approver;
    if (approver._id) return approver._id.toString();
    if (approver.id) return approver.id.toString();
    return approver.toString();
  };

  // Get current user ID
  const currentUserId = (currentUser?.id || currentUser?._id)?.toString();

  console.log("🔑 ID Comparison Debug:");
  console.log("  currentUserId:", currentUserId);
  console.log("  approvers array:", task?.approvers);
  task?.approvers?.forEach((approver, idx) => {
    const approverId = getApproverId(approver);
    console.log(
      `  approver[${idx}]:`,
      approver,
      "→ ID:",
      approverId,
      "Match:",
      approverId === currentUserId,
    );
  });

  // Check if current user is an approver
  const isApprover = task?.approvers?.some(
    (approver) => getApproverId(approver) === currentUserId,
  );

  console.log(
    "✅ isApprover check:",
    isApprover,
    "currentUserId:",
    currentUserId,
  );

  // For sequential mode, check if it's current user's turn
  const isCurrentApprover = () => {
    if (task.approvalMode === "sequential") {
      const currentIndex = task.currentApproverIndex || 0;
      const currentApproverInOrder = task.approverOrder?.[currentIndex];
      const isCurrentTurn =
        currentApproverInOrder &&
        getApproverId(currentApproverInOrder.approverId) === currentUserId;
      console.log(
        "🔄 Sequential mode - isCurrentTurn:",
        isCurrentTurn,
        "currentIndex:",
        currentIndex,
      );
      return isCurrentTurn;
    }
    return isApprover;
  };

  // Check if user has already decided
  const userDecision = task.approvalDecisions?.find(
    (decision) => getApproverId(decision.approverId) === currentUserId,
  );

  const canApprove =
    isApprover && !userDecision && task.approvalStatus === "pending";

  console.log("🎯 Final decision:", {
    canApprove,
    isApprover,
    hasDecided: !!userDecision,
    approvalStatus: task.approvalStatus,
  });

  const handleApprovalAction = async (action) => {
    if (!canApprove) return;

    // For sequential mode, verify it's user's turn
    if (task.approvalMode === "sequential" && !isCurrentApprover()) {
      showErrorToast("Not your turn to approve. Wait for previous approvers.");
      return;
    }

    setSelectedAction(action);
    setShowCommentBox(true);
  };

  const submitApproval = async () => {
    if (!selectedAction) return;

    setIsSubmitting(true);
    try {
      const response = await axios.post(
        `/api/tasks/${task._id}/approve`,
        {
          action: selectedAction,
          comment: comment.trim(),
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      if (response.data.success) {
        showSuccessToast(
          `Task ${selectedAction === "approve" ? "approved" : "rejected"} successfully`,
        );
        setComment("");
        setShowCommentBox(false);
        setSelectedAction(null);

        // Refresh task data
        if (onApprovalUpdate) {
          onApprovalUpdate();
        }
      }
    } catch (error) {
      console.error("Approval error:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        "Failed to process approval";
      showErrorToast(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "cancelled":
        return "bg-gray-200 text-gray-700";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getApproverStatusBadgeColor = (status) => {
    switch (status) {
      case "approved":
      case "approved_auto":
        return "bg-green-100 text-green-800 border-green-200";
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200";
      case "awaiting_turn":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "skipped":
        return "bg-gray-100 text-gray-600 border-gray-200";
      case "pending":
      default:
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
    }
  };

  const getApproverStatusLabel = (status) => {
    switch (status) {
      case "approved":
        return "Approved";
      case "rejected":
        return "Rejected";
      case "awaiting_turn":
        return "Awaiting Turn";
      case "skipped":
        return "Skipped";
      case "pending":
      default:
        return "Pending";
    }
  };

  const getUnifiedApprovers = () => {
    if (
      task.approvalMode === "sequential" &&
      task.approverOrder &&
      task.approverOrder.length > 0
    ) {
      return task.approverOrder.map((ao) => {
        const approver = ao.approverId;
        const approverIdStr = getApproverId(approver);

        let name = "Approver";
        let email = "";
        let avatar = null;

        if (approver && typeof approver === "object") {
          name =
            `${approver.firstName || ""} ${approver.lastName || ""}`.trim() ||
            approver.email ||
            "Approver";
          email = approver.email || "";
          avatar = approver.avatar || null;
        } else if (typeof approver === "string") {
          const activity = task.activities?.find(
            (act) =>
              act.user &&
              (act.user._id === approver || act.user.id === approver),
          );
          if (activity?.user) {
            name =
              `${activity.user.firstName || ""} ${activity.user.lastName || ""}`.trim() ||
              activity.user.email ||
              "Approver";
            email = activity.user.email || "";
          }
        }

        const decision = task.approvalDecisions?.find(
          (d) => getApproverId(d.approverId) === approverIdStr,
        );

        return {
          id: approverIdStr,
          name,
          email,
          avatar,
          order: ao.order,
          status: ao.status || "pending",
          decidedAt: ao.decidedAt || decision?.decidedAt || null,
          comment: decision?.comment || "",
        };
      });
    }

    if (!task.approvers) return [];

    return task.approvers.map((approver, index) => {
      const approverIdStr = getApproverId(approver);

      let name = "Approver";
      let email = "";
      let avatar = null;

      if (approver && typeof approver === "object") {
        name =
          `${approver.firstName || ""} ${approver.lastName || ""}`.trim() ||
          approver.email ||
          "Approver";
        email = approver.email || "";
        avatar = approver.avatar || null;
      } else if (typeof approver === "string") {
        const activity = task.activities?.find(
          (act) =>
            act.user && (act.user._id === approver || act.user.id === approver),
        );
        if (activity?.user) {
          name =
            `${activity.user.firstName || ""} ${activity.user.lastName || ""}`.trim() ||
            activity.user.email ||
            "Approver";
          email = activity.user.email || "";
        }
      }

      const decision = task.approvalDecisions?.find(
        (d) => getApproverId(d.approverId) === approverIdStr,
      );

      let status = "pending";
      if (decision) {
        status =
          decision.decision === "approve" ||
          decision.decision === "auto_approve"
            ? "approved"
            : "rejected";
      }

      return {
        id: approverIdStr,
        name,
        email,
        avatar,
        order: null,
        status,
        decidedAt: decision?.decidedAt || null,
        comment: decision?.comment || "",
      };
    });
  };

  if (!task?.isApprovalTask) return null;

  const isCancelled = task?.status === "CANCELLED";

  return (
    <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4 mb-3">
      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <svg
          className="w-5 h-5 text-blue-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Approval Information
      </h3>

      {/* Approval Status Overview */}
      <div className="mb-3 p-4 bg-gray-50 rounded-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-600">
              Approval Mode:
            </label>
            <p className="text-sm font-semibold text-gray-800 mt-1">
              {task.approvalMode === "sequential"
                ? "Sequential (In Order)"
                : task.approvalMode === "any"
                  ? "Any One Approver"
                  : "All Must Approve"}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">
              Overall Status:
            </label>
            <p className="mt-1">
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(isCancelled ? "cancelled" : task.approvalStatus)}`}
              >
                {isCancelled
                  ? "Cancelled"
                  : task.approvalStatus
                    ? task.approvalStatus.charAt(0).toUpperCase() +
                      task.approvalStatus.slice(1)
                    : "Pending"}
              </span>
            </p>
          </div>
        </div>

        {/* Auto-approval info */}
        {task.autoApproveEnabled && task.autoApproveAfter && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <label className="text-sm font-medium text-gray-600">
              Auto-approval Date:
            </label>
            <p className="text-sm text-gray-800 mt-1">
              {new Date(task.autoApproveAfter).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        )}
      </div>

      {!isCancelled && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            Approver Statuses:
          </h4>
          <div className="space-y-2">
            {getUnifiedApprovers().map((approver, index) => {
              const isCurrent =
                task.approvalMode === "sequential" &&
                index === (task.currentApproverIndex || 0) &&
                approver.status === "awaiting_turn";
              return (
                <div
                  key={approver.id || index}
                  className={`p-3 rounded-sm border transition-all ${
                    isCurrent
                      ? "border-blue-300 bg-blue-50/50 shadow-sm"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Avatar / Order Circle */}
                      <div className="relative flex-shrink-0">
                        {approver.avatar ? (
                          <img
                            src={approver.avatar}
                            alt={approver.name}
                            className="w-9 h-9 rounded-full object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center">
                            {getInitials(approver.name)}
                          </div>
                        )}
                        {approver.order !== null && (
                          <span className="absolute -bottom-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-gray-500 text-white text-[9px] font-bold border border-white">
                            {approver.order}
                          </span>
                        )}
                      </div>

                      {/* Name & Email */}
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-semibold text-gray-800">
                            {approver.name}
                          </p>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-100 text-blue-700 font-bold uppercase tracking-wider">
                              Current Turn
                            </span>
                          )}
                        </div>
                        {approver.email && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {approver.email}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getApproverStatusBadgeColor(approver.status)}`}
                    >
                      {getApproverStatusLabel(approver.status)}
                    </span>
                  </div>

                  {/* Comment & Decided At if decided */}
                  {approver.decidedAt && (
                    <div className="mt-2.5 pt-2 border-t border-gray-100 pl-12">
                      {approver.comment && (
                        <p className="text-xs text-gray-650 italic bg-gray-50 p-2 rounded border border-gray-150 mb-1">
                          "{approver.comment}"
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400">
                        Decided on{" "}
                        {new Date(approver.decidedAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isCancelled && (
        <>
          {/* Action Buttons - Only show if user can approve */}
          {canApprove && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              {!showCommentBox ? (
                <div className="flex gap-3">
                  {task.approvalMode === "sequential" &&
                  !isCurrentApprover() ? (
                    <div className="w-full p-3 bg-yellow-50 border border-yellow-200 rounded-sm">
                      <p className="text-sm text-yellow-800">
                        ⏳ Please wait for previous approvers to complete their
                        review before you can approve.
                      </p>
                    </div>
                  ) : (
                    <>
                      <Button
                        variant="primary"
                        className="h-9 flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => handleApprovalAction("approve")}
                      >
                        <svg
                          className="w-5 h-5 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        className="h-9 flex-1"
                        onClick={() => handleApprovalAction("reject")}
                      >
                        <svg
                          className="w-5 h-5 mr-2"
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
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {selectedAction === "approve"
                        ? "Approval Comment (Optional)"
                        : "Rejection Reason (Optional)"}
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder={
                        selectedAction === "approve"
                          ? "Add a comment about your approval..."
                          : "Explain why you're rejecting this task..."
                      }
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant={
                        selectedAction === "approve" ? "primary" : "destructive"
                      }
                      className={`h-9 flex-1 ${selectedAction === "approve" ? "bg-green-600 hover:bg-green-700" : ""}`}
                      onClick={submitApproval}
                      disabled={isSubmitting}
                    >
                      {isSubmitting
                        ? "Submitting..."
                        : `Confirm ${selectedAction === "approve" ? "Approval" : "Rejection"}`}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-9"
                      onClick={() => {
                        setShowCommentBox(false);
                        setSelectedAction(null);
                        setComment("");
                      }}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User has already decided */}
          {userDecision && (
            <div
              className={`mt-4 p-3 rounded-sm border ${
                userDecision.decision === "approve"
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  userDecision.decision === "approve"
                    ? "text-green-800"
                    : "text-red-800"
                }`}
              >
                ✓ You have already{" "}
                {userDecision.decision === "approve" ? "approved" : "rejected"}{" "}
                this task
              </p>
              {userDecision.comment && (
                <p className="text-sm text-gray-600 mt-1">
                  Your comment: "{userDecision.comment}"
                </p>
              )}
            </div>
          )}

          {/* Not an approver message */}
          {!isApprover && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-sm">
              <p className="text-sm text-blue-800">
                ℹ️ You are not an approver for this task. Only designated
                approvers can approve or reject.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ApprovalActionsPanel;
