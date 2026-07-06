import React, { useState, useCallback } from "react";
import { MultiSelect } from "../components/ui/MultiSelect";

export function ApprovalForm({
  formData,
  onInputChange,
  validationErrors = {},
}) {
  const [draggedIndex, setDraggedIndex] = useState(null);

  const approvalData = formData.approval || {
    approvers: [],
    approvalMode: "any_one",
    approverOrder: [],
    autoApproval: false,
    autoApprovalDays: 0,
  };

  const handleApprovalChange = useCallback(
    (field, value) => {
      const updatedApproval = {
        ...approvalData,
        [field]: value,
      };

      // If changing to sequential mode, initialize approver order
      if (field === "approvalMode" && value === "sequential") {
        updatedApproval.approverOrder = [...updatedApproval.approvers];
      }

      onInputChange("approval", updatedApproval);
    },
    [approvalData, onInputChange],
  );

  // Drag and drop handlers for approver ordering
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null) return;

    const newOrder = [...approvalData.approverOrder];
    const draggedItem = newOrder[draggedIndex];

    // Remove dragged item
    newOrder.splice(draggedIndex, 1);
    // Insert at new position
    newOrder.splice(dropIndex, 0, draggedItem);

    handleApprovalChange("approverOrder", newOrder);
    setDraggedIndex(null);
  };

  const approverOptions = [];

  return (
    <div className="space-y-3">
      {/* Approvers */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Approvers *
        </label>
        <MultiSelect
          options={approverOptions}
          value={approvalData.approvers || []}
          onChange={(selectedValues) =>
            handleApprovalChange("approvers", selectedValues)
          }
          placeholder="Search and select approvers..."
          dataTestId="multi-select-approvers"
        />
        <p className="text-xs text-gray-500 mt-1">
          Select who needs to approve this task
        </p>
        {validationErrors.approvers && (
          <p
            className="text-red-600 text-sm mt-1"
            data-testid="error-approvers"
          >
            {validationErrors.approvers}
          </p>
        )}
      </div>

      {/* Approval Mode */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Approval Mode *
        </label>
        <select
          value={approvalData.approvalMode || "any_one"}
          onChange={(e) => handleApprovalChange("approvalMode", e.target.value)}
          className="w-full h-9 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
          data-testid="select-approval-mode"
        >
          <option value="any_one">
            Any One - Only one approver needs to approve
          </option>
          <option value="all_must">
            All Must - All approvers must approve
          </option>
          <option value="sequential">
            Sequential - Approvers must approve in order
          </option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Choose how approvals should be processed
        </p>
      </div>

      {/* Approver Order (only for Sequential) */}
      {approvalData.approvalMode === "sequential" &&
        approvalData.approvers?.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Approver Order *
            </label>
            <div className="space-y-2">
              {(approvalData.approverOrder?.length > 0
                ? approvalData.approverOrder
                : approvalData.approvers
              ).map((approverId, index) => {
                const approverOption = approverOptions.find(
                  (opt) => opt.value === approverId,
                );

                return (
                  <div
                    key={approverId}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-sm cursor-move hover:bg-emerald-100 transition-colors"
                    data-testid={`approver-order-${index}`}
                  >
                    <div className="flex items-center gap-2 text-gray-400">
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M9 5h2v2H9V5zm0 6h2v2H9v-2zm0 6h2v2H9v-2zm6-12h2v2h-2V5zm0 6h2v2h-2v-2zm0 6h2v2h-2v-2z" />
                      </svg>
                    </div>
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <span className="font-medium text-gray-900">
                        {approverOption?.label || approverId}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-emerald-600 mt-2">
              Drag to reorder the approval sequence
            </p>
            {validationErrors.approverOrder && (
              <p
                className="text-red-600 text-sm mt-1"
                data-testid="error-approver-order"
              >
                {validationErrors.approverOrder}
              </p>
            )}
          </div>
        )}

      {/* Auto-Approval */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Auto-Approval
        </label>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={approvalData.autoApproval || false}
              onChange={(e) =>
                handleApprovalChange("autoApproval", e.target.checked)
              }
              className="w-4 h-4 text-emerald-600 border-gray-300 rounded-md focus:ring-emerald-500"
              data-testid="toggle-auto-approval"
            />
            <span className="text-sm font-medium text-gray-700">
              Enable auto-approval
            </span>
          </label>

          {approvalData.autoApproval && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={approvalData.autoApprovalDays || 0}
                onChange={(e) =>
                  handleApprovalChange(
                    "autoApprovalDays",
                    parseInt(e.target.value) || 0,
                  )
                }
                min="0"
                className={`w-20 px-2 py-1 border rounded focus:outline-none focus:ring-2 transition-colors ${
                  validationErrors.autoApprovalDays
                    ? "border-red-300 focus:ring-red-500"
                    : "border-gray-300 focus:ring-emerald-500"
                }`}
                data-testid="input-auto-approval-days"
              />
              <span className="text-sm text-gray-600">days after due date</span>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Automatically approve if no response within specified days
        </p>
        {validationErrors.autoApprovalDays && (
          <p
            className="text-red-600 text-sm mt-1"
            data-testid="error-auto-approval-days"
          >
            {validationErrors.autoApprovalDays}
          </p>
        )}
      </div>
    </div>
  );
}

export default ApprovalForm;
