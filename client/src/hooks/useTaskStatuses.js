import { useQuery } from "@tanstack/react-query";

/**
 * Organization task statuses (DB-driven).
 * Source of truth for task status dropdowns/filters.
 */
export function useTaskStatuses() {
  return useQuery({
    queryKey: ["/api/task-statuses"],
    enabled: !!localStorage.getItem("token"),
  });
}

