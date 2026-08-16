/**
 * ParentCancellationConfig — Phase 3 Frontend Component
 *
 * Radio buttons to configure what happens to the parent workflow
 * when a subtask is Rejected or Cancelled.
 */

import React from "react";
import { ParentCancellationMode, ParentCancellationModeLabel } from "../../constants/workflowEnums";

/**
 * @param {Object} props
 * @param {string} props.value - Current mode
 * @param {Function} props.onChange
 * @param {boolean} [props.disabled]
 */
export default function ParentCancellationConfig({ value, onChange, disabled = false }) {
  const options = [
    {
      value: ParentCancellationMode.IGNORE_REJECTION,
      label: ParentCancellationModeLabel[ParentCancellationMode.IGNORE_REJECTION],
    },
    {
      value: ParentCancellationMode.CANCEL_ON_REJECTION,
      label: ParentCancellationModeLabel[ParentCancellationMode.CANCEL_ON_REJECTION],
    },
  ];

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Parent Cancellation
      </label>
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
              value === option.value
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <input
              type="radio"
              name="parentCancellationMode"
              value={option.value}
              checked={value === option.value}
              onChange={() => !disabled && onChange(option.value)}
              disabled={disabled}
              className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
