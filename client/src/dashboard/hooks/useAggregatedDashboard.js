import { useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Single aggregated dashboard hook for TaskSetu.
 * Consolidates KPIs, charts, task lists, calendar events, and team analytics into 1 request.
 */
export function useAggregatedDashboard({
  activeRole,
  timeRange = "7d",
  filters = {},
} = {}) {
  const queryClient = useQueryClient();
  const token = localStorage.getItem("token");

  const queryKey = [
    "/api/dashboard/aggregated",
    activeRole || "default",
    timeRange || "7d",
    filters.status || "all",
    filters.priority || "all",
    filters.search || "",
  ];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!token) throw new Error("No authentication token found");

      const params = new URLSearchParams();
      if (activeRole) params.append("activeRole", activeRole);
      if (timeRange) params.append("timeRange", timeRange);
      if (filters.status && filters.status !== "all") {
        params.append("status", filters.status);
      }
      if (filters.priority && filters.priority !== "all") {
        params.append("priority", filters.priority);
      }
      if (filters.search && filters.search.trim()) {
        params.append("search", filters.search.trim());
      }

      const url = `/api/dashboard/aggregated?${params.toString()}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            errorData.error ||
            `Failed to fetch dashboard data: ${response.status}`
        );
      }

      const resJson = await response.json();
      return resJson.data || resJson;
    },
    enabled: !!token,
    staleTime: 30_000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  const invalidateDashboard = () => {
    return queryClient.invalidateQueries({
      queryKey: ["/api/dashboard/aggregated"],
    });
  };

  return {
    ...query,
    dashboardData: query.data || null,
    kpis: query.data?.kpis || null,
    charts: query.data?.charts || null,
    taskList: query.data?.taskList || [],
    calendarEvents: query.data?.calendarEvents || [],
    teamMembers: query.data?.teamMembers || [],
    focusSections: query.data?.focusSections || null,
    milestones: query.data?.milestones || [],
    moduleUsage: query.data?.moduleUsage || null,
    systemHealth: query.data?.systemHealth || null,
    invalidateDashboard,
  };
}
