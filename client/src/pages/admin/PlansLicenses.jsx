import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CreditCard,
  Users,
  CheckCircle,
  Clock,
  UserX,
  Mail,
  MoreHorizontal,
  RefreshCw,
  Shield,
  User,
  Crown,
  Building2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function PlansLicenses() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get organization license information
  const { data: licenseInfo, isLoading: licenseLoading } = useQuery({
    queryKey: ["/api/organization/license"],
  });

  // Get detailed user information for license assignments
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/organization/users-detailed"],
  });

  // Resend invite mutation
  const resendInviteMutation = useMutation({
    mutationFn: async (userId) => {
      return apiRequest(`/api/organization/resend-invite/${userId}`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Invitation resent successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/organization/users-detailed"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resend invitation",
        variant: "destructive",
      });
    },
  });

  // Deactivate user mutation
  const deactivateUserMutation = useMutation({
    mutationFn: async (userId) => {
      return apiRequest(`/api/organization/deactivate-user/${userId}`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User deactivated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/organization/users-detailed"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to deactivate user",
        variant: "destructive",
      });
    },
  });

  // Calculate license usage statistics
  const getUsageStats = () => {
    if (!licenseInfo) return { used: 0, available: 0, total: 0, percentage: 0 };

    const total = licenseInfo.totalLicenses || 0;
    const used = licenseInfo.usedLicenses || 0;
    const available = total - used;
    const percentage = total > 0 ? Math.round((used / total) * 100) : 0;

    return { used, available, total, percentage };
  };

  const usageStats = getUsageStats();

  // Get role icon
  const getRoleIcon = (role) => {
    switch (role?.toLowerCase()) {
      case "org_admin":
      case "admin":
        return <Crown className="h-4 w-4 text-orange-600" />;
      case "manager":
        return <Shield className="h-4 w-4 text-blue-600" />;
      case "employee":
        return <User className="h-4 w-4 text-green-600" />;
      case "member":
        return <User className="h-4 w-4 text-gray-600" />;
      default:
        return <User className="h-4 w-4 text-gray-400" />;
    }
  };

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

  // Format roles for display
  const formatRoles = (roles) => {
    if (!roles || roles.length === 0) return ["member"];
    return Array.isArray(roles) ? roles : [roles];
  };

  if (licenseLoading || usersLoading) {
    return (
      <div className="space-y-3 p-4">
        <div className="animate-pulse">
          <div className="h-8 w-64 bg-gray-200 rounded mb-3"></div>
          <div className="grid gap-3 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Plans & Licenses</h1>
          <p className="text-lg text-gray-600 mt-2">
            Manage your organization's license allocation and user assignments
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          <span className="text-sm font-medium text-gray-700">
            {licenseInfo?.organizationName || "Organization"}
          </span>
        </div>
      </div>

      {/* License Summary Cards */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usageStats.used}</div>
            <p className="text-xs text-muted-foreground">
              Currently using licenses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Licenses</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usageStats.total}</div>
            <p className="text-xs text-muted-foreground">
              Available for your organization
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plan Type</CardTitle>
            <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
              <Crown className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{licenseInfo?.planType || "Standard"}</div>
            <p className="text-xs text-muted-foreground">
              Current subscription
            </p>
          </CardContent>
        </Card>
      </div>

      {/* License Usage Progress */}
      <Card>
        <CardHeader>
          <CardTitle>License Usage</CardTitle>
          <CardDescription>
            Current license allocation across your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Used: {usageStats.used}</span>
              <span>Total: {usageStats.total}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${usageStats.percentage}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>{usageStats.percentage}% utilized</span>
              <span>{usageStats.available} remaining</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User License Assignments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>License Assignments</span>
          </CardTitle>
          <CardDescription>
            All users with assigned licenses in your organization
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
                        {formatRoles(user.roles?.length ? user.roles : (Array.isArray(user.role) ? user.role : [user.role])).map((role, index) => (
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
    </div>
  );
}