import React, { useCallback, useMemo } from "react";

export function RecurringForm({
  formData,
  onInputChange,
  validationErrors = {},
}) {
  const recurringData = formData.recurring || {
    pattern: "daily",
    repeatEvery: 1,
    startDate: "",
    endDate: "",
    endCondition: "never",
    occurrences: 10,
    weekdays: [],
    monthlyType: "date",
    monthlyDates: [],
  };

  // Get today's date for validation
  const today = useMemo(() => {
    return new Date().toISOString().split("T")[0];
  }, []);

  const handleRecurringChange = useCallback(
    (field, value) => {
      const updatedRecurring = {
        ...recurringData,
        [field]: value,
      };

      onInputChange("recurring", updatedRecurring);
    },
    [recurringData, onInputChange],
  );

  const weekdayOptions = [
    { value: "monday", label: "Mon" },
    { value: "tuesday", label: "Tue" },
    { value: "wednesday", label: "Wed" },
    { value: "thursday", label: "Thu" },
    { value: "friday", label: "Fri" },
    { value: "saturday", label: "Sat" },
    { value: "sunday", label: "Sun" },
  ];

  const handleWeekdayToggle = (weekday) => {
    const currentWeekdays = recurringData.weekdays || [];
    const newWeekdays = currentWeekdays.includes(weekday)
      ? currentWeekdays.filter((day) => day !== weekday)
      : [...currentWeekdays, weekday];
    handleRecurringChange("weekdays", newWeekdays);
  };

  return (
    <div className="space-y-3">
      {/* Recurrence Pattern */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Recurrence Pattern *
        </label>
        <select
          value={recurringData.pattern || "daily"}
          onChange={(e) => handleRecurringChange("pattern", e.target.value)}
          className="w-full h-9 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="select-recurrence-pattern"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {/* Repeat Every */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Repeat Every
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={recurringData.repeatEvery || 1}
            onChange={(e) =>
              handleRecurringChange(
                "repeatEvery",
                parseInt(e.target.value) || 1,
              )
            }
            min="1"
            max="99"
            className="w-20 h-9 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="input-repeat-every"
          />
          <span className="text-sm text-gray-600">
            {recurringData.pattern === "daily" && "day(s)"}
            {recurringData.pattern === "weekly" && "week(s)"}
            {recurringData.pattern === "monthly" && "month(s)"}
          </span>
        </div>
      </div>

      {/* Weekly Options */}
      {recurringData.pattern === "weekly" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Repeat On *
          </label>
          <div className="flex flex-wrap gap-2">
            {weekdayOptions.map((weekday) => (
              <button
                key={weekday.value}
                type="button"
                onClick={() => handleWeekdayToggle(weekday.value)}
                className={`px-3 py-2 text-sm rounded-sm border transition-colors ${
                  (recurringData.weekdays || []).includes(weekday.value)
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
                data-testid={`weekday-${weekday.value}`}
              >
                {weekday.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Select the days of the week to repeat on
          </p>
          {validationErrors.weekdays && (
            <p
              className="text-red-600 text-sm mt-1"
              data-testid="error-weekdays"
            >
              {validationErrors.weekdays}
            </p>
          )}
        </div>
      )}

      {/* Monthly Options */}
      {recurringData.pattern === "monthly" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Monthly Repeat Type
          </label>
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="date"
                checked={recurringData.monthlyType === "date"}
                onChange={(e) =>
                  handleRecurringChange("monthlyType", e.target.value)
                }
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                data-testid="radio-monthly-date"
              />
              <span className="text-sm text-gray-700">
                On specific date(s) of the month
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="weekday"
                checked={recurringData.monthlyType === "weekday"}
                onChange={(e) =>
                  handleRecurringChange("monthlyType", e.target.value)
                }
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                data-testid="radio-monthly-weekday"
              />
              <span className="text-sm text-gray-700">
                On specific weekday of the month
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Start Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Start Date *
        </label>
        <input
          type="date"
          value={recurringData.startDate || ""}
          onChange={(e) => handleRecurringChange("startDate", e.target.value)}
          min={today}
          className={`w-full h-9 px-3 border rounded-md focus:outline-none focus:ring-2 transition-colors ${
            validationErrors.startDate
              ? "border-red-300 focus:ring-red-500"
              : "border-gray-300 focus:ring-blue-500"
          }`}
          data-testid="input-start-date"
        />
        {validationErrors.startDate && (
          <p
            className="text-red-600 text-sm mt-1"
            data-testid="error-start-date"
          >
            {validationErrors.startDate}
          </p>
        )}
      </div>

      {/* End Condition */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          End Condition
        </label>
        <select
          value={recurringData.endCondition || "never"}
          onChange={(e) =>
            handleRecurringChange("endCondition", e.target.value)
          }
          className="w-full h-9 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="select-end-condition"
        >
          <option value="never">Never ends</option>
          <option value="date">End on specific date</option>
          <option value="occurrences">End after number of occurrences</option>
        </select>
      </div>

      {/* End Date (if end condition is date) */}
      {recurringData.endCondition === "date" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            End Date *
          </label>
          <input
            type="date"
            value={recurringData.endDate || ""}
            onChange={(e) => handleRecurringChange("endDate", e.target.value)}
            min={recurringData.startDate || today}
            className={`w-full h-9 px-3 border rounded-md focus:outline-none focus:ring-2 transition-colors ${
              validationErrors.endDate
                ? "border-red-300 focus:ring-red-500"
                : "border-gray-300 focus:ring-blue-500"
            }`}
            data-testid="input-end-date"
          />
          {validationErrors.endDate && (
            <p
              className="text-red-600 text-sm mt-1"
              data-testid="error-end-date"
            >
              {validationErrors.endDate}
            </p>
          )}
        </div>
      )}

      {/* Number of Occurrences (if end condition is occurrences) */}
      {recurringData.endCondition === "occurrences" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Number of Occurrences *
          </label>
          <input
            type="number"
            value={recurringData.occurrences || 10}
            onChange={(e) =>
              handleRecurringChange(
                "occurrences",
                parseInt(e.target.value) || 1,
              )
            }
            min="1"
            max="999"
            className={`w-full h-9 px-3 border rounded-md focus:outline-none focus:ring-2 transition-colors ${
              validationErrors.occurrences
                ? "border-red-300 focus:ring-red-500"
                : "border-gray-300 focus:ring-blue-500"
            }`}
            data-testid="input-occurrences"
          />
          {validationErrors.occurrences && (
            <p
              className="text-red-600 text-sm mt-1"
              data-testid="error-occurrences"
            >
              {validationErrors.occurrences}
            </p>
          )}
        </div>
      )}

      {/* Recurrence Summary */}
      <div className="bg-blue-50 p-4 rounded-sm border border-blue-200">
        <h4 className="text-sm font-medium text-blue-900 mb-2">
          Recurrence Summary
        </h4>
        <p className="text-sm text-blue-800">
          This task will repeat{" "}
          {recurringData.pattern === "daily" &&
            `every ${recurringData.repeatEvery || 1} day(s)`}
          {recurringData.pattern === "weekly" &&
            `every ${recurringData.repeatEvery || 1} week(s)`}
          {recurringData.pattern === "monthly" &&
            `every ${recurringData.repeatEvery || 1} month(s)`}
          {recurringData.startDate &&
            ` starting from ${recurringData.startDate}`}
          {recurringData.endCondition === "never" &&
            ", continuing indefinitely"}
          {recurringData.endCondition === "date" &&
            recurringData.endDate &&
            ` until ${recurringData.endDate}`}
          {recurringData.endCondition === "occurrences" &&
            ` for ${recurringData.occurrences || 10} occurrences`}
          .
        </p>
      </div>
    </div>
  );
}

export default RecurringForm;
