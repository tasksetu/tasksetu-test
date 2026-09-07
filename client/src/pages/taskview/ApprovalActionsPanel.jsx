import React, { useState } from "react";
import axios from "axios";
import { useShowToast } from "@/utils/ToastMessage";
import { Button } from "@/components/ui/button";

const ApprovalActionsPanel = ({ task, currentUser, onApprovalUpdate }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comment, setComment] = useState("");
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [rejectionMode, setRejectionMode] = useState("reinitiate"); // "reinitiate" | "terminate"
  const [reinitiateSubtaskId, setReinitiateSubtaskId] = useState("");
  const { showSuccessToast, showErrorToast } = useShowToast();

  const getParentTaskId = (t) => {
    if (!t) return null;
    if (t.parentTaskId) {
      if (typeof t.parentTaskId === "object" && t.parentTaskId !== null) {
        return t.parentTaskId._id || t.parentTaskId.id || String(t.parentTaskId);
      }
      return String(t.parentTaskId);
    }
    if (t.parentTask) {
      if (typeof t.parentTask === "object" && t.parentTask !== null) {
        return t.parentTask._id || t.parentTask.id || String(t.parentTask);
      }
      return String(t.parentTask);
    }
    return null;
  };

  // 🎯 Explicit Classification based on database fields (isSubtask, isApprovalTask, taskType)
  const isApprovalTask = Boolean(
    task?.isApprovalTask ||
    task?.taskType === "approval" ||
    task?.mainTaskType === "approval"
  );
  const isSubtask = Boolean(
    task?.isSubtask ||
    task?.parentTaskId ||
    task?.parentTask
  );

  // Case 1: Normal Standalone Approval Task (isSubtask = false, isApprovalTask = true)
  const isNormalApprovalTask = isApprovalTask && !isSubtask;

  // Case 2: Approval Subtask in a Process (isSubtask = true, isApprovalTask = true)
  const isApprovalSubtask = isApprovalTask && isSubtask;

  const [parentSubtasks, setParentSubtasks] = React.useState([]);
  const [configuredTaskDoc, setConfiguredTaskDoc] = React.useState(null);

  React.useEffect(() => {
    const parentId = getParentTaskId(task);
    if (parentId) {
      const token = localStorage.getItem("token");
      axios
        .get(`/api/tasks/${parentId}?forApproval=true`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => {
          const fetchedSubtasks = res.data?.data?.subtasks || res.data?.subtasks || [];
          if (Array.isArray(fetchedSubtasks) && fetchedSubtasks.length > 0) {
            setParentSubtasks(fetchedSubtasks);
          }
        })
        .catch((err) => console.error("Error loading parent task subtasks:", err));
    }
  }, [task?.parentTaskId, task?.parentTask, task?._id]);

  // Extract configured context task ID if set on the approval subtask
  const configuredContextTaskId = React.useMemo(() => {
    const rawContext =
      task?.contextTaskId ||
      task?.contextTask ||
      task?.context_task_id ||
      task?.contextStepId ||
      task?.contextSubtaskId ||
      task?.linkedTaskId ||
      task?.configuration?.contextTaskId ||
      task?.configuration?.linkedTaskId;

    if (!rawContext) return null;
    if (typeof rawContext === "object" && rawContext !== null) {
      return (rawContext._id || rawContext.id)?.toString() || null;
    }
    return String(rawContext);
  }, [task]);

  // Fetch configured context task directly if missing from parent subtasks
  React.useEffect(() => {
    if (configuredContextTaskId) {
      const token = localStorage.getItem("token");
      axios
        .get(`/api/tasks/${configuredContextTaskId}?forApproval=true`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => {
          if (res.data?.success && res.data?.data) {
            setConfiguredTaskDoc(res.data.data);
          }
        })
        .catch((err) => console.error("Error fetching configured context task:", err));
    }
  }, [configuredContextTaskId]);

  // Extract sibling subtasks available for re-initiation
  const availableContextSubtasks = React.useMemo(() => {
    let sublist = [];
    if (Array.isArray(parentSubtasks) && parentSubtasks.length > 0) {
      sublist = parentSubtasks;
    } else if (Array.isArray(task?.parentTask?.subtasks)) {
      sublist = task.parentTask.subtasks;
    } else if (Array.isArray(task?.subtasks)) {
      sublist = task.subtasks;
    }

    const currentId = String(task?._id || task?.id || "");

    // 🎯 Rule 1: If a specific contextTaskId is configured on this approval subtask, ONLY show that task!
    if (configuredContextTaskId) {
      const specificTask = sublist.find(
        (st) => String(st._id || st.id || "") === configuredContextTaskId
      );
      if (specificTask) {
        return [specificTask];
      }
      if (configuredTaskDoc) {
        return [configuredTaskDoc];
      }
      if (typeof task?.contextTaskId === "object" && task?.contextTaskId !== null) {
        return [task.contextTaskId];
      }
      if (typeof task?.contextTask === "object" && task?.contextTask !== null) {
        return [task.contextTask];
      }
    }

    // 🎯 Rule 2: If no contextTaskId configured, only show preceding context subtasks (steps before current approval step)
    const currentIdx = sublist.findIndex(
      (st) => String(st._id || st.id || "") === currentId
    );

    let candidates = sublist;
    if (currentIdx > 0) {
      // Pick steps preceding current approval step
      candidates = sublist.slice(0, currentIdx);
    } else {
      // Filter out current task and future open tasks that haven't been initiated
      candidates = sublist.filter((st) => {
        const stId = String(st._id || st.id || "");
        if (stId === currentId) return false;
        const stStatus = String(st.status || "").toUpperCase();
        return ["DONE", "COMPLETED", "IN_PROGRESS", "INPROGRESS"].includes(stStatus);
      });
    }

    return candidates.filter((st) => String(st._id || st.id || "") !== currentId);
  }, [task, parentSubtasks, configuredContextTaskId, configuredTaskDoc]);

  // Set default reinitiateSubtaskId when list changes
  React.useEffect(() => {
    if (availableContextSubtasks.length > 0) {
      const defaultSt = availableContextSubtasks[0];
      const defaultId = String(defaultSt._id || defaultSt.id || "");
      if (defaultId && defaultId !== reinitiateSubtaskId) {
        setReinitiateSubtaskId(defaultId);
      }
    }
  }, [availableContextSubtasks]);

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

  // Check if current user is an approver
  const isApprover = task?.approvers?.some(
    (approver) => getApproverId(approver) === currentUserId,
  );

  // For sequential mode, check if it's current user's turn
  const isCurrentApprover = () => {
    if (task.approvalMode === "sequential") {
      const currentIndex = task.currentApproverIndex || 0;
      const currentApproverInOrder = task.approverOrder?.[currentIndex];
      const isCurrentTurn =
        currentApproverInOrder &&
        getApproverId(currentApproverInOrder.approverId) === currentUserId;
      return isCurrentTurn;
    }
    return isApprover;
  };

  // Check if user has already decided
  const userDecision = task.approvalDecisions?.find(
    (decision) => getApproverId(decision.approverId) === currentUserId,
  );

  // Task must be in OPEN, PENDING, or IN_PROGRESS status to be active for approval
  const isTaskActiveForApproval = ["OPEN", "PENDING", "IN_PROGRESS", "INPROGRESS"].includes(
    String(task?.status || "").toUpperCase()
  );

  const lastCycle = React.useMemo(() => {
    if (Array.isArray(task?.approvalCycles) && task.approvalCycles.length > 0) {
      return task.approvalCycles[task.approvalCycles.length - 1];
    }
    return null;
  }, [task?.approvalCycles]);

  const isWaitingForReinitiatedStep = React.useMemo(() => {
    if (!lastCycle || lastCycle.actionTaken !== "reinitiate_context_step") {
      return false;
    }
    if (task?.contextStepCompleted === true || lastCycle.isResolved === true || lastCycle.contextStepCompleted === true) {
      return false;
    }

    let sublist = [];
    if (Array.isArray(parentSubtasks) && parentSubtasks.length > 0) {
      sublist = [...parentSubtasks];
    }
    if (Array.isArray(task?.parentTask?.subtasks)) {
      sublist = [...sublist, ...task.parentTask.subtasks];
    }
    if (Array.isArray(task?.subtasks)) {
      sublist = [...sublist, ...task.subtasks];
    }

    // 🎯 Instant check: If sublist contains ANY completed context step, return false immediately on frame 1!
    const hasCompletedContextStep = sublist.some(
      (st) =>
        !st.isApprovalTask &&
        st.taskType !== "approval" &&
        ["DONE", "COMPLETED"].includes(String(st.status || "").toUpperCase())
    );
    if (hasCompletedContextStep) {
      return false;
    }

    let reinitiatedSt = null;
    if (lastCycle.reinitiatedSubtaskId) {
      if (sublist.length > 0) {
        reinitiatedSt = sublist.find(
          (st) => String(st._id || st.id || "") === String(lastCycle.reinitiatedSubtaskId)
        );
      }
      if (!reinitiatedSt && configuredTaskDoc && String(configuredTaskDoc._id || configuredTaskDoc.id || "") === String(lastCycle.reinitiatedSubtaskId)) {
        reinitiatedSt = configuredTaskDoc;
      }
      if (!reinitiatedSt && typeof task?.contextTaskId === "object" && task?.contextTaskId !== null) {
        reinitiatedSt = task.contextTaskId;
      }
      if (!reinitiatedSt && typeof task?.contextTask === "object" && task?.contextTask !== null) {
        reinitiatedSt = task.contextTask;
      }
    }

    if (reinitiatedSt) {
      const stStatus = String(reinitiatedSt.status || "").toUpperCase();
      const isDone = stStatus === "DONE" || stStatus === "COMPLETED";
      return !isDone;
    }

    // 🎯 Fallback: If sublist contains any completed context subtask, the re-initiated step is finished!
    if (Array.isArray(sublist) && sublist.length > 0) {
      const completedContextSt = sublist.find(
        (st) =>
          !st.isApprovalTask &&
          st.taskType !== "approval" &&
          ["DONE", "COMPLETED"].includes(String(st.status || "").toUpperCase())
      );
      if (completedContextSt) {
        return false;
      }
    }

    return true;
  }, [lastCycle, parentSubtasks, task?.parentTask?.subtasks, task?.subtasks, configuredTaskDoc, task?.contextTaskId, task?.contextTask, task?.contextStepCompleted]);

  // 🎯 Check if configured/linked context task is completed before enabling approval actions
  const contextTaskCompletionStatus = React.useMemo(() => {
    if (!isApprovalSubtask && !configuredContextTaskId) {
      return { isRequired: false, isCompleted: true, title: "", status: "" };
    }

    let targetTask = null;

    if (configuredContextTaskId) {
      if (configuredTaskDoc && String(configuredTaskDoc._id || configuredTaskDoc.id || "") === configuredContextTaskId) {
        targetTask = configuredTaskDoc;
      } else if (Array.isArray(parentSubtasks) && parentSubtasks.length > 0) {
        targetTask = parentSubtasks.find((st) => String(st._id || st.id || "") === configuredContextTaskId);
      } else if (typeof task?.contextTaskId === "object" && task?.contextTaskId !== null) {
        targetTask = task.contextTaskId;
      } else if (typeof task?.contextTask === "object" && task?.contextTask !== null) {
        targetTask = task.contextTask;
      }
    } else if (isApprovalSubtask && Array.isArray(parentSubtasks) && parentSubtasks.length > 0) {
      const currentId = String(task._id || task.id || "");
      const currentIdx = parentSubtasks.findIndex((st) => String(st._id || st.id || "") === currentId);
      if (currentIdx > 0) {
        targetTask = parentSubtasks[currentIdx - 1];
      }
    }

    if (!targetTask) {
      return { isRequired: false, isCompleted: true, title: "", status: "" };
    }

    const stStatus = String(targetTask.status || "").toUpperCase();
    const isCompleted = stStatus === "DONE" || stStatus === "COMPLETED";
    const title = targetTask.title || targetTask.name || targetTask.taskName || "Context Task";

    return {
      isRequired: true,
      isCompleted,
      title,
      status: stStatus.replace("_", " "),
    };
  }, [isApprovalSubtask, configuredContextTaskId, configuredTaskDoc, parentSubtasks, task]);

  const canApprove =
    isTaskActiveForApproval &&
    isApprover &&
    !userDecision &&
    !isWaitingForReinitiatedStep &&
    contextTaskCompletionStatus.isCompleted &&
    task?.approvalStatus === "pending";

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

    if (selectedAction === "reject" && isApprovalSubtask && rejectionMode === "reinitiate" && availableContextSubtasks.length > 0 && !reinitiateSubtaskId) {
      showErrorToast("Please select a context subtask to re-initiate.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        action: selectedAction,
        comment: comment.trim(),
      };

      if (selectedAction === "reject" && isApprovalSubtask && availableContextSubtasks.length > 0) {
        payload.rejectionMode = rejectionMode;
        payload.reinitiateSubtaskId = reinitiateSubtaskId;
      } else if (selectedAction === "reject") {
        payload.rejectionMode = "terminate";
      }

      const response = await axios.post(
        `/api/tasks/${task._id}/approve`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      if (response.data.success) {
        showSuccessToast(
          selectedAction === "approve"
            ? "Task approved successfully"
            : rejectionMode === "reinitiate"
              ? "Task rejected & context step re-initiated successfully"
              : "Task rejected & process terminated successfully",
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
      case "reinitiated":
        return "bg-red-100 text-red-800 border-red-200 font-bold";
      case "awaiting_turn":
        return "bg-gray-100 text-gray-600 border-gray-200";
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
      case "reinitiated":
        return `Rejected (Cycle ${lastCycle?.cycleNumber || 1})`;
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

        let status = ao.status || "pending";
        if (
          isWaitingForReinitiatedStep &&
          lastCycle &&
          String(lastCycle.decidedBy || "") === approverIdStr
        ) {
          status = "reinitiated";
        }

        return {
          id: approverIdStr,
          name,
          email,
          avatar,
          order: ao.order,
          status,
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

      if (
        isWaitingForReinitiatedStep &&
        lastCycle &&
        String(lastCycle.decidedBy || "") === approverIdStr
      ) {
        status = "reinitiated";
      }

      return {
        id: approverIdStr,
        name,
        email,
        avatar,
        order: null,
        status,
        decidedAt: decision?.decidedAt || (isWaitingForReinitiatedStep ? lastCycle?.decidedAt : null),
        comment: decision?.comment || (isWaitingForReinitiatedStep ? lastCycle?.rejectionReason : ""),
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
              {isWaitingForReinitiatedStep ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  Re-initiated (Cycle {lastCycle?.cycleNumber || 1})
                </span>
              ) : isCancelled || task.approvalStatus === "rejected" ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
                  Terminated
                </span>
              ) : task.approvalStatus === "approved" || task.status === "DONE" ? (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
                  Approved
                </span>
              ) : (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    String(task.status).toUpperCase() === "OPEN"
                      ? "bg-blue-100 text-blue-800"
                      : getStatusBadgeColor(task.approvalStatus)
                  }`}
                >
                  {String(task.status).toUpperCase() === "OPEN"
                    ? "Open (Draft)"
                    : task.approvalStatus
                    ? task.approvalStatus.charAt(0).toUpperCase() +
                      task.approvalStatus.slice(1)
                    : "Pending"}
                </span>
              )}
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
          {/* Re-initiated Notice Card */}
          {isWaitingForReinitiatedStep && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-md">
                <div className="flex items-start gap-2.5">
                  <span className="text-amber-600 text-base shrink-0 mt-0.5">🔁</span>
                  <div>
                    <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-2">
                      <span>Re-initiated for Revision</span>
                      <span className="px-1.5 py-0.5 bg-red-100 text-red-800 rounded text-[10px]">
                        Cycle {lastCycle?.cycleNumber || 1} Rejected
                      </span>
                    </h4>
                    <p className="text-xs text-amber-800 mt-1">
                      This approval task was rejected in Cycle {lastCycle?.cycleNumber || 1} and sent back to step{" "}
                      <strong>"{lastCycle?.reinitiatedSubtaskTitle || "Context Subtask"}"</strong>. Approval action buttons are hidden until that context step is completed.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Linked Context Task Not Completed Notice Card */}
          {contextTaskCompletionStatus.isRequired && !contextTaskCompletionStatus.isCompleted && !isWaitingForReinitiatedStep && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-start gap-2.5">
                  <span className="text-blue-600 text-base shrink-0 mt-0.5">⏳</span>
                  <div>
                    <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                      Waiting for Linked Context Task Completion
                    </h4>
                    <p className="text-xs text-blue-800 mt-1">
                      This approval subtask is linked to step <strong>"{contextTaskCompletionStatus.title}"</strong> (Status: <span className="font-semibold">{contextTaskCompletionStatus.status}</span>). Approval and rejection actions will become active once that context step is completed.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                        : "Rejection Reason (Required)"}
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                    />
                  </div>

                  {selectedAction === "reject" && isApprovalSubtask && availableContextSubtasks.length > 0 && (
                    <div className="p-3 bg-red-50/50 border border-red-200 rounded-md space-y-3">
                      <label className="block text-xs font-bold text-red-800 uppercase tracking-wider">
                        Rejection Action
                      </label>

                      <div className="space-y-2 text-xs">
                        <label className="flex items-start gap-2 cursor-pointer p-2.5 rounded border bg-white border-red-200 hover:border-red-300 transition-colors">
                          <input
                            type="radio"
                            name="rejectionMode"
                            value="reinitiate"
                            checked={rejectionMode === "reinitiate"}
                            onChange={() => setRejectionMode("reinitiate")}
                            className="mt-0.5 text-red-600 focus:ring-red-500"
                          />
                          <div>
                            <span className="font-bold text-gray-800 block">Reject & Re-initiate Context Subtask</span>
                            <span className="text-gray-500 text-[11px]">
                              Send process back to a previous step. Step will become <strong>In-Progress</strong> and current rejection logged as Cycle {task.currentCycle || 1}.
                            </span>
                          </div>
                        </label>

                        {rejectionMode === "reinitiate" && (
                          <div className="pl-6 pt-1 space-y-1">
                            <label className="block text-[11px] font-semibold text-gray-700">
                              Select Context Step to Re-initiate:
                            </label>
                            <select
                              value={reinitiateSubtaskId}
                              onChange={(e) => setReinitiateSubtaskId(e.target.value)}
                              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                            >
                              {availableContextSubtasks.map((st) => {
                                const stId = String(st._id || st.id || "");
                                const title = st.title || st.name || st.taskName || "Context Subtask Step";
                                const status = (st.status || "OPEN").replace("_", " ");
                                return (
                                  <option key={stId} value={stId}>
                                    {title} ({status})
                                  </option>
                                );
                              })}
                              {availableContextSubtasks.length === 0 && (
                                <option value="">Default Context Subtask Step</option>
                              )}
                            </select>
                          </div>
                        )}

                        <label className="flex items-start gap-2 cursor-pointer p-2.5 rounded border bg-white border-red-200 hover:border-red-300 transition-colors">
                          <input
                            type="radio"
                            name="rejectionMode"
                            value="terminate"
                            checked={rejectionMode === "terminate"}
                            onChange={() => setRejectionMode("terminate")}
                            className="mt-0.5 text-red-600 focus:ring-red-500"
                          />
                          <div>
                            <span className="font-bold text-gray-800 block">Reject & Terminate Process</span>
                            <span className="text-gray-500 text-[11px]">
                              Exit process completely. Parent process and all subtasks will be marked as <strong>Cancelled</strong>. And this task is marked as <strong>Terminated</strong>.
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
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

      {/* Approval Cycles Audit Log UI */}
      {Array.isArray(task.approvalCycles) && task.approvalCycles.length > 0 && (
        <div className="mt-5 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>🔄</span> Approval Cycles Audit Log ({task.approvalCycles.length} {task.approvalCycles.length === 1 ? 'Cycle' : 'Cycles'})
            </h4>
            <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              Current: Cycle {task.currentCycle || task.approvalCycles.length + 1}
            </span>
          </div>

          <div className="space-y-3">
            {task.approvalCycles.map((cycle, idx) => (
              <div key={idx} className="p-3 rounded border border-gray-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Approval Cycle {cycle.cycleNumber || idx + 1}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase ${
                      cycle.status === "approved"
                        ? "bg-green-100 text-green-800 border border-green-200"
                        : cycle.status === "rejected"
                          ? "bg-red-100 text-red-800 border border-red-200"
                          : "bg-blue-100 text-blue-800 border border-blue-200"
                    }`}
                  >
                    {cycle.status === "rejected"
                      ? cycle.actionTaken === "reinitiate_context_step"
                        ? "Rejected (Re-initiated)"
                        : "Rejected (Terminated)"
                      : cycle.status}
                  </span>
                </div>

                <div className="text-xs text-gray-600 space-y-1">
                  {cycle.decidedByName && (
                    <p>
                      <strong>Decided By:</strong> {cycle.decidedByName} ({new Date(cycle.decidedAt).toLocaleString()})
                    </p>
                  )}

                  {cycle.rejectionReason && (
                    <p className="bg-red-50 text-red-800 p-2 rounded border border-red-100 italic">
                      "{cycle.rejectionReason}"
                    </p>
                  )}

                  {cycle.actionTaken === "reinitiate_context_step" && (
                    <p className="text-purple-700 font-semibold text-[11px] flex items-center gap-1">
                      ↳ Re-initiated Context Step: <strong>{cycle.reinitiatedSubtaskTitle || "Context Step"}</strong>
                    </p>
                  )}

                  {cycle.actionTaken === "terminate_process" && (
                    <p className="text-red-700 font-semibold text-[11px]">
                      ✕ Process Terminated & Cancelled
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalActionsPanel;
