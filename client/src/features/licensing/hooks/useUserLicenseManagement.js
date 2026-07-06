/**
 * 🎯 User-Level License Management Hook
 * 
 * This hook provides APIs for managing user-level licenses within an organization.
 * 
 * Features:
 * - View organization license pool (available licenses by tier)
 * - View individual user's license and limits
 * - Assign license from pool to a user
 * - Unassign license from user (return to pool)
 * - Check license assignment eligibility
 * 
 * Permissions:
 * - Primary Admin: Full access (assign/unassign to anyone)
 * - Secondary Org Admin: Can assign/unassign to others (not self or Primary Admin)
 * - Other users: Can only view their own license
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/license';

/**
 * Hook for managing user-level licenses
 * 
 * @returns {Object} License management functions and state
 */
export function useUserLicenseManagement() {
  const queryClient = useQueryClient();

  // ═══════════════════════════════════════════════════════════════
  // 📊 QUERIES - Fetch license data
  // ═══════════════════════════════════════════════════════════════

  /**
   * Fetch organization's license pool summary
   * Shows: { PLAN: { total: 10, used: 3, available: 7 }, EXECUTE: {...} }
   */
  const {
    data: licensePoolData,
    isLoading: isPoolLoading,
    error: poolError,
    refetch: refetchPool,
  } = useQuery({
    queryKey: ['license-pool'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/organization/pool`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch license pool');
      }

      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
  });

  /**
   * Fetch all organization users with their license info
   * Used for displaying license assignment table
   */
  const {
    data: orgUsersData,
    isLoading: isOrgUsersLoading,
    error: orgUsersError,
    refetch: refetchOrgUsers,
  } = useQuery({
    queryKey: ['org-users-licenses'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/organization/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch organization users');
      }

      return response.json();
    },
    staleTime: 30 * 1000,
    retry: 2,
  });

  /**
   * Fetch a specific user's license info (for viewing/editing)
   * 
   * @param {string} userId - Target user ID
   */
  const useUserLicenseInfo = (userId) => {
    return useQuery({
      queryKey: ['user-license', userId],
      queryFn: async () => {
        if (!userId) return null;
        
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/user/${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to fetch user license');
        }

        return response.json();
      },
      enabled: !!userId,
      staleTime: 30 * 1000,
    });
  };

  // ═══════════════════════════════════════════════════════════════
  // 🔄 MUTATIONS - License assignment/unassignment
  // ═══════════════════════════════════════════════════════════════

  /**
   * Assign a license to a user
   */
  const assignLicenseMutation = useMutation({
    mutationFn: async ({ targetUserId, licenseCode }) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/assign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetUserId, licenseCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to assign license');
      }

      return data;
    },
     onSuccess: () => {
      // Invalidate related queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['license-pool'] });
      queryClient.invalidateQueries({ queryKey: ['org-users-licenses'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['current-license-info'] });
    },
  });

  /**
   * Unassign (release) a license from a user
   */
  const unassignLicenseMutation = useMutation({
    mutationFn: async ({ targetUserId }) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/unassign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetUserId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to unassign license');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['license-pool'] });
      queryClient.invalidateQueries({ queryKey: ['org-users-licenses'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['current-license-info'] });
    },
  });

  /**
   * Check if admin can assign a specific license to a user
   */
  const checkAssignMutation = useMutation({
    mutationFn: async ({ targetUserId, licenseCode }) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/check-assign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetUserId, licenseCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to check assignment');
      }

      return data;
    },
  });

  // ═══════════════════════════════════════════════════════════════
  // 🔧 HELPER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get available license tiers from pool
   * @returns {Array} Array of available license codes
   */
  const getAvailableLicenses = () => {
    const pool = licensePoolData?.pool || [];
    return pool
      .filter(p => p.available > 0)
      .map(p => ({
        code: p.license_code,
        name: p.license_name,
        available: p.available,
        total: p.total,
      }));
  };

  /**
   * Check if a license tier has available seats
   * @param {string} licenseCode - License code to check
   * @returns {boolean}
   */
  const hasAvailableSeats = (licenseCode) => {
    const pool = licensePoolData?.pool || [];
    const tier = pool.find(p => p.license_code === licenseCode);
    return tier ? tier.available > 0 : false;
  };

  /**
   * Assign license to user (wrapper with better error handling)
   * @param {string} targetUserId - User to assign to
   * @param {string} licenseCode - License to assign (PLAN, EXECUTE, OPTIMIZE)
   * @returns {Promise<Object>}
   */
  const assignLicense = async (targetUserId, licenseCode) => {
    return assignLicenseMutation.mutateAsync({ targetUserId, licenseCode });
  };

  /**
   * Unassign license from user (release back to pool)
   * @param {string} targetUserId - User to unassign from
   * @returns {Promise<Object>}
   */
  const unassignLicense = async (targetUserId) => {
    return unassignLicenseMutation.mutateAsync({ targetUserId });
  };

  /**
   * Check if current admin can assign a license to a user
   * @param {string} targetUserId - User to check
   * @param {string} licenseCode - License to check
   * @returns {Promise<Object>} { canAssign: boolean, reason: string }
   */
  const checkCanAssign = async (targetUserId, licenseCode) => {
    return checkAssignMutation.mutateAsync({ targetUserId, licenseCode });
  };

  /**
   * Refresh all license data
   */
  const refreshAll = async () => {
    await Promise.all([
      refetchPool(),
      refetchOrgUsers(),
    ]);
  };

  // ═══════════════════════════════════════════════════════════════
  // 📤 RETURN VALUES
  // ═══════════════════════════════════════════════════════════════

  return {
    // Pool data
    licensePool: licensePoolData?.pool || [],
    isPoolLoading,
    poolError,
    refetchPool,

    // Organization users
    orgUsers: orgUsersData?.users || [],
    totalOrgUsers: orgUsersData?.totalUsers || 0,
    isOrgUsersLoading,
    orgUsersError,
    refetchOrgUsers,

    // User-specific license query hook
    useUserLicenseInfo,

    // Mutations
    assignLicense,
    unassignLicense,
    checkCanAssign,

    // Mutation states
    isAssigning: assignLicenseMutation.isPending,
    isUnassigning: unassignLicenseMutation.isPending,
    assignError: assignLicenseMutation.error,
    unassignError: unassignLicenseMutation.error,

    // Helpers
    getAvailableLicenses,
    hasAvailableSeats,
    refreshAll,
  };
}

/**
 * Simple hook to fetch current user's own license
 * Used by non-admin users to see their own limits
 */
export function useCurrentUserLicense() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['current-user-license'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/current`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch license');
      }

      return response.json();
    },
    staleTime: 60 * 1000, // 1 minute
    retry: 2,
  });

  return {
    license: data?.license || 'EXPLORE',
    licenseName: data?.licenseName || 'Explore (Trial)',
    licenseDetails: data?.licenseDetails || {},
    usage: data?.usage || {},
    features: data?.features || {},
    status: data?.status || 'UNKNOWN',
    isLoading,
    error,
    refetch,
  };
}

export default useUserLicenseManagement;
