import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useLocation } from "wouter";
import { createPortal } from "react-dom";
import { Button } from '@/components/ui/button';

export default function SubtaskActionsDropdown({
    subtask,
    parentTaskId,
    parentTaskStatus,
    onEdit,
    onDelete,
    onView,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef(null);
    const menuRef = useRef(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    const [, navigate] = useLocation();

    // Risk modal states
    const [showRiskModal, setShowRiskModal] = useState(false);
    const [showMitigationModal, setShowMitigationModal] = useState(false);
    const [riskReason, setRiskReason] = useState("");
    const [riskLevel, setRiskLevel] = useState("medium");
    const [mitigationReason, setMitigationReason] = useState("");
    const [riskLoading, setRiskLoading] = useState(false);

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
                }
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
                })
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
                }
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
                })
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

        let left = rect.right - menuWidth;
        left = Math.max(8, Math.min(left, viewportWidth - menuWidth - 8));
        let top = rect.bottom + gap;
        const estimatedMenuHeight = 145;
        if (top + estimatedMenuHeight > viewportHeight - 8) {
            top = Math.max(8, rect.top - gap - estimatedMenuHeight);
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
                t && m &&
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
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View Details
                        </Button>

                        <Button
                            variant="ghost"
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3 transition-colors justify-start h-auto rounded-none"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleAction(() => onEdit && onEdit(subtask));
                            }}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit Subtask
                        </Button>

                        {/* Mark as Risk Button - Show only if not already marked */}
                        {!subtask.isRisk && (
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

                        {/* Mark as Mitigated Button - Show only if marked as risk */}
                        {subtask.isRisk && (
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

                        <div className="border-t border-gray-200 my-1"></div>

                        {(() => {
                            const DELETABLE_STATUSES = ['OPEN', 'ONHOLD', 'CANCELLED'];
                            const canDelete = DELETABLE_STATUSES.includes(subtask?.status);

                            const getDeleteTooltip = () => {
                                if (!canDelete) return `Cannot delete subtask with status ${subtask?.status}. Only OPEN, ONHOLD or CANCELLED subtasks can be deleted.`;
                                return '';
                            };

                            return (
                                <Button
                                    variant="ghost"
                                    disabled={!canDelete}
                                    title={getDeleteTooltip()}
                                    className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors justify-start h-auto rounded-none ${!canDelete
                                        ? 'text-gray-400 cursor-not-allowed opacity-50'
                                        : 'text-red-600 hover:bg-red-50'
                                        }`}
                                    onClick={(e) => {
                                        if (canDelete) {
                                            e.stopPropagation();
                                            handleAction(() => onDelete && onDelete(parentTaskId, subtask.id || subtask._id));
                                        }
                                    }}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete Subtask
                                </Button>
                            );
                        })()}
                    </div>,
                    document.body
                )}

            {/* Risk Modal */}
            {showRiskModal &&
                createPortal(
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-[2000] flex items-center justify-center">
                        <div className="bg-white rounded-none shadow-xl border border-gray-200 p-4 w-96 max-h-[90vh] overflow-y-auto">
                            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <svg
                                    className="w-5 h-5 text-yellow-600"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                >
                                    <path d="M10.5 1.5H9.5L1.5 16h17L10.5 1.5zM10 13a1 1 0 110-2 1 1 0 010 2zm0-4a1 1 0 100-2 1 1 0 000 2z" />
                                </svg>
                                Mark Subtask as Risk
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Risk Level
                                    </label>
                                    <select
                                        value={riskLevel}
                                        onChange={(e) => setRiskLevel(e.target.value)}
                                        className="w-full h-9 px-3 border border-gray-300 rounded-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Risk Reason *
                                    </label>
                                    <textarea
                                        value={riskReason}
                                        onChange={(e) => setRiskReason(e.target.value)}
                                        placeholder="Describe why this subtask is marked as risk..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none h-24"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                        setShowRiskModal(false);
                                        setRiskReason("");
                                        setRiskLevel("medium");
                                    }}
                                    disabled={riskLoading}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="default"
                                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white"
                                    onClick={handleMarkRisk}
                                    disabled={riskLoading || !riskReason.trim()}
                                >
                                    {riskLoading ? "Marking..." : "Mark as Risk"}
                                </Button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

            {/* Mitigation Modal */}
            {showMitigationModal &&
                createPortal(
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-[2000] flex items-center justify-center">
                        <div className="bg-white rounded-none shadow-xl border border-gray-200 p-4 w-96 max-h-[90vh] overflow-y-auto">
                            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <svg
                                    className="w-5 h-5 text-green-600"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                                Mark Risk as Mitigated
                            </h2>

                            <div className="bg-blue-50 border border-blue-200 rounded-none p-3 mb-4">
                                <p className="text-sm text-blue-800">
                                    <strong>Current Risk:</strong> {subtask.riskReason}
                                    {subtask.riskLevel && (
                                        <span className="ml-2">
                                            ({subtask.riskLevel.toUpperCase()})
                                        </span>
                                    )}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Mitigation Reason
                                </label>
                                <textarea
                                    value={mitigationReason}
                                    onChange={(e) => setMitigationReason(e.target.value)}
                                    placeholder="Describe how this risk has been mitigated..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none h-24"
                                />
                            </div>

                            <div className="flex gap-3 mt-6">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                        setShowMitigationModal(false);
                                        setMitigationReason("");
                                    }}
                                    disabled={riskLoading}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="default"
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                    onClick={handleUnmarkRisk}
                                    disabled={riskLoading}
                                >
                                    {riskLoading ? "Processing..." : "Mark as Mitigated"}
                                </Button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
}
