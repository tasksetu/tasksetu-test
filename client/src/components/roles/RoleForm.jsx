import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  Eye,
  Plus,
  Edit,
  Trash,
  Users,
  FileText,
  Settings,
  BarChart3,
  Building2,
  CreditCard,
  HelpCircle,
  Check,
  X,
} from "lucide-react";

const PERMISSION_MODULES = [
  {
    id: "dashboard",
    name: "Dashboard",
    icon: BarChart3,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    permissions: [
      {
        id: "dashboard.view",
        name: "View Dashboard",
        description: "Access to main dashboard and analytics",
      },
      {
        id: "dashboard.export",
        name: "Export Reports",
        description: "Download dashboard reports and data",
      },
    ],
  },
  {
    id: "tasks",
    name: "Tasks",
    icon: FileText,
    color: "text-green-600",
    bgColor: "bg-green-50",
    permissions: [
      {
        id: "tasks.view",
        name: "View Tasks",
        description: "View all tasks and task details",
      },
      {
        id: "tasks.create",
        name: "Create Tasks",
        description: "Create new tasks and assignments",
      },
      {
        id: "tasks.edit",
        name: "Edit Tasks",
        description: "Modify existing tasks",
      },
      {
        id: "tasks.delete",
        name: "Delete Tasks",
        description: "Remove tasks from the system",
      },
      {
        id: "tasks.assign",
        name: "Assign Tasks",
        description: "Assign tasks to team members",
      },
    ],
  },
  {
    id: "users",
    name: "Users",
    icon: Users,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    permissions: [
      {
        id: "users.view",
        name: "View Users",
        description: "View user profiles and information",
      },
      {
        id: "users.create",
        name: "Create Users",
        description: "Add new users to the system",
      },
      {
        id: "users.edit",
        name: "Edit Users",
        description: "Modify user profiles and settings",
      },
      {
        id: "users.delete",
        name: "Delete Users",
        description: "Remove users from the system",
      },
      {
        id: "users.manage_roles",
        name: "Manage User Roles",
        description: "Assign and modify user roles",
      },
    ],
  },
  {
    id: "projects",
    name: "Projects",
    icon: Building2,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    permissions: [
      {
        id: "projects.view",
        name: "View Projects",
        description: "View project details and progress",
      },
      {
        id: "projects.create",
        name: "Create Projects",
        description: "Create new projects",
      },
      {
        id: "projects.edit",
        name: "Edit Projects",
        description: "Modify project settings and details",
      },
      {
        id: "projects.delete",
        name: "Delete Projects",
        description: "Remove projects from the system",
      },
    ],
  },
  {
    id: "billing",
    name: "Billing & Payments",
    icon: CreditCard,
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    permissions: [
      {
        id: "billing.view",
        name: "View Billing",
        description: "Access billing information and invoices",
      },
      {
        id: "billing.manage",
        name: "Manage Billing",
        description: "Update payment methods and billing details",
      },
      {
        id: "billing.export",
        name: "Export Billing Data",
        description: "Download billing reports and data",
      },
    ],
  },
  {
    id: "settings",
    name: "System Settings",
    icon: Settings,
    color: "text-red-600",
    bgColor: "bg-red-50",
    permissions: [
      {
        id: "settings.view",
        name: "View Settings",
        description: "Access system configuration",
      },
      {
        id: "settings.edit",
        name: "Edit Settings",
        description: "Modify system settings and preferences",
      },
      {
        id: "settings.advanced",
        name: "Advanced Settings",
        description: "Access advanced system configuration",
      },
    ],
  },
];

export function RoleForm({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading = false,
}) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: [],
  });
  const [selectedPermissions, setSelectedPermissions] = useState(new Set());

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        description: initialData.description || "",
        permissions: initialData.permissions || [],
      });
      setSelectedPermissions(new Set(initialData.permissions || []));
    } else {
      setFormData({
        name: "",
        description: "",
        permissions: [],
      });
      setSelectedPermissions(new Set());
    }
  }, [initialData, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const submissionData = {
      ...formData,
      permissions: Array.from(selectedPermissions),
    };
    onSubmit(submissionData);
  };

  const handlePermissionToggle = (permissionId) => {
    const newSelectedPermissions = new Set(selectedPermissions);
    if (newSelectedPermissions.has(permissionId)) {
      newSelectedPermissions.delete(permissionId);
    } else {
      newSelectedPermissions.add(permissionId);
    }
    setSelectedPermissions(newSelectedPermissions);
  };

  const handleModuleToggle = (modulePermissions) => {
    const modulePermissionIds = modulePermissions.map((p) => p.id);
    const allSelected = modulePermissionIds.every((id) =>
      selectedPermissions.has(id),
    );
    const newSelectedPermissions = new Set(selectedPermissions);

    if (allSelected) {
      modulePermissionIds.forEach((id) => newSelectedPermissions.delete(id));
    } else {
      modulePermissionIds.forEach((id) => newSelectedPermissions.add(id));
    }

    setSelectedPermissions(newSelectedPermissions);
  };

  const getModuleSelectionState = (modulePermissions) => {
    const modulePermissionIds = modulePermissions.map((p) => p.id);
    const selectedCount = modulePermissionIds.filter((id) =>
      selectedPermissions.has(id),
    ).length;

    if (selectedCount === 0) return "none";
    if (selectedCount === modulePermissionIds.length) return "all";
    return "partial";
  };

  const totalSelectedPermissions = selectedPermissions.size;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 bg-white border border-slate-200 shadow-2xl overflow-hidden">
        <DialogHeader className="p-4 pb-4 bg-white border-b border-slate-200 flex-shrink-0">
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center">
            <Shield className="h-6 w-6 mr-2 text-blue-600" />
            {initialData ? "Edit Role" : "Create New Role"}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col h-full bg-white max-h-[calc(90vh-120px)]"
        >
          <ScrollArea
            className="flex-1 overflow-y-auto bg-white"
            style={{ maxHeight: "calc(90vh - 200px)" }}
          >
            <div className="space-y-3 p-4">
              <Card className="border-slate-200 bg-white">
                <CardHeader className="pb-4 bg-slate-50">
                  <CardTitle className="text-lg font-semibold text-slate-900">
                    Role Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label
                        htmlFor="name"
                        className="text-sm font-medium text-slate-700"
                      >
                        Role Name *
                      </Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        placeholder="e.g., Project Manager"
                        required
                        className="border-slate-300 focus:border-blue-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">
                        Permissions Selected
                      </Label>
                      <div className="flex items-center space-x-2">
                        <Badge
                          className={`${
                            totalSelectedPermissions > 10
                              ? "bg-green-100 text-green-700"
                              : totalSelectedPermissions > 5
                                ? "bg-blue-100 text-blue-700"
                                : "bg-blue-100 text-blue-700"
                          } border-0`}
                        >
                          {totalSelectedPermissions} permission
                          {totalSelectedPermissions !== 1 ? "s" : ""}
                        </Badge>
                        {totalSelectedPermissions > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedPermissions(new Set())}
                            className="text-xs h-6 px-2"
                          >
                            Clear All
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="description"
                      className="text-sm font-medium text-slate-700"
                    >
                      Description
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      placeholder="Describe the role responsibilities and scope..."
                      rows={3}
                      className="border-slate-300 focus:border-blue-500"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white">
                <CardHeader className="pb-4 bg-slate-50">
                  <CardTitle className="text-lg font-semibold text-slate-900">
                    Permissions & Access Control
                  </CardTitle>
                  <p className="text-sm text-slate-600">
                    Select the permissions this role should have access to
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 bg-white">
                  {PERMISSION_MODULES.map((module) => {
                    const IconComponent = module.icon;
                    const selectionState = getModuleSelectionState(
                      module.permissions,
                    );

                    return (
                      <div key={module.id} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-sm ${module.bgColor}`}>
                              <IconComponent
                                className={`h-5 w-5 ${module.color}`}
                              />
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-900">
                                {module.name}
                              </h4>
                              <p className="text-xs text-slate-600">
                                {module.permissions.length} permissions
                                available
                              </p>
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleModuleToggle(module.permissions)
                            }
                            className={`${
                              selectionState === "all"
                                ? "bg-blue-50 text-blue-700 border-blue-300"
                                : selectionState === "partial"
                                  ? "bg-blue-50 text-blue-700 border-blue-300"
                                  : "border-slate-300"
                            }`}
                          >
                            {selectionState === "all" ? (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                All Selected
                              </>
                            ) : selectionState === "partial" ? (
                              <>
                                <div className="w-4 h-4 mr-1 bg-blue-500 rounded-sm" />
                                Partial
                              </>
                            ) : (
                              <>
                                <Plus className="h-4 w-4 mr-1" />
                                Select All
                              </>
                            )}
                          </Button>
                        </div>

                        <div className="ml-12 space-y-2">
                          {module.permissions.map((permission) => (
                            <div
                              key={permission.id}
                              className="flex items-start space-x-3 p-3 rounded-sm border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                            >
                              <Checkbox
                                id={permission.id}
                                checked={selectedPermissions.has(permission.id)}
                                onCheckedChange={() =>
                                  handlePermissionToggle(permission.id)
                                }
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <label
                                  htmlFor={permission.id}
                                  className="block font-medium text-sm text-slate-900 cursor-pointer"
                                >
                                  {permission.name}
                                </label>
                                <p className="text-xs text-slate-600 mt-1">
                                  {permission.description}
                                </p>
                              </div>
                              <div className="flex-shrink-0">
                                <HelpCircle className="h-4 w-4 text-slate-400" />
                              </div>
                            </div>
                          ))}
                        </div>

                        {module.id !==
                          PERMISSION_MODULES[PERMISSION_MODULES.length - 1]
                            .id && <Separator className="my-4" />}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {totalSelectedPermissions > 0 && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold text-blue-900 flex items-center">
                      <Eye className="h-5 w-5 mr-2" />
                      Permission Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(selectedPermissions).map((permissionId) => {
                        const permission = PERMISSION_MODULES.flatMap(
                          (m) => m.permissions,
                        ).find((p) => p.id === permissionId);

                        return (
                          <Badge
                            key={permissionId}
                            variant="outline"
                            className="bg-white text-blue-700 border-blue-300"
                          >
                            {permission?.name || permissionId}
                          </Badge>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>

          <div className="flex items-center justify-end space-x-3 p-4 border-t border-slate-200 bg-white flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-slate-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.name.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {initialData ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>
                  {initialData ? (
                    <>
                      <Edit className="h-4 w-4 mr-2" />
                      Update Role
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Role
                    </>
                  )}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
