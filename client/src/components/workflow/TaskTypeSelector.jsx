/**
 * TaskTypeSelector — Phase 14 Frontend Component
 *
 * Renders a horizontal radio-button-style selector for choosing a subtask type.
 * Shows: Regular | Email | Approval | Milestone
 * Used in subtask creation modals and the process builder.
 */

import React from "react";
import { CheckSquare, Mail, ShieldCheck, Flag } from "lucide-react";
import { subtaskTypeOptions } from "../../constants/workflowEnums";

const iconMap = {
  CheckSquare,
  Mail,
  ShieldCheck,
  Flag,
};

/**
 * @param {Object} props
 * @param {string} props.value - Currently selected task type
 * @param {Function} props.onChange - Called with new value
 * @param {boolean} [props.disabled]
 * @param {string} [props.label] - Optional section label (default: "Task Type")
 */
export default function TaskTypeSelector({
  value,
  onChange,
  disabled = false,
  label = "Task Type",
}) {
  return (
    <div className="mb-4">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label} <span className="text-red-500">*</span>
        </label>
      )}
      <div className="grid grid-cols-4 gap-2">
        {subtaskTypeOptions.map((option) => {
          const IconComponent = iconMap[option.icon];
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onChange(option.value)}
              className={`
                flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 text-xs font-medium
                transition-all duration-150 cursor-pointer select-none
                ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                }
                ${disabled ? "opacity-50 cursor-not-allowed" : ""}
              `}
            >
              {IconComponent && (
                <IconComponent
                  className={`w-5 h-5 ${isSelected ? "text-blue-600" : "text-gray-400"}`}
                />
              )}
              <span>{option.label.replace(" Task", "").replace("Milestone", "Milestone")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
