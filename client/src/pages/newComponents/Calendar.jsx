import React, { useState, useEffect } from "react";
import CreateTask from "./CreateTask";
import { Button } from "@/components/ui/button";

export default function Calendar({ onClose }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month"); // month, week, day
  const [recurringTasks, setRecurringTasks] = useState([]);
  const [upcomingInstances, setUpcomingInstances] = useState([]);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  // Mock recurring tasks data
  useEffect(() => {
    const mockRecurringTasks = [
      {
        id: 1,
        title: "Weekly Team Standup",
        frequency: "weekly",
        repeatEvery: 1,
        repeatOnDays: ["Mon"],
        startDate: "2024-01-01",
        time: "10:00",
        status: "active",
        nextInstance: "2024-01-29",
      },
      {
        id: 2,
        title: "Monthly Security Review",
        frequency: "monthly",
        repeatEvery: 1,
        startDate: "2024-01-01",
        time: "09:00",
        status: "active",
        nextInstance: "2024-02-01",
      },
      {
        id: 3,
        title: "Daily Code Backup",
        frequency: "daily",
        repeatEvery: 1,
        startDate: "2024-01-01",
        time: "23:00",
        status: "active",
        nextInstance: "2024-01-29",
      },
    ];
    setRecurringTasks(mockRecurringTasks);
    generateUpcomingInstances(mockRecurringTasks);
  }, []);

  const generateUpcomingInstances = (tasks) => {
    const instances = [];
    const today = new Date();

    tasks.forEach((task) => {
      if (task.status === "active") {
        // Generate only the next upcoming instance for each recurring task
        const nextDate = new Date(task.nextInstance);
        if (nextDate >= today) {
          instances.push({
            id: `${task.id}_${nextDate.getTime()}`,
            recurringTaskId: task.id,
            title: task.title,
            date: nextDate.toISOString().split("T")[0],
            time: task.time,
            frequency: task.frequency,
            isRecurring: true,
          });
        }
      }
    });

    setUpcomingInstances(instances);
  };

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

  const getTasksForDate = (date) => {
    if (!date) return [];
    const dateStr = date.toISOString().split("T")[0];
    return upcomingInstances.filter((instance) => instance.date === dateStr);
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const handleDateClick = (date) => {
    if (date) {
      const dateStr = date.toISOString().split("T")[0];
      setShowCreateTask(true);
      setSelectedDate(dateStr);
    }
  };

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
    <div className="calendar-container bg-white border border-gray-200 rounded-sm">
      {/* Calendar Header */}
      <div className="calendar-header p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">
              📅 Recurring Tasks Calendar
            </h2>
            <span className="text-sm text-gray-500">
              Showing next upcoming instances only
            </span>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 h-9"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateMonth(-1)}
              className="p-2 hover:bg-gray-100 rounded-sm transition-colors h-9"
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

            <h3 className="text-lg font-medium text-gray-900">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateMonth(1)}
              className="p-2 hover:bg-gray-100 rounded-sm transition-colors h-9"
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

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentDate(new Date())}
              className="h-9 px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-sm hover:bg-blue-200 transition-colors"
            >
              Today
            </Button>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="h-9 text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="day">Day</option>
            </select>
          </div>
        </div>
      </div>

      {/* Calendar Body */}
      <div className="calendar-body p-4">
        {viewMode === "month" && (
          <div className="calendar-grid">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-medium text-gray-500 py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
              {getDaysInMonth(currentDate).map((date, index) => {
                const tasksForDate = getTasksForDate(date);
                const isToday =
                  date && date.toDateString() === new Date().toDateString();

                return (
                  <div
                    key={index}
                    className={`
                      min-h-[80px] p-2 border border-gray-100 rounded-sm
                      ${date ? "bg-white hover:bg-gray-50 cursor-pointer" : "bg-gray-50"}
                      ${isToday ? "border-blue-500 bg-blue-50" : ""}
                      transition-colors
                    `}
                    onClick={() => handleDateClick(date)}
                    title={
                      date
                        ? `Click to create task for ${date.toDateString()}`
                        : ""
                    }
                  >
                    {date && (
                      <>
                        <div
                          className={`text-sm font-medium mb-1 ${isToday ? "text-blue-700" : "text-gray-900"}`}
                        >
                          {date.getDate()}
                        </div>
                        <div className="space-y-1">
                          {tasksForDate.map((task) => (
                            <div
                              key={task.id}
                              className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-md cursor-pointer hover:bg-green-200 transition-colors"
                              title={`<RecurringTaskIcon size={size} className="flex-shrink-0" /> ${task.title} - ${task.time} (Recurring ${task.frequency})`}
                            >
                              <div className="flex items-center gap-1">
                                <span>
                                  <RecurringTaskIcon
                                    size={size}
                                    className="flex-shrink-0"
                                  />
                                </span>
                                <span className="truncate" title={task.title}>
                                  {task.title}
                                </span>
                              </div>
                              <div className="text-green-600">{task.time}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === "week" && (
          <div className="week-view">
            <div className="text-center text-gray-500 mb-3">
              Week view coming soon...
            </div>
          </div>
        )}

        {viewMode === "day" && (
          <div className="day-view">
            <div className="text-center text-gray-500 mb-3">
              Day view coming soon...
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="calendar-footer p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
              <span>Recurring Task Instance</span>
            </div>
            <div className="flex items-center gap-2">
              <span>
                <RecurringTaskIcon size={size} className="flex-shrink-0" />
              </span>
              <span>Recurring Task Indicator</span>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Only showing next upcoming instance per recurring pattern
          </div>
        </div>
      </div>

      {/* Create Task Modal */}
      {showCreateTask && (
        <div className="fixed inset-0 z-50 overflow-hidden overlay-animate mt-0">
          <div
            className="drawer-overlay absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowCreateTask(false)}
          ></div>
          <div
            className="absolute right-0 top-0 h-full bg-white flex flex-col modal-animate-slide-right"
            style={{
              width: "min(90vw, 900px)",
              boxShadow: "-10px 0 50px rgba(0,0,0,0.2)",
            }}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Create New Task
                </h2>
                <p className="text-sm text-gray-600">for {selectedDate}</p>
              </div>
              <button
                onClick={() => setShowCreateTask(false)}
                className="p-2 hover:bg-gray-100 rounded-sm transition-colors"
                data-testid="close-modal"
              >
                <svg
                  className="w-5 h-5 text-gray-600"
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
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <CreateTask
                onClose={() => setShowCreateTask(false)}
                preFilledDate={selectedDate}
                onSubmit={(taskData) => {
                  console.log("Task created:", taskData);
                  setShowCreateTask(false);
                }}
                drawer={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
