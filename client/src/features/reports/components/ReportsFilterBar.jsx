import React, { useMemo, useState, useEffect, useRef } from "react";
import { Calendar, Filter, Download, ChevronDown } from "lucide-react";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import { useTaskPriorities } from "@/hooks/useTaskPriorities";

/**
 * Reports Filter Bar Component - Provides filtering options for reports
 * Used across all reporting pages for consistent filtering
 */
const ReportsFilterBar = ({
  onFilterChange,
  showTeamFilter = false,
  showUserFilter = false,
  showStatusFilter = true,
  showPriorityFilter = true,
  showDateRange = true,
  showExport = true,
  onExport,
  teams = [],
  users = [],
  loading = false,
}) => {
  // Get user's joining date from localStorage
  const getUserJoiningDate = () => {
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.createdAt
          ? new Date(user.createdAt).toISOString().split("T")[0]
          : null;
      }
    } catch (error) {
      console.error("Error getting user joining date:", error);
    }
    return null;
  };

  // Calculate default date range (30 days ago to today)
  const getDefaultDateRange = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    return {
      startDate: thirtyDaysAgo.toISOString().split("T")[0],
      endDate: today.toISOString().split("T")[0],
    };
  };

  const defaultRange = getDefaultDateRange();
  const userJoiningDate = getUserJoiningDate();
  const todayDate = new Date().toISOString().split("T")[0];

  const [filters, setFilters] = useState({
    startDate: defaultRange.startDate,
    endDate: defaultRange.endDate,
    status: "",
    priority: "",
    team: "",
    user: "",
  });

  // Initialize filters on mount
  useEffect(() => {
    onFilterChange?.(filters);
  }, []);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target)
      ) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showExportMenu]);

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const { data: taskStatuses = [] } = useTaskStatuses();
  const { data: taskPriorities = [] } = useTaskPriorities();

  const statusOptions = useMemo(() => {
    const dynamic = (Array.isArray(taskStatuses) ? taskStatuses : [])
      .filter((s) => s && s.active)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((s) => ({ value: s.code, label: s.label }));

    // Keep legacy/special filters if any reporting page depends on them.
    return [
      { value: "", label: "All Status" },
      ...dynamic,
      { value: "RISK", label: "Risk" },
    ];
  }, [taskStatuses]);

  const priorityOptions = useMemo(() => {
    const dynamic = (Array.isArray(taskPriorities) ? taskPriorities : [])
      .filter((p) => p && p.active)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((p) => ({ value: p.code, label: p.label }));

    return [{ value: "", label: "All Priorities" }, ...dynamic];
  }, [taskPriorities]);

  const exportFormats = [
    { value: "pdf", label: "Export as PDF", icon: "📄" },
    { value: "excel", label: "Export as Excel", icon: "📊" },
    { value: "csv", label: "Export as CSV", icon: "📋" },
  ];

  const handleExportClick = (format) => {
    setShowExportMenu(false);
    onExport?.(format);
  };

  return (
    <div className="bg-white rounded-md shadow-sm border border-gray-200 p-3 sm:p-4 mb-3">
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 sm:gap-3">
        {/* Date Range Filter */}
        {showDateRange && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Calendar size={16} className="text-gray-500 hidden sm:block" />
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  handleFilterChange("startDate", e.target.value)
                }
                min={userJoiningDate}
                max={filters.endDate || todayDate}
                className="w-full sm:w-auto h-9 px-2 sm:px-3 border border-gray-300 rounded-sm text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
                placeholder="Start Date"
              />
              <span className="text-gray-500 text-xs sm:text-sm hidden sm:inline">
                to
              </span>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
                className="w-full sm:w-auto h-9 px-2 sm:px-3 border border-gray-300 rounded-sm text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
                placeholder="End Date"
                min={filters.startDate}
                max={todayDate}
              />
            </div>
          </div>
        )}

        {/* Status Filter */}
        {/* {showStatusFilter && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter size={16} className="text-gray-500 hidden sm:block" />
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-sm text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )} */}

        {/* Priority Filter */}
        {/* {showPriorityFilter && (
          <div className="w-full sm:w-auto">
            <select
              value={filters.priority}
              onChange={(e) => handleFilterChange("priority", e.target.value)}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-sm text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}>
              {priorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )} */}

        {/* Team Filter */}
        {showTeamFilter && teams.length > 0 && (
          <div className="w-full sm:w-auto">
            <select
              value={filters.team}
              onChange={(e) => handleFilterChange("team", e.target.value)}
              className="w-full h-9 px-2 sm:px-3 border border-gray-300 rounded-sm text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="">All Teams</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* User Filter */}
        {showUserFilter && users.length > 0 && (
          <div className="w-full sm:w-auto">
            <select
              value={filters.user}
              onChange={(e) => handleFilterChange("user", e.target.value)}
              className="w-full h-9 px-2 sm:px-3 border border-gray-300 rounded-sm text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="">All Users</option>
              {users.map((u) => (
                <option key={u.id || u._id} value={u.id || u._id}>
                  {u.name || u.label || u.email || "User"}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Export Dropdown Button */}
        {/* {showExport && (
          <div ref={exportMenuRef} className="ml-auto relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={18} />
              <span className="text-sm font-medium">Export</span>
              <ChevronDown size={16} className={`transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>

            Export Options Dropdown
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                {exportFormats.map(format => (
                  <button
                    key={format.value}
                    onClick={() => handleExportClick(format.value)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors"
                  >
                    <span>{format.icon}</span>
                    <span>{format.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )} */}
      </div>
    </div>
  );
};

export default ReportsFilterBar;
