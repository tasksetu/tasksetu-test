import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

/** Fetch list of organization users for process builder assignees */
export function useOrgUsers() {
  return useQuery({
    queryKey: ["/api/process-builder/users"],
  });
}

/** Fetch list of organization forms for process step attachments */
export function useOrgForms() {
  return useQuery({
    queryKey: ["/api/process-builder/forms"],
  });
}

/** Fetch all process templates */
export function useProcesses() {
  return useQuery({
    queryKey: ["/api/process-builder/processes"],
  });
}

/** Fetch single process template by ID */
export function useProcess(id) {
  return useQuery({
    queryKey: ["/api/process-builder/processes", id],
    enabled: !!id,
  });
}

/** Create new process template mutation */
export function useCreateProcess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (processData) => {
      const res = await apiRequest(
        "POST",
        "/api/process-builder/processes",
        processData
      );
      const json = await res.json();
      return json.data || json;
    },
    onSuccess: () => {
      // ⚡ Optimistically increment PROC_CREATE in TanStack Query caches immediately (0ms latency)
      queryClient.setQueryData(["/api/license/current"], (old) => {
        if (!old) return old;
        const usageObj = old.usage || old.data?.usage || {};
        const currentUsage = usageObj.PROC_CREATE;
        if (!currentUsage) return old;
        const newUsed = (currentUsage.used || 0) + 1;
        const updatedFeature = {
          ...currentUsage,
          used: newUsed,
          remaining: currentUsage.isUnlimited ? -1 : Math.max(0, currentUsage.limit - newUsed),
          percentage: currentUsage.isUnlimited || currentUsage.limit === 0 ? 0 : Math.round((newUsed / currentUsage.limit) * 100),
        };
        return {
          ...old,
          usage: {
            ...usageObj,
            PROC_CREATE: updatedFeature,
          },
        };
      });

      queryClient.setQueryData(["current-license-info"], (old) => {
        if (!old || !old.license) return old;
        const usageObj = old.license.usage || {};
        const currentUsage = usageObj.PROC_CREATE;
        if (!currentUsage) return old;
        const newUsed = (currentUsage.used || 0) + 1;
        return {
          ...old,
          license: {
            ...old.license,
            usage: {
              ...usageObj,
              PROC_CREATE: {
                ...currentUsage,
                used: newUsed,
                remaining: currentUsage.isUnlimited ? -1 : Math.max(0, currentUsage.limit - newUsed),
                percentage: currentUsage.isUnlimited || currentUsage.limit === 0 ? 0 : Math.round((newUsed / currentUsage.limit) * 100),
              },
            },
          },
        };
      });

      // 🔄 Force instant invalidation and background refetch across all license, process and feature queries
      queryClient.invalidateQueries({ queryKey: ["/api/process-builder/processes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/license"] });
      queryClient.invalidateQueries({ queryKey: ["/api/license/current"] });
      queryClient.invalidateQueries({ queryKey: ["current-license-info"] });
      queryClient.invalidateQueries({ queryKey: ["/api/license/organization/features"] });
      queryClient.invalidateQueries({ queryKey: ["/api/license/organization/subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/license/features"] });
      queryClient.invalidateQueries({ queryKey: ["features"] });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      queryClient.invalidateQueries({ queryKey: ["licenses"] });

      queryClient.refetchQueries({ queryKey: ["/api/license/current"], cancelRefetch: false });
      queryClient.refetchQueries({ queryKey: ["current-license-info"], cancelRefetch: false });
      queryClient.refetchQueries({ queryKey: ["/api/process-builder/processes"], cancelRefetch: false });
    },
  });
}

/** Update existing process template mutation */
export function useUpdateProcess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await apiRequest(
        "PUT",
        `/api/process-builder/processes/${id}`,
        data
      );
      const json = await res.json();
      return json.data || json;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/process-builder/processes"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/process-builder/processes", updated?.id],
      });
    },
  });
}

/** Delete process template mutation */
export function useDeleteProcess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      const res = await apiRequest(
        "DELETE",
        `/api/process-builder/processes/${id}`
      );
      const json = await res.json();
      return json.id || id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/process-builder/processes"],
      });
    },
  });
}

/** Start/Launch process instance mutation (creates Main Task & Step Subtasks in Task DB) */
export function useStartProcess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ processId, customName, notes, steps }) => {
      const res = await apiRequest("POST", "/api/process-builder/start", {
        processId,
        customName,
        notes,
        steps,
      });
      const json = await res.json();
      return json.data || json;
    },
    onSuccess: () => {
      // ⚡ Optimistically increment PROC_LAUNCH in TanStack Query caches immediately (0ms latency)
      queryClient.setQueryData(["/api/license/current"], (old) => {
        if (!old) return old;
        const usageObj = old.usage || old.data?.usage || {};
        const currentUsage = usageObj.PROC_LAUNCH;
        if (!currentUsage) return old;
        const newUsed = (currentUsage.used || 0) + 1;
        const updatedFeature = {
          ...currentUsage,
          used: newUsed,
          remaining: currentUsage.isUnlimited ? -1 : Math.max(0, currentUsage.limit - newUsed),
          percentage: currentUsage.isUnlimited || currentUsage.limit === 0 ? 0 : Math.round((newUsed / currentUsage.limit) * 100),
        };
        return {
          ...old,
          usage: {
            ...usageObj,
            PROC_LAUNCH: updatedFeature,
          },
        };
      });

      queryClient.setQueryData(["current-license-info"], (old) => {
        if (!old || !old.license) return old;
        const usageObj = old.license.usage || {};
        const currentUsage = usageObj.PROC_LAUNCH;
        if (!currentUsage) return old;
        const newUsed = (currentUsage.used || 0) + 1;
        return {
          ...old,
          license: {
            ...old.license,
            usage: {
              ...usageObj,
              PROC_LAUNCH: {
                ...currentUsage,
                used: newUsed,
                remaining: currentUsage.isUnlimited ? -1 : Math.max(0, currentUsage.limit - newUsed),
                percentage: currentUsage.isUnlimited || currentUsage.limit === 0 ? 0 : Math.round((newUsed / currentUsage.limit) * 100),
              },
            },
          },
        };
      });

      // 🔄 Force instant invalidation and background refetch across all license, process and instance queries
      queryClient.invalidateQueries({ queryKey: ["/api/process-builder/instances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/license"] });
      queryClient.invalidateQueries({ queryKey: ["/api/license/current"] });
      queryClient.invalidateQueries({ queryKey: ["current-license-info"] });
      queryClient.invalidateQueries({ queryKey: ["/api/license/organization/features"] });
      queryClient.invalidateQueries({ queryKey: ["/api/license/organization/subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/license/features"] });
      queryClient.invalidateQueries({ queryKey: ["features"] });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      queryClient.invalidateQueries({ queryKey: ["licenses"] });

      queryClient.refetchQueries({ queryKey: ["/api/license/current"], cancelRefetch: false });
      queryClient.refetchQueries({ queryKey: ["current-license-info"], cancelRefetch: false });
      queryClient.refetchQueries({ queryKey: ["/api/process-builder/instances"], cancelRefetch: false });
      queryClient.refetchQueries({ queryKey: ["/api/tasks"], cancelRefetch: false });
    },
  });
}

/** Fetch active running process instances */
export function useProcessInstances() {
  return useQuery({
    queryKey: ["/api/process-builder/instances"],
  });
}
