import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const fetchWithAuth = async (url, options = {}) => {
  const token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("authToken");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const errorText = await res.text();
    let message = "Request failed";
    try {
      const parsed = JSON.parse(errorText);
      message = parsed.message || message;
    } catch (e) {
      message = errorText || message;
    }
    throw new Error(message);
  }
  return res.json();
};

export const useAccessibleEmployees = (options = {}) => {
  return useQuery({
    queryKey: ["/api/reports/performance/accessible-employees"],
    queryFn: () => fetchWithAuth("/api/reports/performance/accessible-employees"),
    staleTime: 60000,
    ...options,
  });
};

export const usePerformanceOverview = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ["/api/reports/performance/overview", filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.dateRange) params.append("dateRange", filters.dateRange);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.department) params.append("department", filters.department);
      if (filters.employeeId) params.append("employeeId", filters.employeeId);
      return fetchWithAuth(`/api/reports/performance/overview?${params.toString()}`);
    },
    staleTime: 30000,
    ...options,
  });
};

export const useTeamPerformance = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ["/api/reports/performance/team", filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.dateRange) params.append("dateRange", filters.dateRange);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.department) params.append("department", filters.department);
      return fetchWithAuth(`/api/reports/performance/team?${params.toString()}`);
    },
    staleTime: 30000,
    ...options,
  });
};

export const useEmployeePerformance = (employeeId, filters = {}, options = {}) => {
  return useQuery({
    queryKey: ["/api/reports/performance/employee", employeeId, filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.dateRange) params.append("dateRange", filters.dateRange);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.status) params.append("status", filters.status);
      if (filters.priority) params.append("priority", filters.priority);
      return fetchWithAuth(`/api/reports/performance/employee/${employeeId}?${params.toString()}`);
    },
    enabled: Boolean(employeeId) && (options.enabled !== undefined ? options.enabled : true),
    staleTime: 30000,
    ...options,
  });
};

export const useOverdueTaskAnalysis = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ["/api/reports/performance/overdue", filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.bucket) params.append("bucket", filters.bucket);
      if (filters.priority) params.append("priority", filters.priority);
      if (filters.department) params.append("department", filters.department);
      if (filters.employeeId) params.append("employeeId", filters.employeeId);
      return fetchWithAuth(`/api/reports/performance/overdue?${params.toString()}`);
    },
    staleTime: 30000,
    ...options,
  });
};

export const useTaskAuditTimeline = (taskId, options = {}) => {
  return useQuery({
    queryKey: ["/api/reports/performance/task-audit", taskId],
    queryFn: () => fetchWithAuth(`/api/reports/performance/task-audit/${taskId}`),
    enabled: Boolean(taskId) && (options.enabled !== undefined ? options.enabled : true),
    staleTime: 60000,
    ...options,
  });
};

export const usePerformanceReviews = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ["/api/reports/performance/reviews", filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.employeeId) params.append("employeeId", filters.employeeId);
      if (filters.reviewType) params.append("reviewType", filters.reviewType);
      if (filters.status) params.append("status", filters.status);
      return fetchWithAuth(`/api/reports/performance/reviews?${params.toString()}`);
    },
    staleTime: 30000,
    ...options,
  });
};

export const useCreatePerformanceReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) =>
      fetchWithAuth("/api/reports/performance/reviews", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/performance/reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/performance/employee"] });
    },
  });
};

export const useAcknowledgePerformanceReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, response }) =>
      fetchWithAuth(`/api/reports/performance/reviews/${id}/acknowledge`, {
        method: "PATCH",
        body: JSON.stringify({ response }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/performance/reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/performance/employee"] });
    },
  });
};
