import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { isAuthenticated, getAuthUser, refreshToken } from '@/utils/auth';
import { useQueryClient } from '@tanstack/react-query';

export default function AuthWrapper({ children }) {
  const [authReady, setAuthReady] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    const checkAuth = async () => {
      // Check if user is authenticated
      if (!isAuthenticated()) {
        // Redirect to login page
        setLocation('/login');
        return;
      }

      // Try to refresh token if needed
      const user = getAuthUser();
      if (user) {
        try {
          await refreshToken();
        } catch (error) {
          console.error('Token refresh failed, redirecting to login');
          setLocation('/login');
          return;
        }
      }

      setAuthReady(true);
    };

    checkAuth();
  }, [setLocation]);

  // Show loading while checking authentication
  if (!authReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Checking authentication...</div>
      </div>
    );
  }

  return children;
}