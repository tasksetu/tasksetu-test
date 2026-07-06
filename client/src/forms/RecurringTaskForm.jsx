import React, { useMemo, useState, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import CustomEditor from "../components/common/CustomEditor";
import "quill/dist/quill.snow.css";
import "../styles/quill-custom.css";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import AssigneeSearchSelect from "../components/common/AssigneeSearchSelect";
import { useShowToast } from "@/utils/ToastMessage";
import { Button } from "@/components/ui/button";
import {
  canAssignToOthers,
  getAssignmentScope,
} from "../utils/taskPermissions";
import { useTaskPriorities } from "@/hooks/useTaskPriorities";
import { getDefaultPriorityCode } from "@/utils/priorityUtils";
import { RecurringTaskIcon } from "../components/common/TaskIcons";

// ✅ Helper function to get today's date in local timezone (not UTC)
const getLocalTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// ✅ Helper function to get current time in HH:MM format
const getLocalCurrentTime = () => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

// Custom Dates Manager Component (for multiple date selection)
const CustomDatesManager = ({
  control,
  register,
  watch,
  setValue,
  errors,
  showErrorToast,
}) => {
  const [customDates, setCustomDates] = useState([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const calendarRef = useRef(null);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setShowCalendar(false);
      }
    };
    if (showCalendar) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCalendar]);

  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Load existing custom dates from form
  useEffect(() => {
    const existingDates = watch("recurrence.customDates");
    if (existingDates && Array.isArray(existingDates)) {
      setCustomDates(existingDates);
    }
  }, [watch("recurrence.customDates")]);

  const handleDateSelection = (date) => {
    const dateString = formatLocalDate(date);

    // Toggle selection
    if (selectedDates.includes(dateString)) {
      setSelectedDates(selectedDates.filter((d) => d !== dateString));
    } else {
      setSelectedDates([...selectedDates, dateString]);
    }
  };

  const addSelectedDates = () => {
    if (selectedDates.length === 0) {
      showErrorToast("Please select at least one date from the calendar");
      return;
    }

    // Merge with existing dates and remove duplicates
    const allDates = [...customDates, ...selectedDates];
    const uniqueDates = [...new Set(allDates)].sort();

    setCustomDates(uniqueDates);
    setValue("recurrence.customDates", uniqueDates);
    setSelectedDates([]);
    setShowCalendar(false);
  };

  const removeDate = (dateToRemove) => {
    const updatedDates = customDates.filter((d) => d !== dateToRemove);
    setCustomDates(updatedDates);
    setValue("recurrence.customDates", updatedDates);
  };

  // Generate calendar days
  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Days of month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(
        new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i),
      );
    }

    return days;
  };

  const isDatePast = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const isDateSelected = (date) => {
    const dateString = formatLocalDate(date);
    return selectedDates.includes(dateString);
  };

  const calendarDays = generateCalendarDays();

  return (
    <div className=" relative space-y-3">
      {/* Date Input - Click to Open Calendar */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <button
            type="button"
            onClick={() => setShowCalendar(!showCalendar)}
            className="w-full h-8 px-3 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer bg-white text-gray-600 hover:bg-gray-50 text-left flex items-center justify-between"
          >
            <span>
              {selectedDates.length > 0
                ? `${selectedDates.length} date(s) selected`
                : "Click to select dates"}
            </span>
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </button>
        </div>
        <Button
          type="button"
          onClick={addSelectedDates}
          size="md"
          disabled={selectedDates.length === 0}
        >
          Add
        </Button>
      </div>

      {/* Calendar Popup */}
      {showCalendar && (
        <div
          ref={calendarRef}
          className="absolute border border-gray-300 rounded-sm p-4 bg-white shadow-lg z-50"
        >
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() =>
                setCurrentMonth(
                  new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth() - 1,
                  ),
                )
              }
              className="p-2 hover:bg-gray-100 rounded"
            >
              ←
            </button>
            <span className="font-semibold text-gray-700">
              {currentMonth.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </span>
            <button
              type="button"
              onClick={() =>
                setCurrentMonth(
                  new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth() + 1,
                  ),
                )
              }
              className="p-2 hover:bg-gray-100 rounded"
            >
              →
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="text-center text-xs font-semibold text-gray-500 py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`}></div>;
              }

              const isPast = isDatePast(day);
              const isSelected = isDateSelected(day);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={isPast}
                  onClick={() => handleDateSelection(day)}
                  className={`
                    w-8 h-8 text-sm rounded p-1 text-center
                    ${isPast ? "text-gray-300 cursor-not-allowed" : "cursor-pointer hover:bg-blue-100"}
                    ${isSelected ? "bg-blue-500 text-white font-semibold" : "bg-white border border-gray-200 text-gray-700"}
                  `}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={() => setShowCalendar(false)}
            className="w-full mt-4 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-medium"
          >
            Done
          </button>
        </div>
      )}

      {/* Selected Dates as Chips */}
      {customDates.length > 0 && (
        <div className="border border-gray-200 rounded-md p-3">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Selected Dates ({customDates.length}):
          </p>
          <div className="flex flex-wrap gap-2">
            {customDates.map((date, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-800 text-sm rounded-full border border-blue-200"
              >
                <span className="font-medium">
                  {new Date(date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => removeDate(date)}
                  className="text-blue-600 hover:text-blue-800 font-bold text-lg leading-none"
                  title="Remove date"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Validation Error */}
      {errors?.recurrence?.customDates && (
        <p className="text-red-500 text-xs mt-1">
          {errors.recurrence.customDates.message}
        </p>
      )}

      {/* Helper Text */}
      {customDates.length === 0 && (
        <p className="text-xs text-amber-600">
          ⚠️ Please add at least one custom date
        </p>
      )}

      {/* Selected Dates Preview */}
      {selectedDates.length > 0 && (
        <div className="p-2 bg-blue-50 rounded border border-blue-200">
          <p className="text-xs text-blue-800 mb-1">
            Selected for adding: ({selectedDates.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {selectedDates.map((date, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded"
              >
                {new Date(date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
                <button
                  type="button"
                  onClick={() =>
                    setSelectedDates(selectedDates.filter((d) => d !== date))
                  }
                  className="text-blue-600 hover:text-blue-800 font-bold"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Recurrence Panel Component
const RecurrencePanel = ({
  control,
  register,
  watch,
  setValue,
  errors,
  showErrorToast,
  previewDates,
  setPreviewDates,
  summary,
  setSummary,
}) => {
  const watchedPattern = watch("recurrence.patternType");
  const watchedRepeatEvery = watch("recurrence.repeatEvery");
  const watchedStartDate = watch("recurrence.startDate");
  const watchedDueTime = watch("recurrence.dueTime");
  const watchedEndCondition = watch("recurrence.endCondition");
  const watchedWeekdays = watch("recurrence.weekdays");
  const watchedMonthDays = watch("recurrence.monthDays");
  const watchedYearMonths = watch("recurrence.yearMonths");
  const watchedCustomDates = watch("recurrence.customDates");

  // Reset ALL fields when pattern type changes
  useEffect(() => {
    if (watchedPattern?.value) {
      // Reset all recurrence fields when switching patterns
      setValue("recurrence.repeatEvery", 1);
      setValue("recurrence.dueTime", new Date().toTimeString().slice(0, 5));
      setValue("recurrence.weekdays", []);
      setValue("recurrence.monthDays", []);
      setValue("recurrence.yearMonths", null);
      setValue("recurrence.customDates", []);
      setValue("recurrence.specificDate", null);
      setValue("recurrence.monthlyMode", null);
      setValue("recurrence.monthPosition", null);
      setValue("recurrence.monthWeekday", null);
      setValue("recurrence.yearDay", new Date().getDate());
      setValue("recurrence.endCondition", {
        value: "never",
        label: "Never ends",
      });
      setValue("recurrence.occurrences", 1);
      setValue("recurrence.endDate", null);
    }
  }, [watchedPattern?.value, setValue]);

  // Pattern type options
  const patternOptions = [
    { value: "daily", label: "Day" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
    { value: "custom", label: "Custom" },
  ];

  // Weekday options
  const weekdayOptions = [
    { value: "monday", label: "Monday" },
    { value: "tuesday", label: "Tuesday" },
    { value: "wednesday", label: "Wednesday" },
    { value: "thursday", label: "Thursday" },
    { value: "friday", label: "Friday" },
    { value: "saturday", label: "Saturday" },
    { value: "sunday", label: "Sunday" },
  ];

  // Month options
  const monthOptions = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  // End condition options
  const endConditionOptions = [
    { value: "never", label: "Never ends" },
    { value: "after", label: "Ends after 'N' occurrences" },
    { value: "by_date", label: "Ends by Date" },
  ];

  // Generate month day options (1-31)
  const monthDayOptions = Array.from({ length: 31 }, (_, i) => ({
    value: i + 1,
    label: (i + 1).toString(),
  }));

  // Update preview and summary when recurrence settings change
  useEffect(() => {
    // Auto-set start date to today if not already set
    if (!watchedStartDate) {
      setValue("recurrence.startDate", getTodayDate());
    }
    generatePreviewAndSummary();
  }, [
    watchedPattern,
    watchedRepeatEvery,
    watchedStartDate,
    watchedDueTime,
    watchedEndCondition,
    watchedWeekdays,
    watchedMonthDays,
    watchedYearMonths,
    watch("recurrence.monthlyMode"), // ✅ Monthly mode changes
    watch("recurrence.specificDate"), // ✅ Specific date changes
    watch("recurrence.monthPosition"), // ✅ Position changes
    watch("recurrence.monthWeekday"), // ✅ Weekday changes
    watch("recurrence.occurrences"), // ✅ Occurrences changes
    watch("recurrence.endDate"), // ✅ End date changes
    watch("recurrence.customDates"), // ✅ Custom dates changes
  ]);

  const generatePreviewAndSummary = () => {
    if (!watchedPattern || !watchedStartDate) {
      setPreviewDates([]);
      setSummary("");
      return;
    }

    const patternValue = watchedPattern?.value;
    const startDate = new Date(watchedStartDate);
    const repeatEvery = watchedRepeatEvery || 1;
    const time = watchedDueTime || "17:00";
    const dates = [];
    let summaryText = "";

    // ✅ Calculate max preview occurrences based on end condition
    let maxPreviewCount = 5; // Default for "never ends"

    if (watchedEndCondition?.value === "after") {
      const occurrences = watch("recurrence.occurrences");
      if (occurrences && occurrences > 0) {
        maxPreviewCount = Math.min(occurrences, 5); // Show up to 5 but not more than total
      }
    } else if (watchedEndCondition?.value === "by_date") {
      const endDate = watch("recurrence.endDate");
      if (endDate) {
        // We'll still show up to 5, but actual generation will stop at end date
        maxPreviewCount = 5;
      }
    }

    // Helper: Get weekday name
    const getWeekdayName = (date) => {
      return date.toLocaleDateString("en-US", { weekday: "long" });
    };

    // Helper: Check if date matches weekdays filter
    const matchesWeekdays = (date, weekdays) => {
      if (!weekdays) return true;
      const weekdayArray = Array.isArray(weekdays) ? weekdays : [weekdays];
      if (weekdayArray.length === 0) return true;
      const dayName = getWeekdayName(date).toLowerCase();
      return weekdayArray.some((wd) => wd.value === dayName);
    };

    // Helper: Check if date matches month days filter
    const matchesMonthDays = (date, monthDays) => {
      if (!monthDays || monthDays.length === 0) return true;
      const dayOfMonth = date.getDate();
      return monthDays.some((md) => md.value === dayOfMonth);
    };

    // Helper: Check if date exceeds end condition
    const isWithinEndCondition = (date) => {
      if (watchedEndCondition?.value === "by_date") {
        const endDate = watch("recurrence.endDate");
        if (endDate) {
          const endDateObj = new Date(endDate);
          endDateObj.setHours(23, 59, 59, 999);
          return date <= endDateObj;
        }
      }
      return true;
    };

    // Generate preview dates based on pattern
    switch (patternValue) {
      case "daily": {
        let count = 0;
        let i = 0;
        while (count < maxPreviewCount && i < maxPreviewCount * 2) {
          const nextDate = new Date(startDate);
          nextDate.setDate(startDate.getDate() + i * repeatEvery);

          if (isWithinEndCondition(nextDate)) {
            dates.push(
              nextDate.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              }),
            );
            count++;
          }
          i++;
        }

        summaryText =
          repeatEvery === 1
            ? `Daily at ${time}, starting ${startDate.toLocaleDateString(
                "en-US",
                { month: "short", day: "numeric", year: "numeric" },
              )}`
            : `Every ${repeatEvery} days at ${time}, starting ${startDate.toLocaleDateString(
                "en-US",
                { month: "short", day: "numeric", year: "numeric" },
              )}`;
        break;
      }

      case "weekly": {
        const selectedWeekday = watchedWeekdays;
        let count = 0;
        let weekOffset = 0;

        if (!selectedWeekday || !selectedWeekday.value) {
          // Use start date's weekday
          while (count < maxPreviewCount && weekOffset < maxPreviewCount * 2) {
            const nextDate = new Date(startDate);
            nextDate.setDate(
              startDate.getDate() + weekOffset * 7 * repeatEvery,
            );

            if (isWithinEndCondition(nextDate)) {
              dates.push(
                nextDate.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }),
              );
              count++;
            }
            weekOffset++;
          }
        } else if (selectedWeekday && selectedWeekday.value) {
          // Find first occurrence of selected weekday
          let currentDate = new Date(startDate);
          const weekdayMap = {
            sunday: 0,
            monday: 1,
            tuesday: 2,
            wednesday: 3,
            thursday: 4,
            friday: 5,
            saturday: 6,
          };
          const selectedDayValue = (selectedWeekday.value || "").toLowerCase();
          const selectedDayNum = weekdayMap[selectedDayValue];
          const startDayNum = startDate.getDay();

          let daysToAdd = (selectedDayNum - startDayNum + 7) % 7;
          currentDate.setDate(currentDate.getDate() + daysToAdd);

          count = 0;
          let occurrenceIndex = 0;

          while (
            count < maxPreviewCount &&
            occurrenceIndex < maxPreviewCount * 2
          ) {
            const dateToAdd = new Date(currentDate);
            if (isWithinEndCondition(dateToAdd) && dateToAdd >= startDate) {
              dates.push(
                dateToAdd.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }),
              );
              count++;
            }
            occurrenceIndex++;
            currentDate.setDate(currentDate.getDate() + 7 * repeatEvery);
          }
        }

        const weekdayName = selectedWeekday?.label || getWeekdayName(startDate);
        summaryText =
          repeatEvery === 1
            ? `Weekly on ${weekdayName} at ${time}`
            : `Every ${repeatEvery} weeks on ${weekdayName} at ${time}`;
        break;
      }

      case "monthly": {
        const monthlyMode = watch("recurrence.monthlyMode");
        const monthDays = watchedMonthDays || [];
        const specificDate = watch("recurrence.specificDate");
        const monthPosition = watch("recurrence.monthPosition");
        const monthWeekday = watch("recurrence.monthWeekday");

        let count = 0;
        let monthOffset = 0;

        if (monthlyMode === "by_date" && monthDays.length > 0) {
          let currentDate = new Date(startDate);
          let attempts = 0;
          const maxAttempts = maxPreviewCount * 12;

          while (count < maxPreviewCount && attempts < maxAttempts) {
            if (
              matchesMonthDays(currentDate, monthDays) &&
              isWithinEndCondition(currentDate)
            ) {
              dates.push(
                currentDate.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }),
              );
              count++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
            attempts++;
          }

          const dayNumbers = monthDays
            .map((md) => md.value)
            .sort((a, b) => a - b)
            .join(", ");
          summaryText =
            repeatEvery === 1
              ? `Monthly on day(s) ${dayNumbers} at ${time}`
              : `Every ${repeatEvery} months on day(s) ${dayNumbers} at ${time}`;
        } else if (
          monthlyMode === "by_position" &&
          monthPosition &&
          monthWeekday
        ) {
          const getNthWeekdayOfMonth = (year, month, weekday, position) => {
            const weekdayMap = {
              sunday: 0,
              monday: 1,
              tuesday: 2,
              wednesday: 3,
              thursday: 4,
              friday: 5,
              saturday: 6,
            };
            const targetWeekday = weekdayMap[weekday.value.toLowerCase()];
            const firstDay = new Date(year, month, 1);
            const firstWeekday = firstDay.getDay();

            if (position.value === "last") {
              const lastDay = new Date(year, month + 1, 0);
              const lastWeekday = lastDay.getDay();
              let daysToSubtract = (lastWeekday - targetWeekday + 7) % 7;
              return new Date(year, month, lastDay.getDate() - daysToSubtract);
            } else {
              const positionMap = { first: 1, second: 2, third: 3, fourth: 4 };
              const occurrence = positionMap[position.value];
              let daysUntilTarget = (targetWeekday - firstWeekday + 7) % 7;
              let targetDate = 1 + daysUntilTarget + (occurrence - 1) * 7;
              return new Date(year, month, targetDate);
            }
          };

          let currentMonth = startDate.getMonth();
          let currentYear = startDate.getFullYear();
          count = 0;
          let attempts = 0;

          while (count < maxPreviewCount && attempts < maxPreviewCount * 12) {
            const targetDate = getNthWeekdayOfMonth(
              currentYear,
              currentMonth,
              monthWeekday,
              monthPosition,
            );

            if (targetDate >= startDate && isWithinEndCondition(targetDate)) {
              dates.push(
                targetDate.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }),
              );
              count++;
            }

            currentMonth += repeatEvery;
            if (currentMonth > 11) {
              currentYear += Math.floor(currentMonth / 12);
              currentMonth = currentMonth % 12;
            }
            attempts++;
          }

          summaryText =
            repeatEvery === 1
              ? `Monthly on ${monthPosition.label} ${monthWeekday.label} at ${time}`
              : `Every ${repeatEvery} months on ${monthPosition.label} ${monthWeekday.label} at ${time}`;
        } else if (monthlyMode === "specific_date" && specificDate) {
          let monthIndex = 0;
          const startDay = startDate.getDate();

          // If specific date is earlier than start date's day, skip to next month
          if (specificDate < startDay) {
            monthIndex = 1;
          }

          count = 0;

          while (count < maxPreviewCount) {
            const targetMonth =
              startDate.getMonth() + (monthIndex + count * repeatEvery);
            const targetYear =
              startDate.getFullYear() + Math.floor(targetMonth / 12);
            const adjustedMonth = targetMonth % 12;

            const lastDayOfMonth = new Date(
              targetYear,
              adjustedMonth + 1,
              0,
            ).getDate();
            const actualDay = Math.min(specificDate, lastDayOfMonth);
            const nextDate = new Date(targetYear, adjustedMonth, actualDay);

            if (isWithinEndCondition(nextDate)) {
              dates.push(
                nextDate.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }),
              );
              count++;
            } else {
              break;
            }
          }

          summaryText =
            repeatEvery === 1
              ? `Monthly on day ${specificDate} at ${time}`
              : `Every ${repeatEvery} months on day ${specificDate} at ${time}`;
        } else {
          // Default: same day of month
          count = 0;
          while (count < maxPreviewCount) {
            const nextDate = new Date(startDate);
            nextDate.setMonth(startDate.getMonth() + count * repeatEvery);

            if (isWithinEndCondition(nextDate)) {
              dates.push(
                nextDate.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }),
              );
              count++;
            } else {
              break;
            }
          }

          summaryText =
            repeatEvery === 1
              ? `Monthly on day ${startDate.getDate()} at ${time}`
              : `Every ${repeatEvery} months on day ${startDate.getDate()} at ${time}`;
        }
        break;
      }

      case "yearly": {
        const selectedMonth = watchedYearMonths;
        const yearDay = watch("recurrence.yearDay") || 1;

        let count = 0;
        let yearOffset = 0;

        while (count < maxPreviewCount && yearOffset < maxPreviewCount * 2) {
          const nextDate = new Date(startDate);
          nextDate.setFullYear(
            startDate.getFullYear() + yearOffset * repeatEvery,
          );

          if (selectedMonth && selectedMonth.value) {
            nextDate.setMonth(selectedMonth.value - 1);
            nextDate.setDate(yearDay);
          }

          if (nextDate >= startDate && isWithinEndCondition(nextDate)) {
            dates.push(
              nextDate.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              }),
            );
            count++;
          }
          yearOffset++;
        }

        const monthName =
          selectedMonth?.label ||
          startDate.toLocaleDateString("en-US", { month: "long" });
        summaryText =
          repeatEvery === 1
            ? `Yearly on ${monthName} ${yearDay} at ${time}`
            : `Every ${repeatEvery} years on ${monthName} ${yearDay} at ${time}`;
        break;
      }

      case "custom": {
        const customDates = watch("recurrence.customDates") || [];

        // Filter dates based on end condition
        let filteredDates = [...customDates];

        if (watchedEndCondition?.value === "by_date") {
          const endDate = watch("recurrence.endDate");
          if (endDate) {
            const endDateObj = new Date(endDate);
            endDateObj.setHours(23, 59, 59, 999);
            filteredDates = customDates.filter((dateStr) => {
              const dateObj = new Date(dateStr);
              return dateObj <= endDateObj;
            });
          }
        }

        const datesToShow = filteredDates.slice(0, maxPreviewCount);
        datesToShow.forEach((dateStr) => {
          const date = new Date(dateStr);
          dates.push(
            date.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
          );
        });

        summaryText = `Custom schedule on ${filteredDates.length} selected date(s) at ${time}`;
        if (
          watchedEndCondition?.value === "by_date" &&
          watch("recurrence.endDate")
        ) {
          summaryText += `, ends by ${new Date(watch("recurrence.endDate")).toLocaleDateString()}`;
        }
        break;
      }

      default:
        break;
    }

    // Add end condition to summary
    if (watchedEndCondition?.value === "after") {
      const occurrences = watch("recurrence.occurrences");
      summaryText += occurrences
        ? `, ends after ${occurrences} occurrence${occurrences !== 1 ? "s" : ""}`
        : `, ends after 'N' occurrences`;
    } else if (watchedEndCondition?.value === "by_date") {
      const endDate = watch("recurrence.endDate");
      if (endDate) {
        const endDateObj = new Date(endDate);
        summaryText += `, ends by ${endDateObj.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`;
      } else {
        summaryText += `, ends by [select date]`;
      }
    } else {
      summaryText += ", never ends";
    }

    setPreviewDates(dates);
    setSummary(summaryText);
  };

  const getTodayDate = () => {
    // Use local timezone, not UTC to avoid date shifting
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Helper: Get minimum date for calendar pickers based on context
  const getMinDate = (context = "start") => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;

    if (context === "end") {
      // End date must be after start date
      return watchedStartDate || todayStr;
    }

    // Start date cannot be in past
    return todayStr;
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-300 rounded-xl p-3 sm:p-4 space-y-3 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 space-y-2 sm:space-y-0">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="bg-blue-600 p-1 sm:p-2 rounded-sm">
            <span className="text-lg sm:text-2xl">
              <RecurringTaskIcon size={20} className="flex-shrink-0" />
            </span>
          </div>
          <div>
            <h3 className="text-sm sm:text-lg font-bold text-gray-900">
              Recurrence Settings
            </h3>
            <p className="text-xs text-gray-600">
              Configure when and how often this task repeats
            </p>
          </div>
        </div>
        <div className="bg-white px-2 sm:px-3 py-1 rounded-full border border-blue-300 self-start">
          <span className="text-xs font-semibold text-blue-700">
            Recurring Task
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3">
        {/* Pattern Type */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-1">
            Pattern Type <span className="text-red-500">*</span>
          </label>
          <Controller
            name="recurrence.patternType"
            control={control}
            rules={{ required: "Pattern type is required" }}
            render={({ field }) => (
              <Select
                {...field}
                menuPlacement="auto"
                options={patternOptions}
                className="react-select-container h-8-select text-xs sm:text-sm"
                classNamePrefix="react-select"
                placeholder="Select pattern..."
                data-testid="select-pattern-type"
              />
            )}
          />
          {errors.recurrence?.patternType && (
            <p className="text-red-500 text-xs mt-1">
              {errors.recurrence.patternType.message}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1 leading-tight">
            Choose how task repeats: Daily, Weekly, Monthly, Yearly, or Custom
          </p>
        </div>

        {/* Custom Dates Selector - On Same Line as Pattern Type */}
        {watchedPattern?.value === "custom" && (
          <div className="sm:col-span-1 lg:col-span-2">
            <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-1">
              Custom Dates <span className="text-red-500">*</span>
            </label>
            <CustomDatesManager
              control={control}
              register={register}
              watch={watch}
              setValue={setValue}
              errors={errors}
              showErrorToast={showErrorToast}
            />
          </div>
        )}

        {/* Repeat Every - Hide for custom pattern */}
        {/* {watchedPattern?.value !== "custom" && (
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Repeat Every <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center space-x-2">
              <input
                {...register("recurrence.repeatEvery", {
                  required: "Repeat interval is required",
                  min: { value: 1, message: "Must be at least 1" },
                  valueAsNumber: true,
                })}
                type="number"
                min="1"
                className="w-20 h-8 min-h-8 max-h-8 box-border px-3 py-0 text-sm border border-gray-300 rounded-md leading-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="1"
                data-testid="input-repeat-every"
                title="Enter repeat interval (minimum 1)"
              />
              <span className="text-sm text-gray-600 font-medium">
                {(() => {
                  const pattern = watchedPattern?.value;
                  const count = watchedRepeatEvery || 1;

                  if (!pattern) return "period(s)";

                  const patternMap = {
                    daily: count === 1 ? "day (Daily)" : "days",
                    weekly: count === 1 ? "week" : "weeks",
                    monthly: count === 1 ? "month" : "months",
                    yearly: count === 1 ? "year" : "years",
                    custom: "custom period",
                  };

                  return patternMap[pattern] || "period(s)";
                })()}
              </span>
            </div>
            {errors.recurrence?.repeatEvery && (
              <p className="text-red-500 text-xs mt-1">
                {errors.recurrence.repeatEvery.message}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Frequency interval (1 = every period, 2 = every 2 periods, etc.)
            </p>
          </div>
        )} */}
        {/* Pattern-specific controls */}
        {watchedPattern?.value === "weekly" && (
          <div className="sm:col-span-1">
            <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-1">
              Day of Week <span className="text-red-500">*</span>
            </label>
            <Controller
              name="recurrence.weekdays"
              control={control}
              rules={{
                required: "A weekday is required for weekly pattern",
              }}
              render={({ field }) => (
                <Select
                  {...field}
                  menuPlacement="auto"
                  isMulti={false}
                  options={weekdayOptions}
                  className="react-select-container h-8-select text-xs sm:text-sm"
                  classNamePrefix="react-select"
                  placeholder="Select day..."
                  data-testid="select-weekdays"
                />
              )}
            />
            {errors.recurrence?.weekdays && (
              <p className="text-red-500 text-xs mt-1">
                {errors.recurrence.weekdays.message}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1 leading-tight">
              Tasks will only be created on selected day
            </p>
          </div>
        )}
      </div>

      {watchedPattern?.value === "monthly" && (
        <div className="space-y-3 sm:space-y-3 sm:col-span-2 lg:col-span-3">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-2">
              Monthly Mode <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-col space-y-2">
              {/* <label className="flex items-center p-2 border rounded-md hover:bg-blue-50 cursor-pointer">
                <input
                  {...register("recurrence.monthlyMode")}
                  type="radio"
                  value="by_date"
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  data-testid="radio-monthly-by-date"
                />
                <span className="ml-2 text-xs sm:text-sm text-gray-900">By Date(s) - Select specific day numbers</span>
              </label> */}
              <label className="flex items-center p-2 border rounded-md hover:bg-blue-50 cursor-pointer">
                <input
                  {...register("recurrence.monthlyMode")}
                  type="radio"
                  value="by_position"
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  data-testid="radio-monthly-by-position"
                />
                <span className="ml-2 text-xs sm:text-sm text-gray-900">
                  By Position - e.g., "First Monday"
                </span>
              </label>
              <label className="flex items-center p-2 border rounded-md hover:bg-blue-50 cursor-pointer">
                <input
                  {...register("recurrence.monthlyMode")}
                  type="radio"
                  value="specific_date"
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  data-testid="radio-monthly-specific-date"
                />
                <span className="ml-2 text-xs sm:text-sm text-gray-900">
                  Specific Date - Same day each month
                </span>
              </label>
            </div>
          </div>
          By Date(s) mode
          {watch("recurrence.monthlyMode") === "by_date" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Day(s) of Month
              </label>
              <Controller
                name="recurrence.monthDays"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    menuPlacement="auto"
                    isMulti
                    options={monthDayOptions}
                    className="react-select-container h-8-select"
                    classNamePrefix="react-select"
                    placeholder="Select days (1-31)..."
                    data-testid="select-month-days"
                  />
                )}
              />
              <p className="text-xs text-gray-500 mt-1">
                e.g., 2nd and 9th day of month
              </p>
            </div>
          )}
          {/* By Position mode */}
          {watch("recurrence.monthlyMode") === "by_position" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Position
                </label>
                <Controller
                  name="recurrence.monthPosition"
                  control={control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      menuPlacement="auto"
                      options={[
                        { value: "first", label: "First" },
                        { value: "second", label: "Second" },
                        { value: "third", label: "Third" },
                        { value: "fourth", label: "Fourth" },
                        { value: "last", label: "Last" },
                      ]}
                      className="react-select-container h-8-select text-xs sm:text-sm"
                      classNamePrefix="react-select"
                      placeholder="Select position..."
                      data-testid="select-month-position"
                    />
                  )}
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Weekday
                </label>
                <Controller
                  name="recurrence.monthWeekday"
                  control={control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      menuPlacement="auto"
                      options={weekdayOptions}
                      className="react-select-container h-8-select text-xs sm:text-sm"
                      classNamePrefix="react-select"
                      placeholder="Select weekday..."
                      data-testid="select-month-weekday"
                    />
                  )}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1 sm:col-span-2 leading-tight">
                e.g., 2nd Monday of each month
              </p>
            </div>
          )}
          {/* Specific Date mode */}
          {watch("recurrence.monthlyMode") === "specific_date" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Specific Date (Day of Month)
              </label>
              <input
                {...register("recurrence.specificDate", {
                  min: { value: 1, message: "Must be between 1-31" },
                  max: { value: 31, message: "Must be between 1-31" },
                  valueAsNumber: true,
                })}
                type="number"
                min="1"
                max="31"
                className="w-20 h-8 min-h-8 max-h-8 box-border px-3 py-0 border border-gray-300 rounded-md leading-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={new Date().getDate().toString()}
                defaultValue={new Date().getDate()}
                data-testid="input-specific-date"
                style={{
                  height: "32px",
                  minHeight: "32px",
                  maxHeight: "32px",
                  paddingTop: 0,
                  paddingBottom: 0,
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                e.g., every 5th month on the 15th
              </p>
            </div>
          )}
        </div>
      )}

      {watchedPattern?.value === "yearly" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3 sm:col-span-2 lg:col-span-3">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-1">
              Month <span className="text-red-500">*</span>
            </label>
            <Controller
              name="recurrence.yearMonths"
              control={control}
              rules={{
                required: "A month is required for yearly pattern",
              }}
              render={({ field }) => (
                <Select
                  {...field}
                  menuPlacement="auto"
                  isMulti={false}
                  options={monthOptions}
                  className="react-select-container h-8-select text-xs sm:text-sm"
                  classNamePrefix="react-select"
                  placeholder="Select month..."
                  data-testid="select-year-months"
                />
              )}
            />
            {errors.recurrence?.yearMonths && (
              <p className="text-red-500 text-xs mt-1">
                {errors.recurrence.yearMonths.message}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1 leading-tight">
              Task will repeat in the selected month each year
            </p>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Day of Month
            </label>
            <input
              {...register("recurrence.yearDay", {
                min: { value: 1, message: "Must be between 1-31" },
                max: { value: 31, message: "Must be between 1-31" },
                valueAsNumber: true,
              })}
              type="number"
              min="1"
              max="31"
              className="w-16 sm:w-20 h-8 min-h-8 max-h-8 box-border px-2 sm:px-3 py-0 text-xs sm:text-sm border border-gray-300 rounded-md leading-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={new Date().getDate().toString()}
              defaultValue={new Date().getDate()}
              data-testid="input-year-day"
              style={{
                height: "32px",
                minHeight: "32px",
                maxHeight: "32px",
                paddingTop: 0,
                paddingBottom: 0,
              }}
            />
            <p className="text-xs text-gray-500 mt-1 leading-tight">
              Day of the selected month(s). Supports bi-yearly patterns.
            </p>
          </div>
        </div>
      )}

      {/* Due Time and Due Date (replaces Start Time) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-1">
            Due Time <span className="text-red-500">*</span>
          </label>
          <input
            {...register("recurrence.dueTime")}
            type="time"
            className="w-full h-8 min-h-8 max-h-8 box-border px-3 py-0 text-sm border border-gray-300 rounded-md leading-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            defaultValue={new Date().toTimeString().slice(0, 5)}
            data-testid="input-due-time"
            title="Select due time for task occurrences"
            style={{
              height: "32px",
              minHeight: "32px",
              maxHeight: "32px",
              paddingTop: 0,
              paddingBottom: 0,
            }}
          />
          <p className="text-xs text-gray-500 mt-1 leading-tight">
            Time when task instances are due
          </p>
        </div>
        {/* End Condition - Hidden for Custom Pattern */}
        {watchedPattern?.value !== "custom" && (
          <div className="sm:col-span-1 lg:col-span-2">
            <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-1">
              End Condition <span className="text-red-500">*</span>
            </label>
            <Controller
              name="recurrence.endCondition"
              control={control}
              rules={{ required: "End condition is required" }}
              render={({ field }) => (
                <Select
                  {...field}
                  menuPlacement="auto"
                  options={endConditionOptions}
                  className="react-select-container h-8-select text-xs sm:text-sm"
                  classNamePrefix="react-select"
                  placeholder="Select end condition..."
                  data-testid="select-end-condition"
                />
              )}
            />
            {errors.recurrence?.endCondition && (
              <p className="text-red-500 text-xs mt-1">
                {errors.recurrence.endCondition.message}
              </p>
            )}

            {/* Conditional end condition inputs */}
            {watchedEndCondition?.value === "after" && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Occurrences
                </label>
                <input
                  {...register("recurrence.occurrences", {
                    required: "Number of occurrences is required",
                    min: { value: 1, message: "Must be at least 1" },
                    valueAsNumber: true,
                  })}
                  type="number"
                  min="1"
                  className="w-32 h-8 min-h-8 max-h-8 box-border px-3 py-0 border border-gray-300 rounded-md leading-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="1"
                  defaultValue="1"
                  data-testid="input-occurrences"
                  style={{
                    height: "32px",
                    minHeight: "32px",
                    maxHeight: "32px",
                    paddingTop: 0,
                    paddingBottom: 0,
                  }}
                />
                {errors.recurrence?.occurrences && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.recurrence.occurrences.message}
                  </p>
                )}
              </div>
            )}

            {watchedEndCondition?.value === "by_date" && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("recurrence.endDate", {
                    required: "End date is required",
                    validate: (value) => {
                      const startDate = watchedStartDate;
                      if (!startDate) {
                        return "Please select start date first";
                      }
                      return (
                        value > startDate || "End date must be after start date"
                      );
                    },
                  })}
                  type="date"
                  min={getMinDate("end")}
                  className="w-full h-8 min-h-8 max-h-8 box-border px-3 py-0 border border-gray-300 rounded-md leading-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                  data-testid="input-end-date"
                  title={
                    watchedStartDate
                      ? `Select end date (must be after ${new Date(
                          watchedStartDate,
                        ).toLocaleDateString()})`
                      : "Please select start date first"
                  }
                  disabled={!watchedStartDate}
                  style={{
                    height: "32px",
                    minHeight: "32px",
                    maxHeight: "32px",
                    paddingTop: 0,
                    paddingBottom: 0,
                  }}
                />
                {errors.recurrence?.endDate && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.recurrence.endDate.message}
                  </p>
                )}
                {!watchedStartDate && (
                  <p className="text-orange-600 text-xs mt-1">
                    Please select start date first
                  </p>
                )}
                {watchedStartDate && (
                  <p className="text-xs text-gray-500 mt-1">
                    Recurring series will stop after this date
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Enhanced Summary Section */}
      {summary && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-sm p-5 shadow-sm">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg
                className="w-6 h-6 text-blue-600"
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
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center">
                Recurrence Summary
              </h4>
              <p className="text-sm text-gray-800 leading-relaxed font-medium">
                {summary}
              </p>

              {/* Additional Info */}
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="flex items-center space-x-2 bg-white bg-opacity-50 rounded px-2 py-1">
                  <span className="text-gray-600">Pattern:</span>
                  <span className="font-semibold text-blue-700 capitalize">
                    {watchedPattern?.label || "Not set"}
                  </span>
                </div>
                <div className="flex items-center space-x-2 bg-white bg-opacity-50 rounded px-2 py-1">
                  <span className="text-gray-600">Frequency:</span>
                  <span className="font-semibold text-blue-700">
                    Every {watchedRepeatEvery || 1}{" "}
                    {(() => {
                      const pattern = watchedPattern?.value;
                      const count = watchedRepeatEvery || 1;

                      if (!pattern) return "period";

                      const patternMap = {
                        daily: count === 1 ? "day" : "days",
                        weekly: count === 1 ? "week" : "weeks",
                        monthly: count === 1 ? "month" : "months",
                        yearly: count === 1 ? "year" : "years",
                        custom: "custom date(s)",
                      };

                      return patternMap[pattern] || "period";
                    })()}
                  </span>
                </div>
                <div className="flex items-center space-x-2 bg-white bg-opacity-50 rounded px-2 py-1">
                  <span className="text-gray-600">Start:</span>
                  <span className="font-semibold text-green-700">
                    {watchedStartDate
                      ? new Date(watchedStartDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Today"}
                  </span>
                </div>
                <div className="flex items-center space-x-2 bg-white bg-opacity-50 rounded px-2 py-1">
                  <span className="text-gray-600">Due Time:</span>
                  <span className="font-semibold text-green-700">
                    {watchedDueTime || "17:00"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Preview Section */}
      {previewDates.length > 0 && (
        <div className="bg-white border-2 border-gray-300 rounded-sm p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-gray-900 flex items-center space-x-2">
              <svg
                className="w-5 h-5 text-indigo-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span>Next 5 Occurrences</span>
            </h4>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              Preview
            </span>
          </div>

          <div className="space-y-1">
            {previewDates.map((date, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-2 rounded-md transition-all duration-200 hover:shadow-md ${
                  index === 0
                    ? "bg-gradient-to-r from-blue-100 to-indigo-100 border-2 border-blue-400"
                    : "bg-gray-50 border border-gray-300"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`flex items-center justify-center w-6 h-6 rounded-full ${
                      index === 0
                        ? "bg-blue-600 text-white"
                        : "bg-gray-400 text-white"
                    } font-bold text-sm`}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        index === 0 ? "text-blue-900" : "text-gray-900"
                      }`}
                    >
                      {date}
                      {index === 0 && (
                        <span className="text-xs text-blue-700 font-medium">
                          {" "}
                          (First occurrence)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      index === 0
                        ? "bg-blue-600 text-white"
                        : "bg-gray-300 text-gray-700"
                    }`}
                  >
                    {watchedDueTime || "17:00"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Pattern-specific info */}
          {watchedPattern?.value === "weekly" && watchedWeekdays && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-xs text-blue-800">
                <strong>Note:</strong> Tasks will repeat only on{" "}
                {watchedWeekdays.label}
              </p>
            </div>
          )}

          {watchedPattern?.value === "monthly" && (
            <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-md">
              <p className="text-xs text-purple-800">
                <strong>Note:</strong>{" "}
                {watch("recurrence.monthlyMode") === "by_date"
                  ? watchedMonthDays && watchedMonthDays.length > 0
                    ? `Tasks will repeat on specific day(s): ${watchedMonthDays
                        .map((md) => md.value)
                        .join(", ")}`
                    : "Please select day(s) of month"
                  : watch("recurrence.monthlyMode") === "by_position"
                    ? watch("recurrence.monthPosition") &&
                      watch("recurrence.monthWeekday")
                      ? `Tasks will repeat on ${watch("recurrence.monthPosition")?.label || "selected"} ${watch("recurrence.monthWeekday")?.label || "weekday"} of each month`
                      : "Please select position and weekday"
                    : watch("recurrence.specificDate")
                      ? `Tasks will repeat on day ${watch(
                          "recurrence.specificDate",
                        )} of each month`
                      : "Please select a specific date"}
              </p>
            </div>
          )}

          {watchedPattern?.value === "yearly" && watchedYearMonths && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-xs text-green-800">
                <strong>Note:</strong> Tasks will repeat every year in{" "}
                {watchedYearMonths.label}
                {watch("recurrence.yearDay") &&
                !isNaN(watch("recurrence.yearDay"))
                  ? ` on day ${watch("recurrence.yearDay")}`
                  : " (please select a day)"}
              </p>
            </div>
          )}

          {watchedPattern?.value === "custom" && (
            <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-md">
              <p className="text-xs text-indigo-800">
                <strong>Note:</strong>{" "}
                {watchedCustomDates && watchedCustomDates.length > 0
                  ? `Tasks will occur on ${watchedCustomDates.length} custom selected date(s)`
                  : "Please add custom dates above"}
              </p>
            </div>
          )}

          {watchedEndCondition?.value === "after" && (
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-md">
              <p className="text-xs text-orange-800">
                <strong>End Condition:</strong> Series will end after{" "}
                {watch("recurrence.occurrences") || "N"} occurrences
              </p>
            </div>
          )}

          {watchedEndCondition?.value === "by_date" &&
            watch("recurrence.endDate") && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-xs text-red-800">
                  <strong>End Condition:</strong> Series will end on{" "}
                  {new Date(watch("recurrence.endDate")).toLocaleDateString(
                    "en-US",
                    { month: "long", day: "numeric", year: "numeric" },
                  )}
                </p>
              </div>
            )}
        </div>
      )}
    </div>
  );
};

// Main Recurring Task Form Component
export const RecurringTaskForm = ({
  onSubmit,
  onCancel,
  isOrgUser = false,
  defaultValues = {},
  collaboratorOptions = [],
  isLoadingCollaborators = false,
  drawer = false,
  userRole = "employee", // New prop: User's current role
  assignmentScope = "self-only", // New prop: Assignment scope from parent
  isSubmitting = false,
}) => {
  const { showSuccessToast, showErrorToast } = useShowToast();
  const { data: taskPriorities = [] } = useTaskPriorities();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      taskName: "",
      description: "",
      assignedTo: isOrgUser ? null : { value: "self", label: "Self" },
      priority: { value: "medium", label: "Medium" }, // Will be updated by useEffect
      visibility: "private",
      tags: [],
      attachments: [],
      contributors: [], // 🔄 Initialize contributors array for PRD 4.3
      recurrence: {
        patternType: null,
        repeatEvery: 1,
        startDate: getLocalTodayDate(), // Auto-set to today (using local timezone)
        dueTime: getLocalCurrentTime(), // Default to current time (using local timezone)
        endCondition: { value: "never", label: "Never ends" },
        weekdays: [],
        monthDays: [],
        yearMonths: null, // Single month object (not array)
        occurrences: 1, // Default to 1
        endDate: "",
        customDates: [], // Array for multiple custom dates
      },
      ...defaultValues,
    },
  });

  const [taskNameLength, setTaskNameLength] = useState(0);
  const [attachmentSize, setAttachmentSize] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [previewDates, setPreviewDates] = useState([]);
  const [summary, setSummary] = useState("");
  const attachmentsInputRef = useRef(null);

  // Set default priority when taskPriorities loads
  useEffect(() => {
    if (
      taskPriorities &&
      taskPriorities.length > 0 &&
      !defaultValues.priority
    ) {
      const priorityOptions = taskPriorities
        .filter((p) => p && p.active)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((p) => ({ value: p.code, label: p.label }));
      const defaultCode = getDefaultPriorityCode(taskPriorities);
      const defaultOption = priorityOptions.find(
        (p) => p.value === defaultCode,
      ) ||
        priorityOptions[0] || { value: "medium", label: "Medium" };
      setValue("priority", defaultOption);
    }
  }, [taskPriorities, setValue, defaultValues.priority]);

  // 🔐 Check if user can assign to others (Phase I restriction check)
  const canUserAssignToOthers = canAssignToOthers(userRole);
  const isPhaseIRestricted =
    ["company-user", "employee", "user", "normal-user"].includes(userRole) &&
    !canUserAssignToOthers;

  console.log("🔐 RECURRING FORM PERMISSIONS DEBUG - User Role:", userRole);
  console.log(
    "🔐 RECURRING FORM PERMISSIONS DEBUG - Can Assign to Others:",
    canUserAssignToOthers,
  );
  console.log(
    "🔐 RECURRING FORM PERMISSIONS DEBUG - Is Phase I Restricted:",
    isPhaseIRestricted,
  );
  console.log(
    "🔐 RECURRING FORM PERMISSIONS DEBUG - Assignment Scope:",
    assignmentScope,
  );

  const watchedTaskName = watch("taskName");
  const watchedStartDate = watch("recurrence.startDate");
  const watchedPriority = watch("priority");

  const priorityOptions = useMemo(() => {
    const dynamic = (Array.isArray(taskPriorities) ? taskPriorities : [])
      .filter((p) => p && p.active)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((p) => ({ value: p.code, label: p.label }));

    return dynamic.length
      ? dynamic
      : [
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" },
          { value: "critical", label: "Critical" },
        ];
  }, [taskPriorities]);

  // Character counter for task name
  useEffect(() => {
    setTaskNameLength(watchedTaskName?.length || 0);
  }, [watchedTaskName]);

  // Auto-set due date based on priority
  useEffect(() => {
    if (watchedPriority?.value && watchedStartDate) {
      const startDate = new Date(watchedStartDate);
      const code = String(watchedPriority.value || "").toLowerCase();
      const cfg = (Array.isArray(taskPriorities) ? taskPriorities : []).find(
        (p) => p && p.code === code,
      );
      const daysToAdd = Number.isFinite(Number(cfg?.daysToDue))
        ? Number(cfg.daysToDue)
        : code === "critical"
          ? 2
          : code === "high"
            ? 7
            : code === "low"
              ? 30
              : 14;

      const dueDate = new Date(startDate);
      dueDate.setDate(startDate.getDate() + daysToAdd);

      // Update the end date in recurrence pattern
      setValue("recurrence.endDate", dueDate.toISOString().split("T")[0]);
    }
  }, [watchedPriority, watchedStartDate, setValue, taskPriorities]);

  // Assignment options (for org users)
  const assignmentOptions = isOrgUser
    ? [{ value: "self", label: "Self" }, ...collaboratorOptions]
    : [{ value: "self", label: "Self" }];

  // Debug logging
  console.log("RecurringTaskForm - Assignment Debug:", {
    isOrgUser,
    collaboratorOptionsCount: collaboratorOptions.length,
    collaboratorOptions,
    assignmentOptions,
    isLoadingCollaborators,
  });

  // Shared attachment processing for file picker + drag/drop
  const processFiles = (files) => {
    if (!files || files.length === 0) return;
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const currentSize = uploadedFiles.reduce((sum, file) => sum + file.size, 0);

    if (currentSize + totalSize > 5 * 1024 * 1024) {
      // 5MB limit
      showErrorToast("Total file size cannot exceed 5MB");
      return;
    }

    const newFiles = files.map((file) => ({
      file,
      name: file.name,
      size: file.size,
      id: Math.random().toString(36).substr(2, 9),
    }));

    setUploadedFiles((prev) => [...prev, ...newFiles]);
    setAttachmentSize(currentSize + totalSize);
  };

  // File upload handler (input picker)
  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files || []);
    processFiles(files);
    event.target.value = "";
  };

  // Drag/drop handlers
  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragActive(false);
    const files = Array.from(event.dataTransfer?.files || []);
    processFiles(files);
  };

  // Remove file
  const removeFile = (fileId) => {
    setUploadedFiles((prev) => {
      const updated = prev.filter((f) => f.id !== fileId);
      const newSize = updated.reduce((sum, file) => sum + file.file.size, 0);
      setAttachmentSize(newSize);
      return updated;
    });
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Quill editor configuration (handled by CustomEditor component)

  // Helper: Get today's date in YYYY-MM-DD format (using local timezone)
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // ✅ Calculate first occurrence date from recurrence pattern
  const calculateFirstOccurrence = (recurrence) => {
    if (!recurrence || !recurrence.startDate) {
      return null;
    }

    const startDate = new Date(recurrence.startDate);
    const patternType = recurrence.patternType?.value || recurrence.patternType;
    const repeatEvery = parseInt(recurrence.repeatEvery) || 1;

    switch (patternType) {
      case "daily":
        // First occurrence = start date
        return startDate;

      case "weekly":
        // Find first weekday occurrence >= start date
        const weekday = recurrence.weekdays;
        if (!weekday) return startDate;

        const weekdayMap = {
          sunday: 0,
          monday: 1,
          tuesday: 2,
          wednesday: 3,
          thursday: 4,
          friday: 5,
          saturday: 6,
        };
        const selectedDay = weekdayMap[weekday.value.toLowerCase()];

        let currentDate = new Date(startDate);
        let found = false;
        for (let i = 0; i < 7 && !found; i++) {
          if (currentDate.getDay() === selectedDay) {
            return currentDate;
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
        return startDate;

      case "monthly":
        const monthlyMode = recurrence.monthlyMode;

        if (monthlyMode === "by_date") {
          const monthDays = recurrence.monthDays || [];
          if (monthDays.length === 0) return startDate;

          const days = monthDays.map((md) => md.value).sort((a, b) => a - b);
          const currentDay = startDate.getDate();

          // Find first day >= current day in this month or next month
          const nextDay = days.find((d) => d >= currentDay);
          if (nextDay) {
            const firstDate = new Date(startDate);
            firstDate.setDate(nextDay);
            return firstDate;
          } else {
            // Next month's first day
            const nextMonth = new Date(startDate);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            nextMonth.setDate(days[0]);
            return nextMonth;
          }
        } else if (monthlyMode === "by_position") {
          const monthPosition = recurrence.monthPosition;
          const monthWeekday = recurrence.monthWeekday;
          if (!monthPosition || !monthWeekday) return startDate;

          // Calculate Nth weekday of current/next month
          const getNthWeekdayOfMonth = (year, month, weekday, position) => {
            const weekdayMap = {
              sunday: 0,
              monday: 1,
              tuesday: 2,
              wednesday: 3,
              thursday: 4,
              friday: 5,
              saturday: 6,
            };
            const targetWeekday = weekdayMap[weekday.value.toLowerCase()];
            const firstDay = new Date(year, month, 1);
            const firstWeekday = firstDay.getDay();

            if (position.value === "last") {
              const lastDay = new Date(year, month + 1, 0);
              const lastWeekday = lastDay.getDay();
              let daysToSubtract = (lastWeekday - targetWeekday + 7) % 7;
              return new Date(year, month, lastDay.getDate() - daysToSubtract);
            } else {
              const positionMap = { first: 1, second: 2, third: 3, fourth: 4 };
              const occurrence = positionMap[position.value];
              let daysUntilTarget = (targetWeekday - firstWeekday + 7) % 7;
              let targetDate = 1 + daysUntilTarget + (occurrence - 1) * 7;
              return new Date(year, month, targetDate);
            }
          };

          const firstOccurrence = getNthWeekdayOfMonth(
            startDate.getFullYear(),
            startDate.getMonth(),
            monthWeekday,
            monthPosition,
          );

          if (firstOccurrence >= startDate) {
            return firstOccurrence;
          } else {
            // Try next month
            return getNthWeekdayOfMonth(
              startDate.getFullYear(),
              startDate.getMonth() + 1,
              monthWeekday,
              monthPosition,
            );
          }
        } else if (monthlyMode === "specific_date") {
          const specificDate = parseInt(recurrence.specificDate);
          if (!specificDate) return startDate;

          const currentDay = startDate.getDate();
          let targetMonth = startDate.getMonth();
          let targetYear = startDate.getFullYear();

          // If specific date has already passed this month, move to next month
          if (specificDate < currentDay) {
            targetMonth += 1;
            if (targetMonth > 11) {
              targetYear += 1;
              targetMonth = 0;
            }
          }

          // Get the last day of the target month
          const lastDayOfMonth = new Date(
            targetYear,
            targetMonth + 1,
            0,
          ).getDate();

          // Use the minimum of specificDate and lastDayOfMonth to handle months with fewer days
          const actualDay = Math.min(specificDate, lastDayOfMonth);

          return new Date(targetYear, targetMonth, actualDay);
        }
        return startDate;

      case "yearly":
        const yearMonths = recurrence.yearMonths || [];
        const yearDay = parseInt(recurrence.yearDay) || 1;

        if (yearMonths.length === 0) return startDate;

        // Find first future month occurrence
        const monthValues = yearMonths
          .map((m) => m.value)
          .sort((a, b) => a - b);
        const currentMonth = startDate.getMonth() + 1;

        // Try to find month in current year
        const nextMonth = monthValues.find((m) => m >= currentMonth);
        if (nextMonth) {
          const firstDate = new Date(
            startDate.getFullYear(),
            nextMonth - 1,
            yearDay,
          );
          if (firstDate >= startDate) {
            return firstDate;
          }
        }

        // Next year's first month
        return new Date(
          startDate.getFullYear() + 1,
          monthValues[0] - 1,
          yearDay,
        );

      default:
        return startDate;
    }
  };

  const onFormSubmit = (data) => {
    console.log("🔍 RECURRING FORM DEBUG - Form submission started");
    console.log("🔍 RECURRING FORM DEBUG - Raw form data:", data);
    console.log("🔍 RECURRING FORM DEBUG - Priority value:", data.priority);
    console.log(
      "🔍 RECURRING FORM DEBUG - Priority type:",
      typeof data.priority,
    );
    console.log(
      "🔍 RECURRING FORM DEBUG - Contributors in raw data:",
      data.contributors,
    );
    console.log("🔍 RECURRING FORM DEBUG - Recurrence data:", data.recurrence);

    // ✅ Auto-set start date to today if not present
    const todayDate = getTodayDate();
    if (!data.recurrence?.startDate) {
      data.recurrence.startDate = todayDate;
    }

    console.log(
      "🔍 RECURRING FORM DEBUG - Start date (auto-set to today if missing):",
      data.recurrence?.startDate,
    );
    console.log(
      "🔍 RECURRING FORM DEBUG - Pattern type:",
      data.recurrence?.patternType?.value,
    );

    // ✅ Use actual preview dates for dueDate and nextDueDate (not calculated dates)
    // The previewDates are the actual occurrence dates from the pattern
    let dueDate = data.recurrence?.startDate;
    let nextDueDate = data.recurrence?.startDate;

    console.log("🔍 RECURRING FORM DEBUG - Preview dates array:", previewDates);
    console.log(
      "🔍 RECURRING FORM DEBUG - Preview dates length:",
      previewDates?.length,
    );

    // Helper function to convert formatted date string to YYYY-MM-DD (handling timezone correctly)
    const parsePreviewDateToYYYYMMDD = (dateStr) => {
      try {
        const dateObj = new Date(dateStr);
        if (isNaN(dateObj.getTime())) {
          console.error("🔍 RECURRING FORM DEBUG - Invalid date:", dateStr);
          return null;
        }

        // Use local date components instead of ISO string to avoid timezone conversion
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, "0");
        const day = String(dateObj.getDate()).padStart(2, "0");
        const formattedDate = `${year}-${month}-${day}`;

        console.log("🔍 RECURRING FORM DEBUG - Date conversion:", {
          input: dateStr,
          parsed: dateObj.toString(),
          output: formattedDate,
          year,
          month,
          day,
        });

        return formattedDate;
      } catch (e) {
        console.error("🔍 RECURRING FORM DEBUG - Error parsing date:", e);
        return null;
      }
    };

    if (previewDates && previewDates.length > 0) {
      // Preview dates are formatted strings like "Wed, Jan 23, 2026"
      // We need to parse them properly WITHOUT timezone conversion
      const firstPreviewDate = previewDates[0];
      console.log(
        "🔍 RECURRING FORM DEBUG - First preview date (raw):",
        firstPreviewDate,
      );

      const parsedDueDate = parsePreviewDateToYYYYMMDD(firstPreviewDate);
      if (parsedDueDate) {
        dueDate = parsedDueDate;
        console.log(
          "🔍 RECURRING FORM DEBUG - Using first preview date as dueDate:",
          dueDate,
        );
      }

      // Set nextDueDate if we have at least 2 preview dates
      if (previewDates.length > 1) {
        const secondPreviewDate = previewDates[1];
        console.log(
          "🔍 RECURRING FORM DEBUG - Second preview date (raw):",
          secondPreviewDate,
        );

        const parsedNextDueDate = parsePreviewDateToYYYYMMDD(secondPreviewDate);
        if (parsedNextDueDate) {
          nextDueDate = parsedNextDueDate;
          console.log(
            "🔍 RECURRING FORM DEBUG - Using second preview date as nextDueDate:",
            nextDueDate,
          );
        }
      }
    } else {
      console.warn(
        "🔍 RECURRING FORM DEBUG - No preview dates available, using start date as fallback",
      );
    }

    // Combine task and recurrence data
    const formData = {
      ...data,
      attachments: uploadedFiles,
      taskType: "recurring",
      dueDate: dueDate,
      nextDueDate: nextDueDate,
    };

    console.log(
      "🔍 RECURRING FORM DEBUG - Final form data being sent:",
      JSON.stringify(formData, null, 2),
    );
    console.log(
      "🔍 RECURRING FORM DEBUG - Final recurrence in formData:",
      formData.recurrence,
    );
    console.log("🔍 RECURRING FORM DEBUG - Due date set to:", formData.dueDate);
    console.log(
      "🔍 RECURRING FORM DEBUG - Next due date set to:",
      formData.nextDueDate,
    );
    console.log(
      "🔍 RECURRING FORM DEBUG - Final start date:",
      formData.recurrence?.startDate,
    );

    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-3">
      {/* Task Name */}
      <div>
        <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-1">
          Task Name <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            {...register("taskName", {
              required: "Task name is required",
              maxLength: {
                value: 100,
                message: "Task name cannot exceed 100 characters",
              },
            })}
            type="text"
            maxLength={100}
            className="w-full h-8 min-h-8 max-h-8 box-border px-3 pr-12 py-0 text-sm border border-gray-300 rounded-md leading-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            placeholder="Enter task name..."
            data-testid="input-task-name"
            style={{
              height: "32px",
              minHeight: "32px",
              maxHeight: "32px",
              paddingTop: 0,
              paddingBottom: 0,
            }}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
            {taskNameLength}/100
          </div>
        </div>
        {errors.taskName && (
          <p className="text-red-500 text-xs mt-1">{errors.taskName.message}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Description
        </label>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <CustomEditor
              value={field.value}
              onChange={field.onChange}
              className="recurring-task-compact-editor border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="Describe your recurring task..."
            />
          )}
        />
      </div>
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2"
          } gap-3 sm:gap-3`}
      >
        {/* Assigned To - Single assignee only for recurring tasks */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-1">
            Assigned To <span className="text-red-500">*</span>
          </label>

          <Controller
            name="assignedTo"
            control={control}
            rules={
              isOrgUser && canUserAssignToOthers
                ? { required: "Assignment is required" }
                : {}
            }
            render={({ field }) => (
              <AssigneeSearchSelect
                {...field}
                className="react-select-container h-8-select whitespace-nowrap"
                isDisabled={!isOrgUser || !canUserAssignToOthers}
                placeholder={
                  isOrgUser && canUserAssignToOthers
                    ? "Search and select assignee..."
                    : "Self"
                }
                required={isOrgUser && canUserAssignToOthers}
                data-testid="select-assigned-to"
              />
            )}
          />
          {errors.assignedTo && (
            <p className="text-red-500 text-xs mt-1">
              {errors.assignedTo.message}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            {isOrgUser && canUserAssignToOthers
              ? "Search by name, email, department, or designation"
              : "Recurring tasks can only have one assignee (Self only)"}
          </p>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-1">
            Priority <span className="text-red-500">*</span>
          </label>
          <Controller
            name="priority"
            control={control}
            rules={{ required: "Priority is required" }}
            render={({ field }) => (
              <Select
                {...field}
                menuPlacement="auto"
                options={priorityOptions}
                className="react-select-container h-8-select text-xs sm:text-sm"
                classNamePrefix="react-select"
                placeholder="Select priority..."
                data-testid="select-priority"
              />
            )}
          />
          {errors.priority && (
            <p className="text-red-500 text-xs mt-1">
              {errors.priority.message}
            </p>
          )}
        </div>

        {/* Contributors - Only for org users (NOT for individual users), but show for employees */}
        {(userRole !== "individual" || userRole === "employee") && (
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-1">
              Contributors
            </label>
            <Controller
              name="contributors"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  menuPlacement="auto"
                  isMulti
                  options={collaboratorOptions}
                  isLoading={isLoadingCollaborators}
                  className="react-select-container h-8-select text-xs sm:text-sm"
                  classNamePrefix="react-select"
                  placeholder={
                    isLoadingCollaborators
                      ? "Loading contributors..."
                      : "Select contributors"
                  }
                  data-testid="select-contributors"
                />
              )}
            />
            <p className="text-xs text-gray-500 mt-1 leading-tight">
              Contributors will receive notifications and can view/comment on
              the task
            </p>
          </div>
        )}

        {/* Tags */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-1">
            Labels / Tags
          </label>
          <Controller
            name="tags"
            control={control}
            render={({ field }) => {
              const [tagInput, setTagInput] = React.useState("");
              const tags = field.value || [];

              const addTag = () => {
                const trimmed = String(tagInput).trim();
                if (trimmed && !tags.includes(trimmed)) {
                  field.onChange([...tags, trimmed]);
                }
                setTagInput("");
              };

              const removeTag = (t) => {
                field.onChange(tags.filter((tag) => tag !== t));
              };

              const handleKeyDown = (e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag();
                }
              };

              return (
                <div>
                  <div className="relative">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type tag and press Enter or comma..."
                      className="w-full h-8 min-h-8 max-h-8 box-border px-3 pr-10 py-0 border border-gray-300 rounded-md text-sm leading-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      data-testid="input-tag-text"
                      style={{
                        height: "32px",
                        minHeight: "32px",
                        maxHeight: "32px",
                        paddingTop: 0,
                        paddingBottom: 0,
                      }}
                    />
                    <Button
                      type="button"
                      onClick={addTag}
                      variant="primary"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                      data-testid="button-add-tag"
                      title="Add tag"
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
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    </Button>
                  </div>

                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                      {tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                        >
                          {tag}
                          <Button
                            type="button"
                            onClick={() => removeTag(tag)}
                            variant="ghost"
                            size="icon"
                            className="ml-1 text-red-500 hover:text-red-700 h-4 w-4 p-0"
                            aria-label={`Remove tag ${tag}`}
                          >
                            ×
                          </Button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            }}
          />
        </div>
      </div>

      {/* Visibility */}
      <div>
        <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-1">
          Visibility <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
          <label className="flex items-center">
            <input
              {...register("visibility")}
              type="radio"
              value="private"
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              data-testid="radio-private"
            />
            <span className="ml-2 text-xs sm:text-sm text-gray-900">
              Private
            </span>
          </label>
          {isOrgUser && (
            <label className="flex items-center">
              <input
                {...register("visibility")}
                type="radio"
                value="public"
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                data-testid="radio-public"
              />
              <span className="ml-2 text-xs sm:text-sm text-gray-900">
                Public
              </span>
            </label>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {isOrgUser
            ? "Private: Only you and assignee can view. Public: All users can view."
            : "Private: Only you and assignee can view."}
        </p>
      </div>

      {/* Notes / Instructions - Simple textarea for all users (max 100 words) */}
      <div>
        <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-1">
          Additional Notes
        </label>
        <Controller
          name="notes"
          control={control}
          render={({ field }) => {
            const wordCount = field.value
              ? field.value.trim().split(/\s+/).length
              : 0;
            const maxWords = 100;

            const handleChange = (e) => {
              const text = e.target.value;
              const words =
                text.trim() === "" ? 0 : text.trim().split(/\s+/).length;

              // Only allow if within word limit
              if (words <= maxWords) {
                field.onChange(text);
              }
            };

            return (
              <div>
                <textarea
                  value={field.value || ""}
                  onChange={handleChange}
                  placeholder="Add short notes or instructions (max 100 words)..."
                  className="w-full h-20 px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                  data-testid="input-notes"
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-500">
                    Short notes for context
                  </p>
                  <span
                    className={`text-xs font-medium ${wordCount > maxWords ? "text-red-600" : "text-gray-500"}`}
                  >
                    {wordCount}/{maxWords} words
                  </span>
                </div>
              </div>
            );
          }}
        />
      </div>

      {/* Attachments */}
      <div>
        <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-1">
          Attachments
          <span className="text-xs text-gray-500 ml-2">(Max 5MB total)</span>
        </label>
        <div
          className={`w-full border-2 border-dashed p-4 text-center cursor-pointer transition-colors rounded-md ${isDragActive ? "border-blue-500 bg-blue-50" : "border-blue-300 bg-white"}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => attachmentsInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              attachmentsInputRef.current?.click();
            }
          }}
          data-testid="dropzone-attachments"
        >
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center bg-blue-100 text-blue-600 rounded-md">
            +
          </div>
          <p className="text-sm font-semibold text-blue-600">
            Drag & Drop files
          </p>
          <p className="text-xs text-gray-500">PDF, DOC, images supported</p>
        </div>
        <input
          ref={attachmentsInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
          onChange={handleFileUpload}
          className="hidden"
          data-testid="input-attachments"
        />

        {/* File List */}
        {uploadedFiles.length > 0 && (
          <div className="mt-3 space-y-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between bg-gray-50 px-2 rounded"
              >
                <div className="flex items-center space-x-2">
                  <svg
                    className="w-4 h-4 text-gray-500"
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
                  <span className="text-sm text-gray-700">{file.name}</span>
                  <span className="text-xs text-gray-500">
                    ({formatFileSize(file.size)})
                  </span>
                </div>
                <Button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  variant="ghost"
                  size="icon"
                  className="text-red-500 hover:text-red-700"
                  data-testid={`remove-file-${file.id}`}
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </Button>
              </div>
            ))}
            <div className="text-xs text-gray-500">
              Total size: {formatFileSize(attachmentSize)} / 5MB
            </div>
          </div>
        )}
      </div>

      {/* Recurrence Panel */}
      <RecurrencePanel
        control={control}
        register={register}
        watch={watch}
        setValue={setValue}
        errors={errors}
        showErrorToast={showErrorToast}
        previewDates={previewDates}
        setPreviewDates={setPreviewDates}
        summary={summary}
        setSummary={setSummary}
      />

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:gap-3 pt-6">
        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting}
          className="bg-blue-600 hover:bg-blue-700 text-white h-8 rounded-sm"
          data-testid="button-save"
        >
          {isSubmitting ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Saving...
            </>
          ) : (
            "Save Recurring Task"
          )}
        </Button>
      </div>
    </form>
  );
};

export default RecurringTaskForm;
