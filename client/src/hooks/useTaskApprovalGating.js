import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../stores/useAuthStore";

/**
 * Hook to retrieve organization approval settings and check whether a given
 * task modification requires approval from the creator before taking effect.
 */
export function useTaskApprovalGating() {
  const storeUser = useAuthStore((state) => state.user);
  let currentUser = storeUser;

  if (!currentUser) {
    try {
      const stored = localStorage.getItem("user");
      if (stored) currentUser = JSON.parse(stored);
    } catch (e) {}
  }

  const { data: settingsResponse, isLoading, refetch } = useQuery({
    queryKey: ["/api/organization/settings"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      if (!token) return null;
      try {
        const res = await fetch("/api/organization/settings", {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        if (!res.ok) {
          console.warn("Could not fetch org settings, status:", res.status);
          return null;
        }
        const data = await res.json();
        return data?.data || data;
      } catch (err) {
        console.error("Error fetching org settings:", err);
        return null;
      }
    },
    staleTime: 30 * 1000,
  });

  const orgSettings = settingsResponse || {};

  const evaluateGating = (settingsToUse, { task, field, user = null }) => {
    if (!task || !field) return false;

    const evalUser = user || currentUser;
    const currentUserId = String(
      evalUser?._id || evalUser?.id || ""
    );
    const taskCreatorId = String(
      task?.createdBy?._id ||
      task?.createdBy?.id ||
      task?.createdBy ||
      task?.creatorId ||
      ""
    );

    // 1. Task creator always has direct modification authority
    if (currentUserId && taskCreatorId && currentUserId === taskCreatorId) {
      return false;
    }

    // 2. Administrators retain direct modification authority
    const activeRole =
      localStorage.getItem("activeRole") ||
      (Array.isArray(evalUser?.role) ? evalUser.role[0] : evalUser?.role);

    const adminRoles = [
      "super_admin",
      "super-admin",
      "tasksetu-admin",
      "org_admin",
      "company-admin",
      "admin",
    ];

    if (adminRoles.includes(activeRole)) {
      return false;
    }

    // 3. Check corresponding toggle in organization settings
    switch (field) {
      case "dueDate":
        return Boolean(settingsToUse?.dueDateApprovalEnabled);
      case "status":
        return Boolean(settingsToUse?.statusApprovalEnabled);
      case "priority":
        return Boolean(settingsToUse?.priorityApprovalEnabled);
      case "assignedTo":
        return Boolean(settingsToUse?.assigneeApprovalEnabled);
      default:
        return false;
    }
  };

  /**
   * Synchronous check against currently loaded settings
   */
  const checkRequiresApproval = ({ task, field, user = null }) => {
    return evaluateGating(orgSettings, { task, field, user });
  };

  /**
   * Async check that fetches fresh settings if not yet loaded
   */
  const checkRequiresApprovalAsync = async ({ task, field, user = null }) => {
    let settings = orgSettings;
    if (!settings || Object.keys(settings).length === 0) {
      try {
        const token = localStorage.getItem("token");
        if (token) {
          const res = await fetch("/api/organization/settings", {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });
          if (res.ok) {
            const data = await res.json();
            settings = data?.data || data || {};
          }
        }
      } catch (err) {
        console.error("Failed to fetch fresh org settings in checkRequiresApprovalAsync:", err);
      }
    }
    return evaluateGating(settings, { task, field, user });
  };

  return {
    currentUser,
    orgSettings,
    isLoading,
    refetch,
    checkRequiresApproval,
    checkRequiresApprovalAsync,
  };
}

export default useTaskApprovalGating;
