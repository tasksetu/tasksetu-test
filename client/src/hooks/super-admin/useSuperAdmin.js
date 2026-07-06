import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Platform Analytics
export function usePlatformAnalytics() {
  return useQuery({
    queryKey: ["/api/super-admin/analytics"],
    retry: false,
  });
}

// Companies Management
export function useCompanies() {
  return useQuery({
    queryKey: ["/api/super-admin/companies"],
    retry: false,
  });
}

export function useCompanyDetails(companyId) {
  return useQuery({
    queryKey: ["/api/super-admin/companies", companyId],
    enabled: !!companyId,
    retry: false,
  });
}

export function useUpdateCompanyStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ companyId, isActive }) => {
      return await apiRequest("PATCH", `/api/super-admin/companies/${companyId}/status`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/companies"] });
    },
  });
}

// Users Management
export function useAllUsers() {
  return useQuery({
    queryKey: ["/api/super-admin/users"],
    retry: false,
  });
}

export function useAssignCompanyAdmin() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ companyId, userId }) => {
      return await apiRequest("POST", "/api/super-admin/assign-admin", { companyId, userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/companies"] });
    },
  });
}

// System Logs
export function useSystemLogs(limit = 100) {
  return useQuery({
    queryKey: ["/api/super-admin/logs", limit],
    retry: false,
  });
}

// Create Super Admin
export function useCreateSuperAdmin() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userData) => {
      return await apiRequest("POST", "/api/super-admin/create-super-admin", userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/users"] });
    },
  });
}