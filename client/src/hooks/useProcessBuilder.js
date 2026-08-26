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
      queryClient.invalidateQueries({
        queryKey: ["/api/process-builder/processes"],
      });
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
      queryClient.invalidateQueries({
        queryKey: ["/api/process-builder/instances"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/tasks"],
      });
    },
  });
}

/** Fetch active running process instances */
export function useProcessInstances() {
  return useQuery({
    queryKey: ["/api/process-builder/instances"],
  });
}
