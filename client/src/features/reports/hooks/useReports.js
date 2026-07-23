/**
 * useReports Hook
 * Custom React hook for managing reports data and state
 */

import { useState, useCallback, useEffect } from 'react';
import reportsService from '../services/reportsService';
import { useQuery } from '@tanstack/react-query';

// Helper function for API calls
const fetchWithAuth = async (url) => {
  const token = localStorage.getItem('token');
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  // Return the full payload so we have access to metadata like 'license'
  return data;
};

/**
 * Generic report hook factory using react-query
 */
const createReactQueryHook = (queryKeyPrefix, endpoint) => {
  return (initialFilters = {}, options = {}) => {
    // Determine if we should use the passed initialFilters as controlled state
    const isControlled = options.useExternalFilters || false;

    // Internal state for components that don't manage their own filter state
    const [internalFilters, setInternalFilters] = useState({
      dateRange: '30',
      ...initialFilters
    });

    // Sync internal filters if initialFilters changes and NOT controlled
    // (This helps when initialFilters is passed as a prop that might change)
    useEffect(() => {
      if (!isControlled && initialFilters && Object.keys(initialFilters).length > 0) {
        setInternalFilters(prev => ({ ...prev, ...initialFilters }));
      }
    }, [initialFilters, isControlled]);

    const effectiveFilters = isControlled ? initialFilters : internalFilters;

    const queryResult = useQuery({
      queryKey: [queryKeyPrefix, effectiveFilters],
      queryFn: () => {
        const params = new URLSearchParams();
        if (effectiveFilters.dateRange) params.append('dateRange', effectiveFilters.dateRange);
        if (effectiveFilters.startDate) params.append('startDate', effectiveFilters.startDate);
        if (effectiveFilters.endDate) params.append('endDate', effectiveFilters.endDate);
        if (effectiveFilters.status) params.append('status', effectiveFilters.status);
        if (effectiveFilters.priority) params.append('priority', effectiveFilters.priority);
        if (effectiveFilters.user) params.append('user', effectiveFilters.user);
        if (effectiveFilters.team) params.append('department', effectiveFilters.team);
        if (effectiveFilters.department) params.append('department', effectiveFilters.department);

        return fetchWithAuth(`${endpoint}?${params.toString()}`);
      },
      staleTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      retry: 1,
      ...options
    });

    return {
      // Return the 'data' field from the response for backward compatibility
      data: queryResult.data?.data || queryResult.data,
      // Metadata like license from the top level
      license: queryResult.data?.license,
      loading: (queryResult.isLoading || queryResult.isFetching) && !queryResult.data,
      isFetching: queryResult.isFetching,
      error: queryResult.error,
      refetch: queryResult.refetch,
      filters: effectiveFilters,
      updateFilters: (newFilters) => setInternalFilters(prev => ({ ...prev, ...newFilters }))
    };
  };
};

/**
 * Hook exports with consistent naming for components
 */

// 1. Task Completion & Status
export const useTaskCompletionStatusReport = createReactQueryHook('taskCompletionStatus', '/api/reports/task-completion-status');

// 2. My Productivity / Task Status
export const useProductivityReport = createReactQueryHook('productivityReport', '/api/reports/my-productivity');
export const useTaskStatusReport = useProductivityReport;

// 3. Overdue Tasks
export const useOverdueTasksReport = createReactQueryHook('overdueTasksReport', '/api/reports/overdue-tasks');

// 3. Milestone Achievement
export const useMilestoneAchievementReport = createReactQueryHook('milestoneAchievementReport', '/api/reports/milestone-achievement');

// 4. Recurring Task Adherence
export const useRecurringTaskAdherenceReport = createReactQueryHook('recurringTaskAdherenceReport', '/api/reports/recurring-task-adherence');

// 5. Quick Task Conversion
export const useQuickTaskConversionReport = createReactQueryHook('quickTaskConversionReport', '/api/reports/quick-task-conversion');

// 6. Activity Engagement
export const useActivityEngagementReport = createReactQueryHook('activityEngagementReport', '/api/reports/activity-engagement');

// 7. Team Analytics
export const useTeamAnalytics = createReactQueryHook('teamAnalyticsReport', '/api/reports/team-analytics');
export const useTeamAnalyticsReport = useTeamAnalytics;

// 8. Productivity Efficiency
export const useProductivityEfficiencyReport = createReactQueryHook('productivityEfficiencyReport', '/api/reports/productivity-efficiency');

// 9. Workload Distribution
export const useWorkloadDistributionReport = createReactQueryHook('workloadDistributionReport', '/api/reports/workload-distribution');

// 10. Organization Analytics
export const useOrganizationAnalytics = createReactQueryHook('organizationAnalytics', '/api/reports/organization-analytics');
export const useOrganizationAnalyticsReport = useOrganizationAnalytics;

/**
 * Hook for exporting reports
 */
export const useExportReport = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const exportData = async (reportType, format, filters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await reportsService.exportReport(reportType, format, filters);

      const blob = format === 'pdf'
        ? new Blob([data], { type: 'application/pdf' })
        : new Blob([typeof data === 'string' ? data : JSON.stringify(data)], { type: format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report-${reportType}-${new Date().getTime()}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      return true;
    } catch (err) {
      setError(err.message || 'Export failed');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    exportData,
    loading,
    error
  };
};

