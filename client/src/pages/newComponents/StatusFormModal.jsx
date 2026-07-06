import React, { useState } from "react";
import { Button } from "@/components/ui/button";

const colorPresets = [
  "#6B7280", // gray
  "#3B82F6", // blue
  "#22C55E", // green
  "#F59E0B", // amber
  "#F97316", // orange
  "#EF4444", // red
  "#A855F7", // purple
  "#EC4899", // pink
  "#14B8A6", // teal
  "#0EA5E9", // sky
  "#8B5CF6", // violet
  "#64748B", // slate
  "#10B981", // emerald
  "#84CC16", // lime
  "#EAB308", // yellow
  "#111827", // near-black
];

function StatusFormModal({
  status,
  onSubmit,
  onClose,
  existingStatuses,
  isEdit = false,
}) {
  const [formData, setFormData] = useState({
    _id: status?._id,
    code: status?.code || "",
    label: status?.label || "",
    description: status?.description || "",
    color: status?.color || "#6B7280",
    isFinal: !!status?.isFinal,
    active: status?.active ?? true,
    allowedTransitions: status?.allowedTransitions || [],
    systemStatus: status?.systemStatus || "OPEN",
  });

  const [showTransitionsDropdown, setShowTransitionsDropdown] = useState(false);
  const [showSystemStatusInfo, setShowSystemStatusInfo] = useState(false);

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!formData.code.trim()) {
      newErrors.code = "Status code is required";
    } else if (!/^[A-Z_]+$/.test(formData.code)) {
      newErrors.code =
        "Status code must contain only uppercase letters and underscores";
    } else if (
      !isEdit &&
      Array.isArray(existingStatuses) &&
      existingStatuses.some(
        (s) =>
          String(s?.code || "").toUpperCase() ===
          formData.code.trim().toUpperCase(),
      )
    ) {
      newErrors.code = "Status code already exists";
    }

    if (!formData.label.trim()) {
      newErrors.label = "Display label is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors({ ...errors, [name]: "" });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit({
        ...formData,
        code: formData.code.trim().toUpperCase(),
        label: formData.label.trim(),
        allowedTransitions: formData.allowedTransitions || [],
        systemStatus: formData.systemStatus || "OPEN",
      });
    }
  };

  const toggleTransition = (statusCode) => {
    const currentTransitions = formData.allowedTransitions || [];
    if (currentTransitions.includes(statusCode)) {
      setFormData({
        ...formData,
        allowedTransitions: currentTransitions.filter(
          (code) => code !== statusCode,
        ),
      });
    } else {
      setFormData({
        ...formData,
        allowedTransitions: [...currentTransitions, statusCode],
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
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
            </div>
            <h2 className="text-lg font-semibold text-white">
              {isEdit ? "Edit Status" : "Create New Status"}
            </h2>
          </div>
          <button
            className="text-white/80 hover:text-white transition-colors text-2xl leading-none"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          <form onSubmit={handleSubmit}>
            {/* Status Code & Label Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="form-group">
                <label
                  htmlFor="code"
                  className="form-label flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4 text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                    />
                  </svg>
                  Status Code*
                </label>
                <input
                  type="text"
                  id="code"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  required
                  disabled={isEdit}
                  className={`form-input ${errors.code ? "border-red-500 ring-red-200" : ""} ${isEdit ? "bg-gray-100 cursor-not-allowed" : ""}`}
                  placeholder="e.g., IN_PROGRESS"
                />
                {errors.code && (
                  <span className="text-red-500 text-sm mt-1 block">
                    {errors.code}
                  </span>
                )}
                <small className="form-hint">
                  {isEdit
                    ? "Status code cannot be changed after creation"
                    : "Use UPPERCASE letters and underscores only"}
                </small>
              </div>

              <div className="form-group">
                <label
                  htmlFor="label"
                  className="form-label flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4 text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                  Display Label*
                </label>
                <input
                  type="text"
                  id="label"
                  name="label"
                  value={formData.label}
                  onChange={handleChange}
                  required
                  className={`form-input ${errors.label ? "border-red-500 ring-red-200" : ""}`}
                  placeholder="e.g., In Progress"
                />
                {errors.label && (
                  <span className="text-red-500 text-sm mt-1 block">
                    {errors.label}
                  </span>
                )}
                <small className="form-hint">
                  User-friendly name shown in the interface
                </small>
              </div>
            </div>

            {/* Color Selection */}
            <div className="form-group">
              <label className="form-label flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM7 3H5a2 2 0 00-2 2v12a4 4 0 004 4h2a2 2 0 002-2V5a2 2 0 00-2-2z"
                  />
                </svg>
                Status Color
              </label>

              <div className="flex flex-col gap-3">
                {/* Color Presets */}
                <div className="grid grid-cols-8 gap-2">
                  {colorPresets.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-8 h-8 rounded-sm border-2 transition-all duration-200 hover:scale-110 ${
                        formData.color === color
                          ? "border-blue-500 ring-2 ring-blue-200"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({ ...formData, color })}
                      title={color}
                    />
                  ))}
                </div>

                {/* Custom Color Input */}
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    id="color"
                    name="color"
                    value={formData.color}
                    onChange={handleChange}
                    className="w-12 h-12 rounded-sm border-2 border-gray-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData({ ...formData, color: e.target.value })
                    }
                    className="form-input flex-1"
                    placeholder="#667eea"
                    pattern="^#[0-9A-Fa-f]{6}$"
                  />
                  <div
                    className="w-12 h-12 rounded-sm border-2 border-gray-200 flex items-center justify-center font-bold text-white text-xs shadow-inner"
                    style={{ backgroundColor: formData.color }}
                  >
                    {formData.label
                      ? formData.label.charAt(0).toUpperCase()
                      : "A"}
                  </div>
                </div>
              </div>
              <small className="form-hint">
                Choose a color that represents this status visually
              </small>
            </div>

            {/* Status Properties */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="form-group">
                <label className="form-label flex items-center gap-2 mb-3">
                  <svg
                    className="w-4 h-4 text-blue-500"
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
                  Status Properties
                </label>
                <div className="p-4 bg-gray-50 rounded-sm border border-gray-200 hover:bg-gray-100 transition-colors">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="isFinal"
                      checked={formData.isFinal}
                      onChange={handleChange}
                      className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 mb-1">
                        Final Status
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        This status represents an end state
                      </p>
                    </div>
                  </label>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label flex items-center gap-2 mb-3">
                  Active
                </label>
                <div className="p-4 bg-gray-50 rounded-sm border border-gray-200 hover:bg-gray-100 transition-colors">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="active"
                      checked={!!formData.active}
                      onChange={handleChange}
                      className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 mb-1">
                        Enabled
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        Visible in status dropdowns and filters
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label
                htmlFor="description"
                className="form-label flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="form-input"
                placeholder="Optional description for this status..."
              />
              <small className="form-hint">
                Provide additional details about this status
              </small>
            </div>

            {/* System Status Mapping */}
            <div className="form-group">
              <label className="form-label flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                System Status Mapping*
                <button
                  type="button"
                  onClick={() => setShowSystemStatusInfo(!showSystemStatusInfo)}
                  className="ml-1 text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </label>
              {showSystemStatusInfo && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-sm text-sm text-blue-800">
                  <p className="font-medium mb-1">ℹ️ System Status Purpose:</p>
                  <p className="text-xs">
                    Maps your custom status to a core system status. This
                    ensures proper task lifecycle, workflow logic, and reporting
                    even when using custom status names.
                  </p>
                </div>
              )}
              <select
                id="systemStatus"
                name="systemStatus"
                value={formData.systemStatus}
                onChange={handleChange}
                required
                className="form-input"
              >
                <option value="OPEN">OPEN - Initial/Not Started</option>
                <option value="INPROGRESS">IN PROGRESS - Active Work</option>
                <option value="ONHOLD">ON HOLD - Paused/Waiting</option>
                <option value="DONE">DONE - Completed Successfully</option>
                <option value="CANCELLED">
                  CANCELLED - Terminated/Rejected
                </option>
              </select>
              <small className="form-hint">
                Select the core system status that best matches this custom
                status
              </small>
            </div>

            {/* Allowed Transitions */}
            <div className="form-group">
              <label className="form-label flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Allowed Transitions
                <span className="text-xs text-gray-500 font-normal ml-auto">
                  (Optional)
                </span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setShowTransitionsDropdown(!showTransitionsDropdown)
                  }
                  className="w-full px-4 py-2 text-left border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">
                      {formData.allowedTransitions?.length > 0
                        ? `${formData.allowedTransitions.length} status(es) selected`
                        : "Select allowed transitions..."}
                    </span>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        showTransitionsDropdown ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </button>

                {showTransitionsDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-sm shadow-lg max-h-60 overflow-y-auto">
                    {existingStatuses
                      ?.filter((s) => s.code !== formData.code && s.active)
                      .map((s) => (
                        <label
                          key={s._id || s.code}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={formData.allowedTransitions?.includes(
                              s.code,
                            )}
                            onChange={() => toggleTransition(s.code)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex items-center gap-2 flex-1">
                            <span
                              className="inline-block w-3 h-3 rounded-full"
                              style={{ backgroundColor: s.color }}
                            />
                            <span className="text-sm font-medium text-gray-900">
                              {s.label}
                            </span>
                            <code className="text-xs text-gray-500 ml-auto">
                              {s.code}
                            </code>
                          </div>
                        </label>
                      ))}
                    {(!existingStatuses ||
                      existingStatuses.filter(
                        (s) => s.code !== formData.code && s.active,
                      ).length === 0) && (
                      <div className="px-4 py-3 text-sm text-gray-500 text-center">
                        No other statuses available
                      </div>
                    )}
                  </div>
                )}
              </div>
              <small className="form-hint">
                Define which statuses users can transition to from this status.
                Leave empty to allow transitions to any status.
              </small>
              {formData.allowedTransitions?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {formData.allowedTransitions.map((code) => {
                    const targetStatus = existingStatuses?.find(
                      (s) => s.code === code,
                    );
                    return (
                      <span
                        key={code}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"
                      >
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: targetStatus?.color }}
                        />
                        {targetStatus?.label || code}
                        <button
                          type="button"
                          onClick={() => toggleTransition(code)}
                          className="ml-1 hover:text-blue-900"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between space-x-3 pt-6 border-t border-gray-200">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="gradient"
                className="flex items-center gap-2"
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {isEdit ? "Update Status" : "Create Status"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default StatusFormModal;
