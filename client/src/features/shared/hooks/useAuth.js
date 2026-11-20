import { useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useActiveRole } from "../../../components/RoleSwitcher";

/**
 * Custom hook for managing authentication state
 * Works with both real backend and mock API
 */
export const useAuth = () => {
  const {
    data: rawUser,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["/api/auth/verify"],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes cache (instantly refetched if invalidated)
    gcTime: 10 * 60 * 1000, // 10 minutes cache time
  });

  const user = useMemo(() => {
    let cachedUser = null;
    try {
      const stored = localStorage.getItem("user");
      if (stored) cachedUser = JSON.parse(stored);
    } catch (_) {}

    if (!rawUser && !cachedUser) return null;

    const merged = { ...(cachedUser || {}), ...(rawUser || {}) };
    if (!merged.organization && cachedUser?.organization) {
      merged.organization = cachedUser.organization;
    }
    if (!merged.organizationName && (cachedUser?.organizationName || cachedUser?.organization?.name)) {
      merged.organizationName = cachedUser?.organizationName || cachedUser?.organization?.name;
    }
    return merged;
  }, [rawUser]);

  // Keep localStorage in sync when fresh user with organization arrives
  useEffect(() => {
    if (rawUser && (rawUser.organization || rawUser.organizationName)) {
      try {
        const stored = JSON.parse(localStorage.getItem("user") || "{}");
        if (stored) {
          localStorage.setItem("user", JSON.stringify({ ...stored, ...rawUser }));
        }
      } catch (_) {}
    }
  }, [rawUser]);

  const { activeRole } = useActiveRole();

  const isAuthenticated = !!user && !error;

  const logout = () => {
    // Clear auth data and redirect
    window.location.href = "/auth/login";
  };

  // Determine the current role - use activeRole from context, or first role from array, or default
  const getCurrentRole = () => {
    if (activeRole) return activeRole;
    if (Array.isArray(user?.role) && user.role.length > 0) return user.role[0];
    if (user?.role && typeof user.role === "string") return user.role;
    return "individual";
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    logout,
    refetch, // Allow manual refetch of user data
    // User role information
    role: getCurrentRole(),
    hasOrganization: !!(user?.organizationId || user?.organization),
    permissions: user?.permissions || [],
  };
};
