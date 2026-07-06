import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'wouter';

export function RoleProtectedRoute({ children, allowedRoles = [], redirectTo = '/login' }) {
  const [location, navigate] = useLocation();
  const [authState, setAuthState] = useState({
    isAuthorized: false,
    isLoading: true
  });
  const hasCheckedRef = useRef(false);
  const allowedRolesRef = useRef(allowedRoles.join(','));

  useEffect(() => {
    // Only check auth once on mount
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    const checkAuth = () => {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      
      if (!token || !userStr) {
        setAuthState({
          isAuthorized: false,
          isLoading: false
        });
        navigate('/login', { replace: true });
        return;
      }

      try {
        const user = JSON.parse(userStr);
        
        console.log('RoleProtectedRoute - User:', user);
        console.log('RoleProtectedRoute - Allowed Roles:', allowedRoles);
        
        // Handle role as both string and array
        const userRole = Array.isArray(user.role) ? user.role[0] : user.role;
        
        // Normalize roles for comparison (handle both superadmin and super_admin)
        const normalizedUserRole = userRole === 'superadmin' ? 'super_admin' : userRole;
        const normalizedAllowedRoles = allowedRoles.map(role => 
          role === 'superadmin' ? 'super_admin' : role
        );
        
        console.log('RoleProtectedRoute - User Role (extracted):', userRole);
        console.log('RoleProtectedRoute - Normalized User Role:', normalizedUserRole);
        console.log('RoleProtectedRoute - Normalized Allowed Roles:', normalizedAllowedRoles);
        
        if (allowedRoles.length === 0 || normalizedAllowedRoles.includes(normalizedUserRole)) {
          console.log('RoleProtectedRoute - Access GRANTED');
          setAuthState({
            isAuthorized: true,
            isLoading: false
          });
        } else {
          console.log('RoleProtectedRoute - Access DENIED, redirecting...');
          // Redirect based on user's actual role
          const redirectMap = {
            'superadmin': '/superadmin',
            'super_admin': '/superadmin',
            'admin': '/dashboard',
            'employee': '/dashboard'
          };
          
          setAuthState({
            isAuthorized: false,
            isLoading: false
          });
          navigate(redirectMap[userRole] || '/dashboard', { replace: true });
        }
      } catch (error) {
        console.error('Invalid user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setAuthState({
          isAuthorized: false,
          isLoading: false
        });
        navigate('/login', { replace: true });
      }
    };

    checkAuth();
  }, []); // Empty dependency array - only run once on mount

  if (authState.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-gray-600 dark:text-gray-300">Verifying access...</p>
      </div>
    );
  }

  return authState.isAuthorized ? children : null;
}

export function RequireSuperAdmin({ children }) {
  return (
    <RoleProtectedRoute allowedRoles={['superadmin', 'super_admin']}>
      {children}
    </RoleProtectedRoute>
  );
}

export function RequireAdmin({ children }) {
  return (
    <RoleProtectedRoute allowedRoles={['superadmin', 'super_admin', 'admin']}>
      {children}
    </RoleProtectedRoute>
  );
}

export function RequireEmployee({ children }) {
  return (
    <RoleProtectedRoute allowedRoles={['superadmin', 'super_admin', 'admin', 'employee']}>
      {children}
    </RoleProtectedRoute>
  );
}