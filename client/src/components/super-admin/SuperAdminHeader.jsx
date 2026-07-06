import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronRight, LogOut, User, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInitials } from "@/lib/utils";
import { Link } from "wouter";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useAuthStore } from "../../stores/useAuthStore";
export default function SuperAdminHeader() {
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const { setUser, logout } = useAuthStore();
  const queryClient = useQueryClient();
  
  const { data: authUser } = useQuery({
    queryKey: ["/api/auth/verify"],
  });

  const { data: profileUser } = useQuery({
    queryKey: ["/api/profile"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Merge profile data with auth data
  const user = {
    ...authUser,
    ...profileUser, // Profile data takes higher priority
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem("token");
      logout();
      queryClient.clear();
      setLocation("/login");
    } catch (error) {
      console.error("Logout error:", error);
      // Force logout even if API call fails
      localStorage.removeItem("token");
      logout();
      queryClient.clear();
      setLocation("/login");
    }
  };

  const getUserFullName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user?.firstName) {
      return user.firstName;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'Super Admin';
  };

  const getBreadcrumbPath = () => {
    const path = location.toLowerCase();
    if (path === '/super-admin' || path === '/') return 'Dashboard';
    if (path.includes('/companies')) return 'Companies Management';
    if (path.includes('/users')) return 'Users Management';
    if (path.includes('/logs')) return 'System Logs';
    if (path.includes('/admins')) return 'Admin Management';
    if (path.includes('/analytics')) return 'Platform Analytics';
    if (path.includes('/settings')) return 'System Settings';
    if (path.includes('/login-customization')) return 'Login Customization';
    return 'Dashboard';
  };

  return (
    <header className="bg-white border-b border-gray-200 h-12 flex items-center justify-between px-4">
      {/* Left side - Branding and user name */}
      <div className="flex flex-col">
        {/* <h1 className="text-sm font-semibold text-gray-900">TaskSetu</h1>
        <span className="text-xs text-gray-600">{getUserFullName()}</span> */}
      </div>

      {/* Right side - User menu */}
      <div className="flex items-center space-x-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full focus:outline-none focus:ring-0 focus:ring-offset-0">
              <UserAvatar
                user={user}
                size="sm"
                className="h-6 w-6"
              />
            </Button>
            
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-slate-50">
            <div className="px-2 py-1.5 text-xs text-gray-500">
              Signed in as {getUserFullName()}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer hover:bg-gray-50">
              <Link href="/super-admin/edit-profile" className="flex items-center gap-2">
                <User className="h-3 w-3" />
                <span className="text-xs">Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer hover:bg-gray-50">
              <Link href="/super-admin/settings" className="flex gap-2">
                <Settings className="h-3 w-3 mr-2" />
                <span className="text-xs">Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-red-600 focus:text-red-600 cursor-pointer hover:bg-red-50"
            >
              <LogOut className="h-3 w-3 mr-2" />
              <span className="text-xs">Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}