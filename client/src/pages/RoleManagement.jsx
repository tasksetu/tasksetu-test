import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  Users,
  Check,
  X,
  Save,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import ConfirmDialog from "@/components/common/ConfirmDialog";

export function RoleManagement() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [deleteRoleConfirm, setDeleteRoleConfirm] = useState({
    isOpen: false,
    roleId: null,
  });
  const [newRole, setNewRole] = useState({
    name: "",
    description: "",
    permissions: [],
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get roles
  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["/api/roles"],
  });

  // Get organization users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/organization/users-detailed"],
  });

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (roleData) => {
      const response = await fetch("/api/roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(roleData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create role");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Role created successfully",
        description: "The new role has been created and is ready to use",
      });
      setIsCreateModalOpen(false);
      setNewRole({ name: "", description: "", permissions: [] });
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to create role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, ...roleData }) => {
      const response = await fetch(`/api/roles/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(roleData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update role");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Role updated successfully",
        description: "The role has been updated",
      });
      setEditingRole(null);
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to update role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId) => {
      const response = await fetch(`/api/roles/${roleId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete role");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Role deleted successfully",
        description: "The role has been removed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Assign role mutation
  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, roleId }) => {
      const response = await fetch("/api/roles/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ userId, roleId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to assign role");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Role assigned successfully",
        description: "The user's role has been updated",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/organization/users-detailed"],
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to assign role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const availablePermissions = [
    "read_tasks",
    "create_tasks",
    "edit_tasks",
    "delete_tasks",
    "read_projects",
    "create_projects",
    "edit_projects",
    "delete_projects",
    "read_users",
    "invite_users",
    "edit_users",
    "delete_users",
    "read_reports",
    "create_reports",
    "edit_reports",
    "delete_reports",
  ];

  const handleCreateRole = (e) => {
    e.preventDefault();
    if (!newRole.name.trim()) {
      toast({
        title: "Role name required",
        description: "Please enter a name for the role",
        variant: "destructive",
      });
      return;
    }
    createRoleMutation.mutate(newRole);
  };

  const handleUpdateRole = (role) => {
    updateRoleMutation.mutate(role);
  };

  const handleDeleteRole = (roleId) => {
    setDeleteRoleConfirm({ isOpen: true, roleId });
  };

  const handleAssignRole = (userId, roleId) => {
    assignRoleMutation.mutate({ userId, roleId });
  };

  const togglePermission = (permission, isNewRole = false) => {
    if (isNewRole) {
      const permissions = newRole.permissions.includes(permission)
        ? newRole.permissions.filter((p) => p !== permission)
        : [...newRole.permissions, permission];
      setNewRole({ ...newRole, permissions });
    } else if (editingRole) {
      const permissions = editingRole.permissions.includes(permission)
        ? editingRole.permissions.filter((p) => p !== permission)
        : [...editingRole.permissions, permission];
      setEditingRole({ ...editingRole, permissions });
    }
  };

  if (rolesLoading || usersLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-gray-700 rounded w-1/4"></div>
          <div className="h-32 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black">Role Management</h1>
          <p className="text-gray-600 mt-1">
            Manage roles and permissions for your organization
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center h-9"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      </div>

      {/* Roles List */}
      <div className="bg-gray-100 rounded-sm border border-gray-200">
        <div className="p-4">
          <h3 className="text-lg font-medium text-gray-100 mb-3">
            Organization Roles
          </h3>

          {roles.length === 0 ? (
            <div className="text-center py-8 text-black">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No custom roles created yet</p>
              <p className="text-sm text-black">
                Create your first role to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {roles.map((role) => (
                <div
                  key={role._id}
                  className="border border-gray-600 rounded-sm p-4"
                >
                  {editingRole && editingRole._id === role._id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Role Name
                          </label>
                          <input
                            type="text"
                            value={editingRole.name}
                            onChange={(e) =>
                              setEditingRole({
                                ...editingRole,
                                name: e.target.value,
                              })
                            }
                            className="w-full h-9 px-3 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Description
                          </label>
                          <input
                            type="text"
                            value={editingRole.description}
                            onChange={(e) =>
                              setEditingRole({
                                ...editingRole,
                                description: e.target.value,
                              })
                            }
                            className="w-full h-9 px-3 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Permissions
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {availablePermissions.map((permission) => (
                            <label
                              key={permission}
                              className="flex items-center space-x-2 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={editingRole.permissions.includes(
                                  permission,
                                )}
                                onChange={() => togglePermission(permission)}
                                className="rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                              />
                              <span className="text-sm text-gray-300">
                                {permission.replace(/_/g, " ")}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingRole(null)}
                          className="h-9 w-9"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="primary"
                          size="icon"
                          onClick={() => handleUpdateRole(editingRole)}
                          disabled={updateRoleMutation.isPending}
                          className="h-9 w-9"
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-100">
                          {role.name}
                        </h4>
                        <p className="text-sm text-gray-400">
                          {role.description}
                        </p>
                        <div className="mt-2">
                          <span className="text-xs text-gray-500">
                            {role.permissions?.length || 0} permissions
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingRole(role)}
                          className="h-9 w-9 text-gray-400 hover:text-blue-400"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRole(role._id)}
                          disabled={deleteRoleMutation.isPending}
                          className="h-9 w-9 text-gray-400 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* User Role Assignments */}
      <div className="bg-gray-100 rounded-sm border border-gray-200">
        <div className="p-4">
          <h3 className="text-lg font-medium text-black mb-3">
            User Role Assignments
          </h3>

          {users.length === 0 ? (
            <div className="text-center py-8 text-black">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No users found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user._id}
                  className="flex items-center justify-between p-3 border border-gray-600 rounded-sm"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <UserCog className="h-4 w-4 text-gray-300" />
                    </div>
                    <div>
                      <p className="font-medium text-black">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-sm text-black">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <select
                      value={user.role || "employee"}
                      onChange={(e) => {
                        const roleId =
                          e.target.value === "employee" ||
                          e.target.value === "org_admin"
                            ? e.target.value
                            : roles.find((r) => r.name === e.target.value)?._id;
                        if (roleId) {
                          handleAssignRole(user._id, roleId);
                        }
                      }}
                      disabled={assignRoleMutation.isPending}
                      className="px-3 py-1 bg-gray-700 border border-gray-600 rounded-md text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="employee">Employee</option>
                      <option value="org_admin">Admin</option>
                      {roles.map((role) => (
                        <option key={role._id} value={role.name}>
                          {role.name}
                        </option>
                      ))}
                    </select>

                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        user.isActive
                          ? "bg-green-900 text-green-300"
                          : "bg-red-900 text-red-300"
                      }`}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Role Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-sm border border-gray-700 w-full max-w-2xl mx-4">
            <div className="p-4">
              <h2 className="text-xl font-bold text-gray-100 mb-3">
                Create New Role
              </h2>

              <form onSubmit={handleCreateRole} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Role Name *
                    </label>
                    <input
                      type="text"
                      value={newRole.name}
                      onChange={(e) =>
                        setNewRole({ ...newRole, name: e.target.value })
                      }
                      className="w-full h-9 px-3 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description
                    </label>
                    <input
                      type="text"
                      value={newRole.description}
                      onChange={(e) =>
                        setNewRole({ ...newRole, description: e.target.value })
                      }
                      className="w-full h-9 px-3 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Permissions
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {availablePermissions.map((permission) => (
                      <label
                        key={permission}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={newRole.permissions.includes(permission)}
                          onChange={() => togglePermission(permission, true)}
                          className="rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                        />
                        <span className="text-sm text-gray-300">
                          {permission.replace(/_/g, " ")}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setNewRole({
                        name: "",
                        description: "",
                        permissions: [],
                      });
                    }}
                    className="h-9"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={createRoleMutation.isPending}
                    className="flex items-center h-9"
                  >
                    {createRoleMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Create Role
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Role Confirmation */}
      <ConfirmDialog
        isOpen={deleteRoleConfirm.isOpen}
        title="Delete Role?"
        description="Are you sure you want to delete this role? Users with this role will need to be reassigned."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        onCancel={() => setDeleteRoleConfirm({ isOpen: false, roleId: null })}
        onConfirm={() => {
          deleteRoleMutation.mutate(deleteRoleConfirm.roleId);
          setDeleteRoleConfirm({ isOpen: false, roleId: null });
        }}
      />
    </div>
  );
}
