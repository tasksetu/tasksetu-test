import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function CalendarDatePicker({
  onClose,
  onDateSelect,
  taskType,
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const handleDateClick = (date) => {
    if (date && date >= new Date().setHours(0, 0, 0, 0)) {
      setSelectedDate(date);
    }
  };

  const handleConfirmDate = () => {
    if (selectedDate) {
      const dateStr = selectedDate.toISOString().split("T")[0];
      onDateSelect(dateStr);
    }
  };

  const getTaskTypeInfo = (type) => {
    const types = {
      regular: { icon: "📋", label: "Simple Task", color: "blue" },
      recurring: { icon: "🔄", label: "Recurring Task", color: "purple" },
      milestone: { icon: "🎯", label: "Milestone", color: "red" },
      approval: { icon: "✅", label: "Approval Task", color: "green" },
    };
    return types[type] || types.regular;
  };

  const typeInfo = getTaskTypeInfo(taskType);
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overlay-animate">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full modal-animate-slide-up">
        {/* Header */}
        <div
          className={`p-4 border-b border-gray-200 bg-gradient-to-r from-${typeInfo.color}-500 to-${typeInfo.color}-600 text-white rounded-t-2xl`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{typeInfo.icon}</span>
              <div>
                <h3 className="text-lg font-semibold">Select Date</h3>
                <p className="text-sm opacity-90">
                  Choose a date for your{typeInfo.label.toLowerCase()}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg
                className="w-6 h-6"
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
        </div>

        {/* Calendar */}
        <div className="p-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateMonth(-1)}
              className="p-2 hover:bg-gray-100 rounded-sm transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Button>

            <h4 className="text-lg font-semibold text-gray-900">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h4>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateMonth(1)}
              className="p-2 hover:bg-gray-100 rounded-sm transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-gray-500 py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1 mb-3">
            {getDaysInMonth(currentDate).map((date, index) => {
              const isToday =
                date && date.toDateString() === new Date().toDateString();
              const isSelected =
                selectedDate &&
                date &&
                date.toDateString() === selectedDate.toDateString();
              const isPast = date && date < new Date().setHours(0, 0, 0, 0);
              const isSelectable = date && !isPast;

              return (
                <button
                  key={index}
                  onClick={() => handleDateClick(date)}
                  disabled={!isSelectable}
                  className={`
                      h-10 text-sm rounded-sm transition-all duration-200
                      ${!date ? "invisible" : ""}
                      ${isPast ? "text-gray-300 cursor-not-allowed" : ""}
                      ${isSelectable && !isSelected && !isToday ? "text-gray-900 hover:bg-gray-100" : ""}
                      ${isToday && !isSelected ? "bg-blue-100 text-blue-800 font-medium" : ""}
                      ${isSelected ? `bg-${typeInfo.color}-500 text-white font-medium shadow-lg` : ""}
                      ${isSelectable ? "cursor-pointer" : ""}
                    `}
                >
                  {date && date.getDate()}
                </button>
              );
            })}
          </div>

          {selectedDate && (
            <div className="mb-3 p-3 bg-gray-50 rounded-sm">
              <div className="text-sm text-gray-600">Selected Date:</div>
              <div className="font-medium text-gray-900">
                {selectedDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-9" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1 h-9"
              onClick={handleConfirmDate}
              disabled={!selectedDate}
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
