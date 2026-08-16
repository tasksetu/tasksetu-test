/**
 * WorkflowTypeSelector — Phase 14 Frontend Component
 *
 * Dropdown to select what kind of business process the parent workflow represents.
 * Generic: Vendor Onboarding, Employee Onboarding, Procurement, etc.
 */

import React from "react";
import { workflowTypeOptions } from "../../constants/workflowEnums";

/**
 * @param {Object} props
 * @param {string} props.value
 * @param {Function} props.onChange
 * @param {boolean} [props.disabled]
 */
export default function WorkflowTypeSelector({ value, onChange, disabled = false }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Workflow Type
      </label>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:border-2 bg-white"
      >
        <option value="">— Select workflow type —</option>
        {workflowTypeOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-500 mt-1">
        Optional. Labels this process for reporting and filtering.
      </p>
    </div>
  );
}
