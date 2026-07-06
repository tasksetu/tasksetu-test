import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  CreditCard,
  MoreHorizontal,
  UserCheck,
  UserX,
  RefreshCw,
  Crown,
  Shield,
  User,
  Mail,
  AlertCircle,
  CheckCircle,
  Clock,
  Settings,
  Trash2,
  UserPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { AddUserModal } from "@/components/InviteUsersModal";

export default function UserManagement() {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get organization license info
  const { data: licenseInfo, isLoading: licenseLoading } = useQuery({
    queryKey: ["/api/organization/license"],
  });

  // Get organization users with periodic refresh to catch registration completions
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/organization/users-detailed"],
    refetchInterval: 30000, // Refresh every 30 seconds to catch status changes
    refetchIntervalInBackground: true,
  });

  // Deactivate user mutation
  const deactivateUserMutation = useMutation({
    mutationFn: async (userId) => {
      const response = await fetch(`/api/organization/users/${userId}/deactivate`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to deactivate user");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User deactivated successfully",
        description: "User has been deactivated and removed from active access",
        className: "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-lg",
        duration: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/organization/users-detailed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organization/license"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to deactivate user",
        description: error.message,
        variant: "destructive",
        className: "border-red-200 bg-red-50 text-red-800 shadow-lg",
        duration: 6000,
      });
    },
  });

  // Resend invite mutation
  const resendInviteMutation = useMutation({
    mutationFn: async (userId) => {
      const response = await fetch(`/api/organization/users/${userId}/resend-invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to resend invite");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation resent successfully",
        description: "Invitation email has been resent to the user",
        className: "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-lg",
        duration: 5000,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to resend invitation",
        description: error.message,
        variant: "destructive",
        className: "border-red-200 bg-red-50 text-red-800 shadow-lg",
        duration: 6000,
      });
    },
  });

  // Get status badge
  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case "active":
        return <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case "invited":
        return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200"><Mail className="h-3 w-3 mr-1" />Invited</Badge>;
      case "pending":
        return <Badge variant="secondary" className="bg-slate-50 text-slate-700 border-slate-200"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "inactive":
      case "deactivated":
        return <Badge variant="secondary" className="bg-gray-50 text-gray-700 border-gray-200"><UserX className="h-3 w-3 mr-1" />Inactive</Badge>;
      default:
        return <Badge variant="secondary">{status || "Unknown"}</Badge>;
    }
  };

  // Get role icon
  const getRoleIcon = (role) => {
    switch (role?.toLowerCase()) {
      case "admin":
      case "org_admin":
        return <Shield className="h-3 w-3 text-slate-600" />;
      case "manager":
        return <Crown className="h-3 w-3 text-slate-600" />;
      case "member":
        return <User className="h-3 w-3 text-gray-500" />;
      default:
        return <User className="h-3 w-3 text-gray-500" />;
    }
  };

  // Format roles display
  const formatRoles = (userRoles) => {
    if (!userRoles || !Array.isArray(userRoles)) {
      return [userRoles || "member"];
    }
    return userRoles;
  };

  if (licenseLoading || usersLoading) {
    return (
      <div className="space-y-3">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management & Subscription</h1>
          <p className="text-lg text-gray-600 mt-2">
            Manage your organization's users and license usage
          </p>
        </div>
        <Button
          onClick={() => setIsInviteModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Users
        </Button>
      </div>

      {/* License Summary Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Licenses</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{licenseInfo?.totalLicenses || 0}</div>
            <p className="text-xs text-muted-foreground">
              {licenseInfo?.planType || "Basic"} Plan
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Used Licenses</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{licenseInfo?.usedLicenses || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Licenses</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{licenseInfo?.availableSlots || 0}</div>
            <p className="text-xs text-muted-foreground">
              Can invite more
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usage</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {licenseInfo?.totalLicenses ? Math.round((licenseInfo.usedLicenses / licenseInfo.totalLicenses) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              License utilization
            </p>
          </CardContent>
        </Card>
      </div>

      {/* User Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Organization Users</span>
          </CardTitle>
          <CardDescription>
            Manage users, their roles, and access permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-lg font-medium">No users found</p>
              <p className="text-sm">Start by inviting your first team member</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role(s)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invited By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user._id || user.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-gray-100 rounded-full">
                          {getRoleIcon(user.role)}
                        </div>
                        <div>
                          <div className="font-medium">
                            {user.firstName && user.lastName
                              ? `${user.firstName} ${user.lastName}`
                              : user.status === 'invited'
                                ? 'Invitation Pending'
                                : 'User'
                            }
                          </div>
                          {user.status === 'invited' && user.invitedAt && (
                            <div className="text-xs text-slate-500">
                              Invited: {new Date(user.invitedAt).toLocaleDateString()}
                            </div>
                          )}
                          {user.lastLoginAt && user.status === 'active' && (
                            <div className="text-xs text-slate-500">
                              Last active: {new Date(user.lastLoginAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Mail className="h-3 w-3 text-gray-400" />
                        <span>{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {formatRoles(user.roles || [user.role]).map((role, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {getRoleIcon(role)}
                            <span className="ml-1 capitalize">{role}</span>
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(user.status)}
                    </TableCell>
                    <TableCell>
                      {user.invitedBy ? (
                        <div className="text-sm">
                          <div className="font-medium">
                            {user.invitedBy.firstName} {user.invitedBy.lastName}
                          </div>
                          <div className="text-xs text-slate-500">
                            {user.invitedBy.email}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {user.status === "invited" && (
                            <DropdownMenuItem
                              onClick={() => resendInviteMutation.mutate(user._id || user.id)}
                              disabled={resendInviteMutation.isPending}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Resend Invite
                            </DropdownMenuItem>
                          )}
                          {user.status === "active" && (
                            <DropdownMenuItem
                              onClick={() => deactivateUserMutation.mutate(user._id || user.id)}
                              disabled={deactivateUserMutation.isPending}
                              className="text-red-600"
                            >
                              <UserX className="h-4 w-4 mr-2" />
                              Deactivate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invite Users Modal */}
      <AddUserModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
    </div>
  );
}