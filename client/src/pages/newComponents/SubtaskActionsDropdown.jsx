import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useLocation } from "wouter";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle, XCircle, Clock, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SnoozeTaskModal, MarkDoneModal } from "@/components/modals/TaskModals";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SubtaskActionsDropdown({
  subtask,
  parentTaskId,
  parentTaskStatus,
  onEdit,
  onDelete,
  onView,
  onSnooze,
  onStatusChange,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [, navigate] = useLocation();

  // Risk modal states
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [showMitigationModal, setShowMitigationModal] = useState(false);
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [showMarkDoneModal, setShowMarkDoneModal] = useState(false);
  const [riskReason, setRiskReason] = useState("");
  const [riskLevel, setRiskLevel] = useState("medium");
  const [mitigationReason, setMitigationReason] = useState("");
  const [riskLoading, setRiskLoading] = useState(false);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  // Handlers for status changes (Mark as Done / Cancel)
  const handleMarkDone = async () => {
    try {
      if (onStatusChange) {
        onStatusChange("DONE");
      } else {
        const token = localStorage.getItem("token");
        await fetch(`/api/tasks/${parentTaskId}/subtasks/${subtask.id || subtask._id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: "DONE", progress: 100 }),
        });
        window.dispatchEvent(new CustomEvent("subtaskUpdate", { detail: { parentTaskId } }));
      }
    } catch (err) {
      console.error("Error marking subtask as done:", err);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) return;
    setCancelLoading(true);
    try {
      if (onStatusChange) {
        onStatusChange("CANCELLED", cancelReason);
      } else {
        const token = localStorage.getItem("token");
        await fetch(`/api/tasks/${parentTaskId}/subtasks/${subtask.id || subtask._id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: "CANCELLED", cancelReason: cancelReason }),
        });
        window.dispatchEvent(new CustomEvent("subtaskUpdate", { detail: { parentTaskId } }));
      }
      setShowCancelModal(false);
      setCancelReason("");
    } catch (err) {
      console.error("Error cancelling subtask:", err);
    } finally {
      setCancelLoading(false);
    }
  };

  const handleSnoozeConfirm = async (snoozeData) => {
    try {
      if (onSnooze) {
        onSnooze(snoozeData);
      } else {
        const token = localStorage.getItem("token");
        await fetch(`/api/tasks/${subtask.id || subtask._id}/snooze`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(snoozeData),
        });
        window.dispatchEvent(new CustomEvent("subtaskUpdate", { detail: { parentTaskId } }));
      }
    } catch (err) {
      console.error("Error snoozing subtask:", err);
    }
  };

  // Handler to mark subtask as risk
  const handleMarkRisk = async () => {
    if (!riskReason.trim()) {
      alert("Please enter a risk reason");
      return;
    }

    setRiskLoading(true);
    try {
      const response = await fetch(
        `/api/tasks/${subtask.id || subtask._id}/mark-risk`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            riskReason: riskReason,
            riskLevel: riskLevel,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to mark subtask as risk");
      }

      // Dispatch event to notify AllTasks
      window.dispatchEvent(
        new CustomEvent("taskRiskUpdated", {
          detail: {
            taskId: subtask.id || subtask._id,
            isRisk: true,
            riskLevel: riskLevel,
            riskReason: riskReason,
          },
        }),
      );

      setRiskReason("");
      setRiskLevel("medium");
      setShowRiskModal(false);
    } catch (error) {
      console.error("Error marking subtask as risk:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setRiskLoading(false);
    }
  };

  // Handler to unmark subtask as risk
  const handleUnmarkRisk = async () => {
    setRiskLoading(true);
    try {
      const response = await fetch(
        `/api/tasks/${subtask.id || subtask._id}/unmark-risk`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            mitigationReason: mitigationReason,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to unmark subtask risk");
      }

      // Dispatch event to notify AllTasks
      window.dispatchEvent(
        new CustomEvent("taskRiskUpdated", {
          detail: {
            taskId: subtask.id || subtask._id,
            isRisk: false,
            riskLevel: null,
            riskReason: null,
          },
        }),
      );

      setMitigationReason("");
      setShowMitigationModal(false);
    } catch (error) {
      console.error("Error unmarking subtask risk:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setRiskLoading(false);
    }
  };

  // Compute menu position relative to the trigger button rect
  const computePosition = (rect) => {
    const gap = 6;
    const menuWidth = 224;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuHeight = menuRef.current
      ? menuRef.current.offsetHeight
      : 215;

    let left = rect.right - menuWidth;
    left = Math.max(8, Math.min(left, viewportWidth - menuWidth - 8));

    let top = rect.bottom + gap;
    if (top + menuHeight > viewportHeight - 8) {
      top = Math.max(8, rect.top - gap - menuHeight);
    }
    return { top, left };
  };

  // Compute and set menu position relative to the trigger button
  const updateMenuPosition = () => {
    const btn = triggerRef.current;
    if (!btn) {
      setMenuPos({ top: 100, left: 16 });
      return;
    }
    setMenuPos(computePosition(btn.getBoundingClientRect()));
  };

  // Close on outside click (both trigger and portal menu considered)
  useLayoutEffect(() => {
    const handleClickOutside = (event) => {
      const t = triggerRef.current;
      const m = menuRef.current;
      if (
        isOpen &&
        t &&
        m &&
        !t.contains(event.target) &&
        !m.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleResizeOrScroll = () => {
      if (isOpen) updateMenuPosition();
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside, true);
      window.addEventListener("resize", handleResizeOrScroll);
      window.addEventListener("scroll", handleResizeOrScroll, true);
      updateMenuPosition();
      requestAnimationFrame(() => {
        updateMenuPosition();
      });
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      window.removeEventListener("resize", handleResizeOrScroll);
      window.removeEventListener("scroll", handleResizeOrScroll, true);
    };
  }, [isOpen]);

  const handleAction = (action) => {
    setIsOpen(false);
    action();
  };

  const normStatus = String(subtask?.status || "").toLowerCase();
  const normApprovalStatus = String(subtask?.approvalStatus || "").toLowerCase();

  const isDone =
    normStatus === "done" ||
    normStatus === "completed" ||
    normStatus === "approved" ||
    normApprovalStatus === "approved";

  const isCancelled =
    normStatus === "cancelled" ||
    normStatus === "canceled" ||
    normStatus === "rejected" ||
    normApprovalStatus === "rejected";

  const isTaskFinished = isDone || isCancelled;

  const isMilestone =
    subtask?.taskType === "milestone" ||
    subtask?.isMilestone === true ||
    String(subtask?.title || "").toLowerCase().includes("milestone");

  return (
    <div className="relative z-10">
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        className="text-gray-400 cursor-pointer hover:text-gray-600 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title="More actions"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </Button>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[99999] w-56 bg-white rounded-none shadow-xl border border-gray-200 py-2"
            style={{ top: menuPos.top, left: menuPos.left }}
            role="menu"
          >
            {/* View Button */}
            <Button
              variant="ghost"
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3 transition-colors justify-start h-auto rounded-none"
              onClick={(e) => {
                e.stopPropagation();
                handleAction(() => {
                  if (onView) {
                    onView(subtask);
                  } else {
                    navigate(`/tasks/${subtask.id || subtask._id}`);
                  }
                });
              }}
            >
              <Eye size={16} className="text-gray-600" />
              <span>View</span>
            </Button>

            {/* If Milestone Subtask */}
            {isMilestone ? (
              <>
                {!isTaskFinished && (
                  <Button
                    variant="ghost"
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3 transition-colors justify-start h-auto rounded-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                      setShowSnoozeModal(true);
                    }}
                  >
                    <Clock size={16} className="text-gray-600" />
                    <span>Snooze</span>
                  </Button>
                )}

                {!isTaskFinished && !subtask.isRisk && (
                  <Button
                    variant="ghost"
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3 transition-colors justify-start h-auto rounded-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                      setShowRiskModal(true);
                    }}
                  >
                    <AlertTriangle size={16} className="text-gray-600" />
                    <span>Mark as Risk</span>
                  </Button>
                )}

                {!isTaskFinished && subtask.isRisk && (
                  <Button
                    variant="ghost"
                    className="w-full text-left px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 flex items-center gap-3 transition-colors justify-start h-auto rounded-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                      setShowMitigationModal(true);
                    }}
                  >
                    <CheckCircle size={16} className="text-emerald-600" />
                    <span>Mark as Mitigated</span>
                  </Button>
                )}

                {!isTaskFinished && (
                  <Button
                    variant="ghost"
                    className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 flex items-center gap-3 transition-colors justify-start h-auto rounded-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                      setShowMarkDoneModal(true);
                    }}
                  >
                    <CheckCircle size={16} className="text-green-600" />
                    <span className="font-medium text-green-600">Mark as Done</span>
                  </Button>
                )}

                {!isTaskFinished && (
                  <Button
                    variant="ghost"
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors justify-start h-auto rounded-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                      setCancelReason("");
                      setShowCancelModal(true);
                    }}
                  >
                    <XCircle size={16} className="text-red-600" />
                    <span className="font-medium text-red-600">Cancel</span>
                  </Button>
                )}
              </>
            ) : (
              /* Regular Subtask Actions */
              <>
                {!isTaskFinished && (
                  <Button
                    variant="ghost"
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3 transition-colors justify-start h-auto rounded-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAction(() => onEdit && onEdit(subtask));
                    }}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Edit Subtask
                  </Button>
                )}

                {!isTaskFinished && !subtask.isRisk && (
                  <Button
                    variant="ghost"
                    className="w-full text-left px-4 py-2 text-sm text-yellow-600 hover:bg-yellow-50 flex items-center gap-3 transition-colors justify-start h-auto rounded-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                      setShowRiskModal(true);
                    }}
                    title="Mark this subtask as a risk item"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M10.5 1.5H9.5L1.5 16h17L10.5 1.5zM10 13a1 1 0 110-2 1 1 0 010 2zm0-4a1 1 0 100-2 1 1 0 000 2z" />
                    </svg>
                    Mark as Risk
                  </Button>
                )}

                {!isTaskFinished && subtask.isRisk && (
                  <Button
                    variant="ghost"
                    className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 flex items-center gap-3 transition-colors justify-start h-auto rounded-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                      setShowMitigationModal(true);
                    }}
                    title="Mark this risk as mitigated"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Mark as Mitigated
                  </Button>
                )}

                {!isTaskFinished && (
                  <Button
                    variant="ghost"
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors justify-start h-auto rounded-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                      setCancelReason("");
                      setShowCancelModal(true);
                    }}
                  >
                    <XCircle size={16} className="text-red-600" />
                    <span className="font-medium text-red-600">Cancel</span>
                  </Button>
                )}
              </>
            )}
          </div>,
          document.body,
        )}

      {/* Risk Modal */}
      {showRiskModal && (
        <Dialog
          open={showRiskModal}
          onOpenChange={(open) => !open && setShowRiskModal(false)}
        >
          <DialogContent className="max-w-xl w-full sm:max-w-xl p-0 overflow-hidden bg-white border border-gray-200 shadow-xl rounded-sm font-sans text-gray-800 flex flex-col gap-0 z-[2000]">
            {/* Header */}
            <DialogHeader className="p-6 pb-4 border-b border-gray-100 bg-white space-y-1.5">
              <DialogTitle
                className="text-xl font-normal flex items-center gap-2.5"
                style={{ color: "#676a6c" }}
              >
                <AlertTriangle size={22} className="text-amber-500 shrink-0" />
                <span>Mark Subtask as Risk: {subtask?.title}</span>
              </DialogTitle>
              <p className="text-xs text-gray-500 font-normal">
                Flag this subtask as a risk item and specify the risk level
                and reason for tracking.
              </p>
            </DialogHeader>

            {/* Body */}
            <div className="p-6 space-y-5 min-h-[220px] max-h-[80vh] overflow-y-auto">
              {/* Risk Level Select */}
              <div className="space-y-2">
                <Label
                  htmlFor="subtaskRiskLevel"
                  className="text-xs font-semibold text-gray-700 uppercase tracking-wider"
                >
                  Risk Level <span className="text-red-500">*</span>
                </Label>
                <Select value={riskLevel} onValueChange={setRiskLevel}>
                  <SelectTrigger
                    id="subtaskRiskLevel"
                    className="w-full bg-white border-gray-300 text-gray-900 text-sm h-9 font-normal focus:ring-amber-500 focus:border-amber-500"
                  >
                    <SelectValue placeholder="Select risk level" />
                  </SelectTrigger>
                  <SelectContent className="z-[3000]">
                    <SelectItem value="low">Low Risk</SelectItem>
                    <SelectItem value="medium">Medium Risk</SelectItem>
                    <SelectItem value="high">High Risk</SelectItem>
                    <SelectItem value="critical">Critical Risk</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Risk Reason Textarea */}
              <div className="space-y-2">
                <Label
                  htmlFor="subtaskRiskReason"
                  className="text-xs font-semibold text-gray-700 uppercase tracking-wider"
                >
                  Risk Reason <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="subtaskRiskReason"
                  value={riskReason}
                  onChange={(e) => setRiskReason(e.target.value)}
                  placeholder="Describe why this subtask is at risk..."
                  className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500 text-sm resize-none"
                  rows={4}
                />
              </div>
            </div>

            {/* Actions / Footer */}
            <DialogFooter className="p-4 px-6 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowRiskModal(false);
                  setRiskReason("");
                  setRiskLevel("medium");
                }}
                disabled={riskLoading}
                className="bg-white border-gray-300 hover:bg-gray-50 text-gray-700 text-sm h-8 px-4 font-normal rounded-sm flex items-center justify-center text-center leading-none py-0"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleMarkRisk}
                disabled={riskLoading || !riskReason.trim()}
                className="bg-amber-500 hover:bg-amber-600 text-white text-sm h-8 px-4 font-medium rounded-sm shadow-sm disabled:opacity-50 flex items-center justify-center text-center leading-none py-0"
              >
                {riskLoading ? "Marking..." : "Mark as Risk"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Mitigation Modal */}
      {showMitigationModal && (
        <Dialog
          open={showMitigationModal}
          onOpenChange={(open) => !open && setShowMitigationModal(false)}
        >
          <DialogContent className="max-w-xl w-full sm:max-w-xl p-0 overflow-hidden bg-white border border-gray-200 shadow-xl rounded-sm font-sans text-gray-800 flex flex-col gap-0 z-[2000]">
            {/* Header */}
            <DialogHeader className="p-6 pb-4 border-b border-gray-100 bg-white space-y-1.5">
              <DialogTitle
                className="text-xl font-normal flex items-center gap-2.5"
                style={{ color: "#676a6c" }}
              >
                <CheckCircle size={22} className="text-emerald-600 shrink-0" />
                <span>Mark Risk as Mitigated: {subtask?.title}</span>
              </DialogTitle>
              <p className="text-xs text-gray-500 font-normal">
                Resolve the flagged risk for this subtask and describe the
                mitigation action taken.
              </p>
            </DialogHeader>

            {/* Body */}
            <div className="p-6 space-y-5 min-h-[220px] max-h-[80vh] overflow-y-auto">
              <div className="bg-amber-50/80 border border-amber-200/80 rounded-sm p-3.5 space-y-1">
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
                  Current Active Risk
                </p>
                <p className="text-sm text-amber-900">
                  {subtask.riskReason || "No details specified"}
                  {subtask.riskLevel && (
                    <span className="ml-2 text-xs font-bold uppercase px-2 py-0.5 bg-amber-200/70 text-amber-900 rounded">
                      {subtask.riskLevel}
                    </span>
                  )}
                </p>
              </div>

              {/* Mitigation Reason Textarea */}
              <div className="space-y-2">
                <Label
                  htmlFor="subtaskMitigationReason"
                  className="text-xs font-semibold text-gray-700 uppercase tracking-wider"
                >
                  Mitigation Reason <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="subtaskMitigationReason"
                  value={mitigationReason}
                  onChange={(e) => setMitigationReason(e.target.value)}
                  placeholder="Describe how this risk has been mitigated..."
                  className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:ring-emerald-500 text-sm resize-none"
                  rows={4}
                />
              </div>
            </div>

            {/* Actions / Footer */}
            <DialogFooter className="p-4 px-6 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowMitigationModal(false);
                  setMitigationReason("");
                }}
                disabled={riskLoading}
                className="bg-white border-gray-300 hover:bg-gray-50 text-gray-700 text-sm h-8 px-4 font-normal rounded-sm flex items-center justify-center text-center leading-none py-0"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleUnmarkRisk}
                disabled={riskLoading || !mitigationReason.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm h-8 px-4 font-medium rounded-sm shadow-sm disabled:opacity-50 flex items-center justify-center text-center leading-none py-0"
              >
                {riskLoading ? "Saving..." : "Mark as Mitigated"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Snooze Modal */}
      {showSnoozeModal && (
        <SnoozeTaskModal
          isOpen={showSnoozeModal}
          onClose={() => setShowSnoozeModal(false)}
          onConfirm={handleSnoozeConfirm}
          task={subtask}
        />
      )}

      {/* Mark as Done Modal */}
      {showMarkDoneModal && (
        <MarkDoneModal
          isOpen={showMarkDoneModal}
          onClose={() => setShowMarkDoneModal(false)}
          onConfirm={() => {
            handleMarkDone();
            setShowMarkDoneModal(false);
          }}
          task={subtask}
        />
      )}

      {/* Cancel Task Modal */}
      {showCancelModal &&
        createPortal(
          <div className="fixed inset-0 z-[999999] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-sm shadow-xl overflow-hidden max-w-md w-full border border-gray-200 animate-in fade-in zoom-in-95 duration-200 flex flex-col font-sans">
              {/* Header */}
              <div className="px-6 pt-3.5 pb-2.5 border-b border-gray-200 bg-gray-50/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <span className="text-xl font-normal" style={{ color: "#676a6c" }}>
                    Cancel Task
                  </span>
                </div>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-600 transition-colors w-6 h-6 flex items-center justify-center text-base"
                  onClick={() => setShowCancelModal(false)}
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-3.5 bg-white">
                <p className="text-xs text-gray-500 font-normal">
                  Are you sure you want to cancel this task? Please provide a reason below.
                </p>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                    Reason for cancellation <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Provide cancellation reason..."
                    className="w-full p-2.5 border border-gray-300 rounded-sm text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[90px] resize-none bg-white text-gray-900 placeholder:text-gray-400"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCancelModal(false)}
                  className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium h-8 px-4 rounded-sm !h-8"
                  style={{ height: "32px", minHeight: "32px" }}
                >
                  Go Back
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmCancel}
                  disabled={!cancelReason.trim() || cancelLoading}
                  className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium h-8 px-4 rounded-sm shadow-sm disabled:opacity-50 !h-8"
                  style={{ height: "32px", minHeight: "32px" }}
                >
                  {cancelLoading ? "Cancelling..." : "Confirm Cancel"}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
