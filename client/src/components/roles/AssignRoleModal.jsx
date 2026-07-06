import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  UserPlus,
  Users,
  Shield,
  Check,
  X,
  Edit2,
  AlertCircle
} from "lucide-react";

export function AssignRoleModal({ isOpen, onClose, users = [], roles = [] }) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Assign role mutation
  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, roleId }) => {
      const response = await fetch(`/api/users/${userId}/assign-role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId })
      });
      if (!response.ok) throw new Error("Failed to assign role");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(["/api/users"]);
      queryClient.invalidateQueries(["/api/roles"]);
      setSelectedUserId("");
      setSelectedRoleId("");
      toast({
        title: "Role assigned successfully",
        description: `User role has been updated.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to assign role",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Remove role mutation
  const removeRoleMutation = useMutation({
    mutationFn: async (userId) => {
      const response = await fetch(`/api/users/${userId}/remove-role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) throw new Error("Failed to remove role");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/users"]);
      queryClient.invalidateQueries(["/api/roles"]);
      toast({
        title: "Role removed successfully",
        description: "User role has been removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to remove role",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleAssignRole = () => {
    if (!selectedUserId || !selectedRoleId) {
      toast({
        title: "Selection required",
        description: "Please select both a user and a role.",
        variant: "destructive",
      });
      return;
    }

    assignRoleMutation.mutate({
      userId: selectedUserId,
      roleId: selectedRoleId
    });
  };

  const handleRemoveRole = (userId) => {
    if (confirm("Are you sure you want to remove this user's role?")) {
      removeRoleMutation.mutate(userId);
    }
  };

  const getRoleName = (roleId) => {
    const role = roles.find(r => r._id === roleId);
    return role ? role.name : "No Role";
  };

  const getRoleColor = (roleId) => {
    if (!roleId) return "bg-slate-100 text-slate-700";

    const role = roles.find(r => r._id === roleId);
    if (!role) return "bg-slate-100 text-slate-700";

    // Color roles based on permission count
    const permissionCount = role.permissions?.length || 0;
    if (permissionCount > 10) return "bg-green-100 text-green-700";
    if (permissionCount > 5) return "bg-blue-100 text-blue-700";
    if (permissionCount > 0) return "bg-blue-100 text-blue-700";
    return "bg-slate-100 text-slate-700";
  };

  const usersWithRoles = users.map(user => ({
    ...user,
    roleName: getRoleName(user.roleId),
    roleColor: getRoleColor(user.roleId)
  }));

  const availableUsers = users.filter(user => !user.roleId);
  const usersWithAssignedRoles = users.filter(user => user.roleId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-4 pb-4">
          <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
            <UserPlus className="h-6 w-6 mr-2 text-blue-600" />
            Assign Roles to Users
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 p-4 space-y-3">
          {/* Assign New Role */}
          <Card className="border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
                Assign New Role
              </CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Select a user and assign them a role
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Select User
                  </Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="border-slate-300">
                      <SelectValue placeholder="Choose a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.length === 0 ? (
                        <SelectItem value="none" disabled>No users available</SelectItem>
                      ) : (
                        users.map((user) => (
                          <SelectItem key={user._id} value={user._id}>
                            <div className="flex items-center space-x-2">
                              <span>{user.firstName} {user.lastName}</span>
                              {user.roleId && (
                                <Badge variant="outline" className="text-xs">
                                  Has role
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Select Role
                  </Label>
                  <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                    <SelectTrigger className="border-slate-300">
                      <SelectValue placeholder="Choose a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.length === 0 ? (
                        <SelectItem value="none" disabled>No roles available</SelectItem>
                      ) : (
                        roles.map((role) => (
                          <SelectItem key={role._id} value={role._id}>
                            <div className="flex items-center space-x-2">
                              <Shield className="h-4 w-4 text-blue-600" />
                              <span>{role.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {role.permissions?.length || 0} permissions
                              </Badge>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {availableUsers.length} users without roles • {usersWithAssignedRoles.length} users with roles
                </div>
                <Button
                  onClick={handleAssignRole}
                  disabled={!selectedUserId || !selectedRoleId || assignRoleMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {assignRoleMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Assigning...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Assign Role
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Current Role Assignments */}
          <Card className="border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white flex items-center">
                <Users className="h-5 w-5 mr-2 text-green-600" />
                Current Role Assignments
              </CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Manage existing user role assignments
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200 dark:border-slate-700">
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300">User</TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Email</TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Current Role</TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersWithRoles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8">
                          <div className="flex flex-col items-center space-y-3">
                            <AlertCircle className="h-8 w-8 text-slate-400" />
                            <p className="text-slate-500 dark:text-slate-400">No users found</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      usersWithRoles.map((user) => (
                        <TableRow key={user._id} className="border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <TableCell className="font-medium text-slate-900 dark:text-white">
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                  {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                                </span>
                              </div>
                              <span>{user.firstName} {user.lastName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-600 dark:text-slate-300">
                            {user.email}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`${user.roleColor} border-0`}
                            >
                              {user.roleName}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedUserId(user._id);
                                  setSelectedRoleId(user.roleId || "");
                                }}
                                className="hover:bg-blue-50 hover:text-blue-700 border-slate-300"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              {user.roleId && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRemoveRole(user._id)}
                                  disabled={removeRoleMutation.isPending}
                                  className="hover:bg-red-50 hover:text-red-700 border-slate-300"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end space-x-3 p-4 border-t border-slate-200 dark:border-slate-700">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-slate-300"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}