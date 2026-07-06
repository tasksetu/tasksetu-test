import { useState } from "react";
import { TaskKanbanView } from "@/components/tasks/TaskKanbanView";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, Kanban, Plus, ClipboardList, Users } from "lucide-react";
import CreateTask from "../../pages/newComponents/CreateTask";
import ApprovalTaskCreator from "../../pages/newComponents/ApprovalTaskCreator";
import AllTasks from "../../components/tasks/TaskTableView";
import { useAuth } from "@/features/shared/hooks/useAuth";

export default function Tasks() {
  // Phase I RBAC: Get user role to determine available views
  const { user, role: userRole } = useAuth();

  // Check if user has manager/admin role for Team Tasks access
  const canViewTeamTasks = [
    "manager",
    "org_admin",
    "company-admin",
    "admin",
    "tasksetu-admin",
    "super-admin",
  ].includes(userRole);

  const [activeView, setActiveView] = useState("table");
  const [showSnooze, setShowSnooze] = useState(false);
  const [showTaskTypeDropdown, setShowTaskTypeDropdown] = useState(false);
  const [selectedTaskType, setSelectedTaskType] = useState("regular");
  const [showCreateTaskDrawer, setShowCreateTaskDrawer] = useState(false);
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
  const [calendarFilteredTasks, setCalendarFilteredTasks] = useState([]);
  const [showApprovalTaskModal, setShowApprovalTaskModal] = useState(false); // This can be moved to AllTasks if not needed here.
  const [tasks, setTasks] = useState([]); // Let AllTasks handle its own data

  // Add this handler function
  const handleCalendarDateSelect = (date) => {
    if (!date) return;

    const dateStr = date.toISOString().split("T")[0];
    const filtered = tasks.filter((task) => task.dueDate === dateStr);

    setSelectedCalendarDate(date);
    setCalendarFilteredTasks(filtered);
  };
  const handleTaskTypeSelect = (taskType) => {
    setSelectedTaskType(taskType);
    setShowTaskTypeDropdown(false);

    setShowCreateTaskDrawer(true); // Let CreateTask handle the different types
  };

  const handleCreateApprovalTask = (approvalTaskData) => {
    // Handle approval task creation logic here
    console.log("Approval task created:", approvalTaskData);
    setShowApprovalTaskModal(false);
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-2 py-4 lg:py-2">
        {/* Modern Header */}
        <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 backdrop-blur-sm rounded-2xl shadow-sm border border-white/20 p-3 sm:p-4 mb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-3">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-2 sm:p-3">
                <svg
                  className="w-6 h-6 sm:w-8 sm:h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  <span className="hidden sm:inline">Tasks Management</span>
                  <span className="sm:hidden">All Tasks</span>
                </h1>
                <p className="text-gray-600 mt-1 text-xs sm:text-sm hidden xs:block">
                  Manage and track all your tasks
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setShowSnooze(!showSnooze)}
                className={`inline-flex items-center px-2 py-1.5 sm:px-3 sm:py-2 rounded-sm sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 ${
                  showSnooze
                    ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg hover:shadow-xl hover:scale-105"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                }`}
              >
                <svg
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                <span className="hidden sm:inline">
                  {showSnooze ? "Hide" : "Show"} Snoozed Tasks
                </span>
                <span className="sm:hidden">Snoozed</span>
              </button>

              <button
                className="inline-flex items-center px-2 py-1.5 sm:px-3 sm:py-2 bg-white/80 text-gray-700 border border-gray-300 rounded-sm text-xs sm:text-sm font-medium hover:bg-gray-50 hover:border-gray-400 shadow-sm transition-all duration-200"
                onClick={() => setShowFullCalendar(true)}
              >
                <svg
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2"
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
                <span className="hidden sm:inline">Calendar View</span>
              </button>
              <div className="relative flex items-center gap-1">
                <button
                  className="inline-flex items-center px-2.5 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-sm sm:rounded-xl text-xs sm:text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-sm hover:shadow-md transition-all duration-200"
                  onClick={() => handleTaskTypeSelect("regular")}
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
                  <span className="hidden xs:inline">Create Task</span>
                </button>
                <button
                  className="px-2 py-1.5 sm:px-3 sm:py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-sm sm:rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-sm hover:shadow-md transition-all duration-200"
                  onClick={() => setShowTaskTypeDropdown(!showTaskTypeDropdown)}
                >
                  <svg
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {showTaskTypeDropdown && (
                  <>
                    <div
                      onClick={() => setShowTaskTypeDropdown(false)}
                      className="absolute right-0 top-full mt-2 w-72 z-50  bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 py-3"
                    >
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
                        Task Types
                      </div>
                      <button
                        className="w-full text-left px-4 py-3 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 flex items-center gap-3"
                        onClick={() => handleTaskTypeSelect("regular")}
                      >
                        <span className="text-2xl">
                          <ClipboardList />
                        </span>
                        <div>
                          <div className="font-medium text-gray-900">
                            Simple Task
                          </div>
                          <div className="text-sm text-gray-500">
                            Standard one-time task
                          </div>
                        </div>
                      </button>
                      {/* <button
                        className="w-full text-left px-4 py-3 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 transition-all duration-200 flex items-center gap-3"
                        onClick={() => handleTaskTypeSelect("recurring")}
                      >
                        <span className="text-2xl">🔄</span>
                        <div>
                          <div className="font-medium text-gray-900">
                            Recurring Task
                          </div>
                          <div className="text-sm text-gray-500">
                            Repeats on schedule
                          </div>
                        </div>
                      </button> */}
                      <button
                        className="w-full text-left px-4 py-3 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 transition-all duration-200 flex items-center gap-3"
                        onClick={() => handleTaskTypeSelect("milestone")}
                      >
                        <span className="text-2xl">🎯</span>
                        <div>
                          <div className="font-medium text-gray-900">
                            Milestone
                          </div>
                          <div className="text-sm text-gray-500">
                            Project checkpoint
                          </div>
                        </div>
                      </button>
                      <button
                        className="w-full text-left px-4 py-3 hover:bg-gradient-to-r hover:from-yellow-50 hover:to-orange-50 transition-all duration-200 flex items-center gap-3"
                        onClick={() => handleTaskTypeSelect("approval")}
                      >
                        <span className="text-2xl">✅</span>
                        <div>
                          <div className="font-medium text-gray-900">
                            Approval Task
                          </div>
                          <div className="text-sm text-gray-500">
                            Requires approval workflow
                          </div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        {showFullCalendar && (
          <FullPageCalendar
            tasks={[]} // AllTasks will fetch its own data
            onClose={() => {
              setShowFullCalendar(false);
              setSelectedCalendarDate(null);
              setCalendarFilteredTasks([]);
            }}
            onDateSelect={handleCalendarDateSelect}
            selectedDate={selectedCalendarDate}
            filteredTasks={calendarFilteredTasks}
          />
        )}
        {/* Create Task Drawer */}
        {showCreateTaskDrawer && (
          <div className="fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-gray-900/20"
              onClick={() => setShowCreateTaskDrawer(false)}
            ></div>
            <div
              className="absolute right-0 top-0 h-full bg-white flex flex-col"
              style={{
                width: "min(90vw, 900px)",
                boxShadow: "-5px 0 25px rgba(0,0,0,0.1)",
              }}
            >
              <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">
                    Create New Task
                  </h2>
                  <button
                    onClick={() => setShowCreateTaskDrawer(false)}
                    className="p-2 text-white hover:bg-white/20 rounded-sm transition-colors"
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
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto bg-white">
                <CreateTask
                  onClose={() => {
                    setShowCreateTaskDrawer(false);
                  }}
                  initialTaskType={selectedTaskType}
                  drawer={false}
                />
              </div>
            </div>
          </div>
        )}

        {/* Approval Task Creator Modal */}
        {showApprovalTaskModal && (
          <div className="fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-gray-900/20"
              onClick={() => setShowApprovalTaskModal(false)}
            ></div>
            <div
              className="absolute right-0 top-0 h-full bg-white/95 backdrop-blur-sm flex flex-col modal-animate-slide-right"
              style={{
                width: "min(90vw, 900px)",
                boxShadow: "-10px 0 50px rgba(0,0,0,0.2)",
                borderLeft: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <div className="drawer-header">
                <h2 className="text-2xl font-bold text-white">
                  Create Approval Task
                </h2>
                <button
                  onClick={() => setShowApprovalTaskModal(false)}
                  className="close-btn"
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
                </button>
              </div>
              <div className="drawer-body">
                <ApprovalTaskCreator
                  onClose={() => {
                    setShowApprovalTaskModal(false);
                  }}
                  onSubmit={handleCreateApprovalTask}
                />
              </div>
            </div>
          </div>
        )}
        {/* View Tabs */}
        <div className="rounded-md border border-white/20">
          <Tabs
            value={activeView}
            onValueChange={setActiveView}
            className="w-full"
          >
            <TabsList
              className={`grid ${canViewTeamTasks ? "w-[500px] grid-cols-3" : "w-80 grid-cols-2"} bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl p-1 shadow-inner`}
            >
              <TabsTrigger
                value="table"
                className="flex items-center space-x-2 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-lg text-sm py-3 px-4 rounded-sm font-medium transition-all duration-200"
              >
                <Table className="h-4 w-4" />
                <span>My Tasks</span>
              </TabsTrigger>
              <TabsTrigger
                value="kanban"
                className="flex items-center space-x-2 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-lg text-sm py-3 px-4 rounded-sm font-medium transition-all duration-200"
              >
                <Kanban className="h-4 w-4" />
                <span>Kanban</span>
              </TabsTrigger>
              {/* Phase I RBAC: Team Tasks tab only for managers */}
              {canViewTeamTasks && (
                <TabsTrigger
                  value="team"
                  className="flex items-center space-x-2 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-lg text-sm py-3 px-4 rounded-sm font-medium transition-all duration-200"
                >
                  <Users className="h-4 w-4" />
                  <span>Team Tasks</span>
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="table" className="mt-6">
              <AllTasks />
            </TabsContent>

            <TabsContent value="kanban" className="mt-6">
              <TaskKanbanView />
            </TabsContent>

            {/* Phase I RBAC: Team Tasks view for managers */}
            {canViewTeamTasks && (
              <TabsContent value="team" className="mt-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        Team Tasks
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">
                        Tasks assigned to your team members
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <Users className="h-3 w-3 mr-1" />
                        Manager View
                      </span>
                    </div>
                  </div>
                  <AllTasks isTeamView={true} />
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function FullPageCalendar({
  tasks,
  onClose,
  onDateSelect,
  selectedDate,
  filteredTasks,
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month");

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
    return tasks.filter((task) => task.dueDate === dateStr);
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const handleDateClick = (date) => {
    if (date && onDateSelect) {
      onDateSelect(date);
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

  const getStatusColor = (status) => {
    const colors = {
      OPEN: "#6c757d",
      INPROGRESS: "#3498db",
      DONE: "#28a745",
      ONHOLD: "#f39c12",
      CANCELLED: "#dc3545",
    };
    return colors[status] || "#6c757d";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      Low: "#28a745",
      Medium: "#f39c12",
      High: "#fd7e14",
      Urgent: "#dc3545",
    };
    return colors[priority] || "#6c757d";
  };

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Task Calendar</h1>
            <p className="text-blue-100 mt-2">View and manage tasks by date</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-sm hover:bg-white/10 transition-colors"
          >
            <svg
              className="w-8 h-8"
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
      </div>

      <div className="flex h-full">
        {/* Calendar Section */}
        <div className="flex-1 p-4 overflow-y-auto">
          {/* Calendar Navigation */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-3 hover:bg-gray-100 rounded-sm transition-colors"
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              <h2 className="text-2xl font-bold text-gray-900">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>

              <button
                onClick={() => navigateMonth(1)}
                className="p-3 hover:bg-gray-100 rounded-sm transition-colors"
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-4 py-2 bg-blue-100 text-blue-800 rounded-sm hover:bg-blue-200 transition-colors"
              >
                Today
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-0 bg-gray-50 border-b border-gray-200">
              {dayNames.map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-semibold text-gray-700 py-4 border-r border-gray-200 last:border-r-0"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-0">
              {getDaysInMonth(currentDate).map((date, index) => {
                const tasksForDate = getTasksForDate(date);
                const isToday =
                  date && date.toDateString() === new Date().toDateString();
                const isSelected =
                  selectedDate &&
                  date &&
                  date.toDateString() === selectedDate.toDateString();
                const hasTasks = tasksForDate.length > 0;
                const taskCount = tasksForDate.length;

                return (
                  <div
                    key={index}
                    className={`
                      min-h-[120px] p-3 border-r border-b border-gray-200 last:border-r-0
                      ${
                        date
                          ? "bg-white hover:bg-gray-50 cursor-pointer"
                          : "bg-gray-50"
                      }
                      ${isToday ? "bg-blue-50 border-blue-200" : ""}
                      ${isSelected ? "bg-blue-100 border-blue-300" : ""}
                      transition-colors
                    `}
                    onClick={() => handleDateClick(date)}
                  >
                    {date && (
                      <>
                        <div className="flex justify-between items-start">
                          <div
                            className={`text-sm font-medium ${
                              isToday ? "text-blue-700" : "text-gray-900"
                            }`}
                          >
                            {date.getDate()}
                          </div>
                          {hasTasks && (
                            <div className="flex items-center justify-center w-6 h-6 bg-blue-500 text-white text-xs font-bold rounded-full">
                              {taskCount}
                            </div>
                          )}
                        </div>
                        <div className="space-y-1 mt-2">
                          {tasksForDate.slice(0, 2).map((task) => (
                            <div
                              key={task.id}
                              className="text-xs px-2 py-1 rounded-md cursor-pointer transition-colors truncate"
                              style={{
                                backgroundColor: `${getStatusColor(
                                  task.status,
                                )}20`,
                                color: getStatusColor(task.status),
                                borderLeft: `3px solid ${getPriorityColor(
                                  task.priority,
                                )}`,
                              }}
                              title={`${task.title} - ${task.status} (${task.priority})`}
                            >
                              {task.title}
                            </div>
                          ))}
                          {tasksForDate.length > 2 && (
                            <div className="text-xs text-gray-500 font-medium">
                              +{tasksForDate.length - 2} more
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-6 bg-gray-50 rounded-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Legend</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>Task Count</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-200 rounded"></div>
                <span>Selected Date</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-50 border border-blue-300 rounded"></div>
                <span>Today</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-l-4 border-red-500 bg-gray-100 rounded"></div>
                <span>High Priority</span>
              </div>
            </div>
          </div>
        </div>

        {/* Task List Section */}
        {selectedDate && (
          <div className="w-1/3 bg-gray-50 border-l border-gray-200 p-4 overflow-y-auto">
            <div className="sticky top-0 bg-gray-50 pb-4 mb-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Tasks for{" "}
                {selectedDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {filteredTasks.length} task
                {filteredTasks.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="space-y-3">
              {filteredTasks.length > 0 ? (
                filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white rounded-sm p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-gray-900 text-sm leading-tight">
                        {task.title}
                      </h4>
                      <span
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: `${getStatusColor(task.status)}20`,
                          color: getStatusColor(task.status),
                        }}
                      >
                        {task.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{task.assignee}</span>
                      <span
                        className="px-2 py-1 rounded-full font-medium"
                        style={{
                          backgroundColor: `${getPriorityColor(
                            task.priority,
                          )}20`,
                          color: getPriorityColor(task.priority),
                        }}
                      >
                        {task.priority}
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-gray-600">
                      {task.category}
                    </div>

                    {task.progress > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span>Progress</span>
                          <span>{task.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${task.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400 mb-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  <p className="text-sm">No tasks scheduled for this date</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Click on a date with highlighted tasks to view them
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
