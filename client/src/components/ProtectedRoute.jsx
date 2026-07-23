import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function ProtectedRoute({
  children,
  requiredRole = null,
  allowedRoles = [],
}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          setIsAuthenticated(true);

          // Normalize role for comparison (handle both superadmin and super_admin)
          const normalizedUserRole =
            userData.role === "superadmin" ? "super_admin" : userData.role;
          const normalizedRequiredRole =
            requiredRole === "superadmin" ? "super_admin" : requiredRole;
          const normalizedAllowedRoles = allowedRoles.map((role) =>
            role === "superadmin" ? "super_admin" : role,
          );

          // Check role authorization
          if (requiredRole && normalizedUserRole !== normalizedRequiredRole) {
            toast({
              title: "Access Denied",
              description: "You don't have permission to access this page",
              variant: "destructive",
            });
            if (
              userData.role === "super_admin" ||
              userData.role === "superadmin"
            ) {
              setLocation("/superadmin");
            } else {
              setLocation("/dashboard");
            }
            return;
          }

          if (
            allowedRoles.length > 0 &&
            !normalizedAllowedRoles.includes(normalizedUserRole)
          ) {
            toast({
              title: "Access Denied",
              description: "You don't have permission to access this page",
              variant: "destructive",
            });
            if (
              userData.role === "super_admin" ||
              userData.role === "superadmin"
            ) {
              setLocation("/superadmin");
            } else {
              setLocation("/dashboard");
            }
            return;
          }
        } else {
          // Invalid token
          localStorage.removeItem("token");
          toast({
            title: "Session Expired",
            description: "Please log in again",
            variant: "destructive",
          });
          setLocation("/login");
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        localStorage.removeItem("token");
        setLocation("/login");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [requiredRole, allowedRoles, setLocation, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return children;
}
