import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import SearchableSelect from "../SearchableSelect";
import { Search, Download, FileSpreadsheet, FileText } from "lucide-react";

const TaskFilters = React.memo(function TaskFilters({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  taskTypeFilter,
  setTaskTypeFilter,
  dueDateFilter,
  setDueDateFilter,
  showSnooze,
  setShowSnooze,
  showCalendarView,
  setShowCalendarView,
  selectedTasks,
  setSelectedTasks,
  handleBulkStatusUpdate,
  handleBulkDeleteTasks,
  exportTasksCSV,
  exportTasksExcel,
  filteredTasks,
  currentPage,
  companyStatuses,
  taskPriorities,
  activeRole,
  windowCalendarSpecificDate,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="mb-3">
      {/* Search Bar and Filters - Single Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search Bar */}
        <div className="relative h-8 w-full sm:w-auto sm:min-w-[200px] sm:max-w-md flex-1 sm:flex-initial">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-full min-h-8 max-h-8 box-border pl-10 pr-3 py-0 text-sm leading-none border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
          />
        </div>
        {/* Status Filter */}
        <SearchableSelect
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.value)}
          options={[
            { value: "all", label: "All Status" },
            ...(Array.isArray(companyStatuses) ? companyStatuses : [])
              .filter((s) => s && s.active)
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map((s) => ({ value: s.code, label: s.label })),
          ]}
          placeholder="Filter by Status"
          className="min-w-[180px]"
          size="small"
        />

        {/* Priority Filter */}
        <SearchableSelect
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.value)}
          options={[
            { value: "all", label: "All Priority" },
            ...(Array.isArray(taskPriorities) ? taskPriorities : [])
              .filter((p) => p && p.active)
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map((p) => ({ value: p.code, label: p.label })),
          ]}
          placeholder="Filter by Priority"
          className="min-w-[180px]"
          size="small"
        />

        {/* Task Type Filter */}
        <SearchableSelect
          value={taskTypeFilter}
          onChange={(e) => setTaskTypeFilter(e.value)}
          options={[
            { value: "all", label: "All Task Types" },
            { value: "Regular Task", label: "Regular Task" },
            { value: "Recurring Task", label: "Recurring Task" },
            { value: "Milestone Task", label: "Milestone Task" },
            ...(activeRole !== "individual"
              ? [{ value: "Approval Task", label: "Approval Task" }]
              : []),
          ]}
          placeholder="Filter by Task Type"
          className="min-w-[210px]"
          size="small"
        />

        {/* Due Date Filter */}
        <SearchableSelect
          value={dueDateFilter}
          onChange={(e) => {
            setDueDateFilter(e.value);
            if (e.value !== "specific_date") window.calendarSpecificDate = null;
          }}
          options={[
            { value: "all", label: "All Due Dates" },
            { value: "overdue", label: "Overdue" },
            { value: "due_today", label: "Due Today" },
            { value: "due_tomorrow", label: "Due Tomorrow" },
            { value: "due_this_week", label: "Due This Week" },
            { value: "due_next_week", label: "Due Next Week" },
            { value: "due_this_month", label: "Due This Month" },
            { value: "no_due_date", label: "No Due Date" },
            ...(windowCalendarSpecificDate
              ? [
                  {
                    value: "specific_date",
                    label: `Date: ${new Date(windowCalendarSpecificDate)
                      .toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                      .replace(",", "")}`,
                  },
                ]
              : []),
          ]}
          placeholder="Filter by Due Date"
          className="min-w-[200px]"
          size="small"
        />

        {/* Export Options Dropdown */}
        <div className="relative flex-shrink-0" ref={dropdownRef}>
          <Button
            variant="outline"
            className={`h-8 w-8 p-0 flex items-center justify-center rounded-md border transition-all duration-200 active:scale-95 ${
              isOpen
                ? "border-blue-500 bg-blue-50 text-blue-600 shadow-sm"
                : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-400 hover:text-gray-800"
            }`}
            onClick={() => setIsOpen(!isOpen)}
            title="Download Tasks"
          >
            <Download
              className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "scale-110" : ""}`}
            />
          </Button>

          {isOpen && (
            <div className="absolute right-0 mt-1.5 w-36 rounded-sm bg-white shadow-xl border border-gray-100 py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150 origin-top-right">
              <button
                onClick={() => {
                  exportTasksExcel(
                    filteredTasks,
                    `tasks_page${currentPage}.xlsx`,
                  );
                  setIsOpen(false);
                }}
                className="w-full px-3.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 flex items-center gap-2 transition-colors duration-150"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span className="font-medium text-xs">Excel</span>
              </button>
              <div className="h-px bg-gray-100 my-0.5 mx-1" />
              <button
                onClick={() => {
                  exportTasksCSV(filteredTasks, `tasks_page${currentPage}.csv`);
                  setIsOpen(false);
                }}
                className="w-full px-3.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 flex items-center gap-2 transition-colors duration-150"
              >
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-xs">CSV</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Snooze Toggle */}
      {/* <Button
        variant={showSnooze ? "primary" : "outline"}
        onClick={() => setShowSnooze(!showSnooze)}
        className="h-9"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
        {showSnooze ? "Hide" : "Show"} Snoozed
      </Button> */}

      {/* Calendar View Toggle */}
      {/* <Button
        variant={showCalendarView ? "primary" : "outline"}
        onClick={() => setShowCalendarView(!showCalendarView)}
        className="h-9"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        {showCalendarView ? "Hide Calendar" : "Calendar View"}
      </Button> */}

      {/* Bulk Actions - Responsive */}
      {selectedTasks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-blue-50 rounded-md mt-3">
          <span className="text-sm font-medium text-blue-800">
            {selectedTasks.length} selected
          </span>
          <SearchableSelect
            options={companyStatuses.map((status) => ({
              value: status.code,
              label: status.label,
            }))}
            placeholder="Bulk Update Status"
            onChange={(selectedOption) => {
              if (selectedOption) handleBulkStatusUpdate(selectedOption.value);
            }}
            className="flex-1 min-w-[160px] sm:min-w-[200px]"
          />
          <Button
            variant="destructive"
            className="h-8"
            onClick={handleBulkDeleteTasks}
          >
            Delete
          </Button>
          <Button
            variant="outline"
            className="h-8"
            onClick={() => setSelectedTasks([])}
          >
            Clear Selection
          </Button>
        </div>
      )}
    </div>
  );
});

export default TaskFilters;
