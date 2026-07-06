import { useQuery } from "@tanstack/react-query";

/**
 * Organization task priorities (DB-driven).
 * Source of truth for priority dropdowns/filters.
 */
export function useTaskPriorities() {
  return useQuery({
    queryKey: ["/api/task-priorities"],
    enabled: !!localStorage.getItem("token"),
  });
}

