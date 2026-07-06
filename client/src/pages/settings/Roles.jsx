import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Shield,
  Users,
  Plus,
  Edit,
  Trash2,
  Settings,
  Lock,
  Eye,
  Database,
  Mail,
  Calendar,
} from "lucide-react";

export default function Roles() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: [],
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch roles
  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["/api/roles"],
    enabled: true,
  });

  // Available permissions
  const availablePermissions = [
    {
      id: "users.view",
      name: "View Users",
      description: "Can view user profiles and information",
      category: "User Management",
      icon: Eye,
    },
    {
      id: "users.create",
      name: "Create Users",
      description: "Can invite and create new users",
      category: "User Management",
      icon: Plus,
    },
    {
      id: "users.edit",
      name: "Edit Users",
      description: "Can modify user information and roles",
      category: "User Management",
      icon: Edit,
    },
    {
      id: "users.delete",
      name: "Delete Users",
      description: "Can remove users from organization",
      category: "User Management",
      icon: Trash2,
    },
    {
      id: "projects.view",
      name: "View Projects",
      description: "Can view project details and status",
      category: "Project Management",
      icon: Eye,
    },
    {
      id: "projects.create",
      name: "Create Projects",
      description: "Can create new projects",
      category: "Project Management",
      icon: Plus,
    },
    {
      id: "projects.edit",
      name: "Edit Projects",
      description: "Can modify project information",
      category: "Project Management",
      icon: Edit,
    },
    {
      id: "projects.delete",
      name: "Delete Projects",
      description: "Can archive or delete projects",
      category: "Project Management",
      icon: Trash2,
    },
    {
      id: "tasks.view",
      name: "View Tasks",
      description: "Can view task details and assignments",
      category: "Task Management",
      icon: Eye,
    },
    {
      id: "tasks.create",
      name: "Create Tasks",
      description: "Can create new tasks",
      category: "Task Management",
      icon: Plus,
    },
    {
      id: "tasks.edit",
      name: "Edit Tasks",
      description: "Can modify task information",
      category: "Task Management",
      icon: Edit,
    },
    {
      id: "tasks.assign",
      name: "Assign Tasks",
      description: "Can assign tasks to team members",
      category: "Task Management",
      icon: Users,
    },
    {
      id: "settings.view",
      name: "View Settings",
      description: "Can access organization settings",
      category: "Administration",
      icon: Settings,
    },
    {
      id: "settings.edit",
      name: "Edit Settings",
      description: "Can modify organization settings",
      category: "Administration",
      icon: Edit,
    },
    {
      id: "reports.view",
      name: "View Reports",
      description: "Can access analytics and reports",
      category: "Reporting",
      icon: Database,
    },
    {
      id: "integrations.manage",
      name: "Manage Integrations",
      description: "Can configure external integrations",
      category: "Administration",
      icon: Settings,
    },
  ];

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: (data) => apiRequest("POST", "/api/roles", data),
    onSuccess: () => {
      setCreateModalOpen(false);
      setFormData({ name: "", description: "", permissions: [] });
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      toast({
        title: "Success",
        description: "Role created successfully",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create role",
        variant: "destructive",
      });
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }) => apiRequest("PUT", `/api/roles/${id}`, data),
    onSuccess: () => {
      setEditModalOpen(false);
      setSelectedRole(null);
      setFormData({ name: "", description: "", permissions: [] });
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      toast({
        title: "Success",
        description: "Role updated successfully",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePermissionChange = (permissionId, checked) => {
    setFormData((prev) => ({
      ...prev,
      permissions: checked
        ? [...prev.permissions, permissionId]
        : prev.permissions.filter((p) => p !== permissionId),
    }));
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    createRoleMutation.mutate(formData);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    updateRoleMutation.mutate({ id: selectedRole._id, data: formData });
  };

  const openEditModal = (role) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description,
      permissions: role.permissions || [],
    });
    setEditModalOpen(true);
  };

  const getPermissionsByCategory = () => {
    const categories = {};
    availablePermissions.forEach((permission) => {
      if (!categories[permission.category]) {
        categories[permission.category] = [];
      }
      categories[permission.category].push(permission);
    });
    return categories;
  };

  const getRoleColor = (roleName) => {
    const colors = {
      admin: "bg-red-100 text-red-700 border-red-200",
      manager: "bg-purple-100 text-purple-700 border-purple-200",
      member: "bg-blue-100 text-blue-700 border-blue-200",
      default: "bg-gray-100 text-gray-700 border-gray-200",
    };
    return colors[roleName.toLowerCase()] || colors.default;
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="mb-8 border-b border-gray-200 pb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Roles & Permissions
            </h1>
            <p className="text-lg text-gray-600 mt-2">
              Define access levels and permissions for your team members
            </p>
          </div>

          <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Create Role
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
              <DialogHeader className="border-b border-gray-200 pb-4">
                <DialogTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-sm">
                    <Shield className="h-5 w-5 text-blue-600" />
                  </div>
                  Create New Role
                </DialogTitle>
                <DialogDescription className="text-base text-gray-600 mt-2">
                  Define a new role with specific permissions for your
                  organization
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateSubmit} className="space-y-3 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label
                      htmlFor="roleName"
                      className="text-base font-medium text-gray-700"
                    >
                      Role Name
                    </Label>
                    <Input
                      id="roleName"
                      value={formData.name}
                      onChange={(e) =>
                        handleInputChange("name", e.target.value)
                      }
                      placeholder="e.g. Project Manager"
                      className="mt-2 h-11"
                      required
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="roleDescription"
                      className="text-base font-medium text-gray-700"
                    >
                      Description
                    </Label>
                    <Textarea
                      id="roleDescription"
                      value={formData.description}
                      onChange={(e) =>
                        handleInputChange("description", e.target.value)
                      }
                      placeholder="Brief description of this role"
                      className="mt-2"
                      rows={3}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-lg font-semibold text-gray-900 mb-3 block">
                    Permissions
                  </Label>
                  <div className="space-y-3">
                    {Object.entries(getPermissionsByCategory()).map(
                      ([category, permissions]) => (
                        <Card key={category} className="border-gray-200">
                          <CardHeader className="bg-gray-50 py-4">
                            <CardTitle className="text-base font-semibold text-gray-900">
                              {category}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {permissions.map((permission) => {
                                const Icon = permission.icon;
                                return (
                                  <div
                                    key={permission.id}
                                    className="flex items-start space-x-3 p-3 border border-gray-200 rounded-sm hover:bg-gray-50 transition-colors"
                                  >
                                    <Checkbox
                                      id={permission.id}
                                      checked={formData.permissions.includes(
                                        permission.id,
                                      )}
                                      onCheckedChange={(checked) =>
                                        handlePermissionChange(
                                          permission.id,
                                          checked,
                                        )
                                      }
                                      className="mt-1"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Icon className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                        <Label
                                          htmlFor={permission.id}
                                          className="font-medium text-gray-900 cursor-pointer"
                                        >
                                          {permission.name}
                                        </Label>
                                      </div>
                                      <p className="text-sm text-gray-600">
                                        {permission.description}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      ),
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <div className="flex gap-3">
                    <Button
                      type="submit"
                      disabled={createRoleMutation.isPending}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-12"
                    >
                      {createRoleMutation.isPending
                        ? "Creating Role..."
                        : "Create Role"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCreateModalOpen(false)}
                      className="px-8 h-12"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Roles Table */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-xl font-bold text-gray-900">
            Organization Roles
          </CardTitle>
          <CardDescription>
            Manage roles and their associated permissions
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {roles.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold text-gray-900">
                      Role
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900">
                      Description
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900">
                      Permissions
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900">
                      Users
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow
                      key={role._id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-sm">
                            <Shield className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">
                              {role.name}
                            </div>
                            <Badge
                              className={`mt-1 ${getRoleColor(role.name)}`}
                            >
                              {role.name}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 max-w-xs">
                        <p
                          className="text-gray-600 truncate"
                          title={role.description || "No description"}
                        >
                          {role.description || "No description"}
                        </p>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="text-sm text-gray-600">
                          {role.permissions?.length || 0} permissions
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Users className="h-4 w-4" />
                          {role.userCount || 0}
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(role)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {!["admin", "manager", "member"].includes(
                            role.name.toLowerCase(),
                          ) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <Shield className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No custom roles yet
              </h3>
              <p className="text-gray-600 mb-3">
                Create your first custom role to define specific permissions.
              </p>
              <Button
                onClick={() => setCreateModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Role
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Role Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="border-b border-gray-200 pb-4">
            <DialogTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <div className="p-2 bg-purple-100 rounded-sm">
                <Edit className="h-5 w-5 text-purple-600" />
              </div>
              Edit Role: {selectedRole?.name}
            </DialogTitle>
            <DialogDescription className="text-base text-gray-600 mt-2">
              Modify permissions and settings for this role
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-3 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label
                  htmlFor="editRoleName"
                  className="text-base font-medium text-gray-700"
                >
                  Role Name
                </Label>
                <Input
                  id="editRoleName"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className="mt-2 h-11"
                  required
                />
              </div>
              <div>
                <Label
                  htmlFor="editRoleDescription"
                  className="text-base font-medium text-gray-700"
                >
                  Description
                </Label>
                <Textarea
                  id="editRoleDescription"
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  className="mt-2"
                  rows={3}
                />
              </div>
            </div>

            <div>
              <Label className="text-lg font-semibold text-gray-900 mb-3 block">
                Permissions
              </Label>
              <div className="space-y-3">
                {Object.entries(getPermissionsByCategory()).map(
                  ([category, permissions]) => (
                    <Card key={category} className="border-gray-200">
                      <CardHeader className="bg-gray-50 py-4">
                        <CardTitle className="text-base font-semibold text-gray-900">
                          {category}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {permissions.map((permission) => {
                            const Icon = permission.icon;
                            return (
                              <div
                                key={permission.id}
                                className="flex items-start space-x-3 p-3 border border-gray-200 rounded-sm hover:bg-gray-50 transition-colors"
                              >
                                <Checkbox
                                  id={`edit-${permission.id}`}
                                  checked={formData.permissions.includes(
                                    permission.id,
                                  )}
                                  onCheckedChange={(checked) =>
                                    handlePermissionChange(
                                      permission.id,
                                      checked,
                                    )
                                  }
                                  className="mt-1"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Icon className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                    <Label
                                      htmlFor={`edit-${permission.id}`}
                                      className="font-medium text-gray-900 cursor-pointer"
                                    >
                                      {permission.name}
                                    </Label>
                                  </div>
                                  <p className="text-sm text-gray-600">
                                    {permission.description}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ),
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={updateRoleMutation.isPending}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white h-12"
                >
                  {updateRoleMutation.isPending
                    ? "Updating Role..."
                    : "Update Role"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditModalOpen(false)}
                  className="px-8 h-12"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
