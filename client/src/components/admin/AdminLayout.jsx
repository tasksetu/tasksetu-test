import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "../../layout/sidebar";
import Header from "./Header";
import CommonLoader from "../common/CommonLoader";
import { CalendarProvider } from "../../contexts/CalendarContext";
import { useCalendar } from "../../contexts/CalendarContext";
import TasksCalendarView from "../../pages/newComponents/TasksCalendarView";
import { useLocation } from "wouter";
import CreateTask from "../../pages/newComponents/CreateTask";

function AdminLayoutInner({ children, user, sidebarCollapsed, sidebarOpen, 
  setSidebarOpen, toggleSidebar, handleLogout, userRole, setSidebarCollapsed }) {
  
  const { showCalendar, toggleCalendar } = useCalendar();
  const [, navigate] = useLocation();
  const [selectedDateForTask, setSelectedDateForTask] = useState(null);
  const [showCreateTaskDrawer, setShowCreateTaskDrawer] = useState(false);

  // Tasks fetch karo — dashboard jaisi query
  const token = localStorage.getItem("token");
  const { data: tasksResponse } = useQuery({
    queryKey: ["/api/mytasks"],
    queryFn: async () => {
      const res = await fetch(`/api/mytasks?page=1&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch tasks");
      const data = await res.json();
      return data.success ? data.data : data;
    },
    enabled: !!token,
    staleTime: 30000,
  });

  const currentTasks = tasksResponse?.tasks || tasksResponse?.data || tasksResponse || [];

  return (
    <div className="flex min-h-screen overflow-hidden">
       <div className={`
        ${sidebarOpen ? "translate-x-0 w-[280px]" : "-translate-x-full"} 
        lg:translate-x-0
        fixed top-0 left-0 bottom-0 z-50
        transition-all duration-300 flex-shrink-0
      `}>
        <Sidebar
          role={userRole}
          onLogout={handleLogout}
          setSidebarOpen={setSidebarOpen}
          onCollapsedChange={setSidebarCollapsed}
          defaultCollapsed={false}
          showToggle={true}
          className="h-full"
        />
      </div>

      <div className={`flex-1 flex flex-col min-w-0 min-h-screen bg-gray-50 transition-all duration-300 ${
        sidebarCollapsed ? "lg:ml-[70px]" : "lg:ml-[280px]"
      }`}>
        <Header
          onMenuClick={toggleSidebar}
          onSidebarToggle={toggleSidebar}
          sidebarOpen={sidebarOpen}
          user={user}
        />

        <main className="flex-1 bg-gray-50 pt-16">
          {showCalendar && (
            <div className="bg-white border border-gray-200 shadow-sm mx-4 mt-2 rounded-md">
              <TasksCalendarView
                tasks={currentTasks}          
                onTaskClick={(taskId) => navigate(`/tasks/${taskId}`)}  
                onClose={() => {toggleCalendar()}}
                onDateSelect={(date) => {
  const d = new Date(date);

  if (!isNaN(d.getTime())) {
    const selectedDate = d.toISOString().split("T")[0];

    navigate(`/tasks/create?date=${selectedDate}&type=regular`);
  }
}}
                onDueDateFilter={() => {}}
              />
            </div>
          )}
          {!showCalendar && children}
        </main>
      </div>

    </div>
  );
}

export function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    enabled: !!localStorage.getItem("token"),
    retry: false,
  });

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  const activeRole = user?.activeRole || user?.role?.[0];
  const userRole = activeRole?.toLowerCase();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <CommonLoader variant="spinner" size="lg" color="text-indigo-600" />
      </div>
    );
  }

  if (userRole === "super_admin" || userRole === "superadmin") {
    window.location.href = "/superadmin";
    return null;
  }

  return (
    <CalendarProvider>
      <AdminLayoutInner
        user={user}
        sidebarCollapsed={sidebarCollapsed}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        toggleSidebar={toggleSidebar}
        handleLogout={handleLogout}
        userRole={userRole}
        setSidebarCollapsed={setSidebarCollapsed}
      >
        {children}
      </AdminLayoutInner>
    </CalendarProvider>
  );
}