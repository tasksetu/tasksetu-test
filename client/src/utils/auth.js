import { useQuery } from "@tanstack/react-query";
import { jwtDecode } from "jwt-decode";
// Authentication utilities for the frontend
export const setAuthToken = (token, user) => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));

  // Dispatch custom event to trigger inactivity timer restart
  window.dispatchEvent(new CustomEvent('auth-change', {
    detail: { type: 'login', user }
  }));
};

export const getAuthToken = () => {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
};

export const getAuthUser = () => {
  const user = localStorage.getItem('user') || sessionStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

export const clearAuth = () => {
  console.log('[AUTH] Inactivity logout - Clearing all sensitive data');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('email');
  localStorage.removeItem('role');
  localStorage.removeItem('activeRole');
  localStorage.removeItem('lastResetEmail');
  localStorage.removeItem('organizationId');
  localStorage.removeItem('tokenExpiry');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('email');
  sessionStorage.removeItem('role');
  sessionStorage.removeItem('activeRole');
  sessionStorage.removeItem('lastResetEmail');
  sessionStorage.removeItem('organizationId');
  sessionStorage.removeItem('tasksetu_session_active');
  window.dispatchEvent(new CustomEvent('auth-cleared', {
    detail: { type: 'logout', timestamp: new Date() }
  }));
};

export const isAuthenticated = () => {
  const token = getAuthToken();
  const user = getAuthUser();
  return !!(token && user);
};
// activeRole and roles
export const useUserRole = () => {
  const token = localStorage.getItem("token");

  // Safely decode token only if present and valid
  let orgId = undefined;
  if (token) {
    try {
      const decoded = jwtDecode(token);
      // Try different possible field names for organization ID
      orgId = decoded?.organizationId || decoded?.organization_id || decoded?.organization;
      console.log('Decoded token orgId:', orgId, 'from token:', decoded);
    } catch (e) {
      console.warn("Invalid or undecodable token detected in useUserRole.");
    }
  }
  const query = useQuery({
    queryKey: ["/api/auth/verify"],
    enabled: !!token, // Only run query if token exists
    queryFn: async ({ queryKey }) => {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) return null;

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const res = await fetch(queryKey[0], {
        headers,
        credentials: "include",
      });

      if (res.status === 401 || res.status === 403) {
        clearAuth();
        return null;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Extract user data from response - API returns { success, data: {...} }
  const responseData = query.data;
  const user = responseData?.data || responseData;

  // Debug: log user data to see what's available
  if (user) {
    console.log('Auth verify response user data:', user);
    // Also try to get orgId from the user response if not from token
    if (!orgId && user) {
      orgId = user.organizationId || user.organization_id || user.organization;
      console.log('Using orgId from user data:', orgId);
    }
  }

  // Normalize roles for checks (support string or array)
  const rolesArr = Array.isArray(user?.role)
    ? user?.role
    : user?.role
      ? [user.role]
      : [];
  const isAdmin =
    user?.activeRole === "org_admin" ||
    rolesArr.includes("individual") ||
    rolesArr.includes("org_admin");

  return { ...query, user, isAdmin, orgId };
};

// Check if the user has a specific role
export const hasAccess = (requiredRoles = []) => {
  const { user } = useUserRole();

  if (!user) return false;

  // Case 1: User has multiple roles → check activeRole 
  if (Array.isArray(user.role) && user.role.length > 1) {
    return requiredRoles.includes(user.activeRole);
  }

  // Case 2: User has exactly one role
  if (Array.isArray(user.role) && user.role.length === 1) {
    return requiredRoles.includes(user.role[0]);
  }

  return false;
};


// Login function to authenticate with real user credentials
export const login = async (email, password) => {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (response.ok) {
      const { token, user } = await response.json();
      setAuthToken(token, user);
      return { success: true, user };
    } else {
      const error = await response.json();
      return { success: false, error: error.message };
    }
  } catch (error) {
    return { success: false, error: 'Login failed' };
  }
};

// Refresh token to maintain authentication
export const refreshToken = async () => {
  const currentToken = getAuthToken();
  if (!currentToken) return null;

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${currentToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const { token, user } = await response.json();
      setAuthToken(token, user);
      return token;
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
    clearAuth();
  }
  return null;
};