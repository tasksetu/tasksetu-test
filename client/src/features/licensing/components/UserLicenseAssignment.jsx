import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  ShieldCheck,
  ShieldOff,
  RefreshCcw,
  AlertCircle,
  CheckCircle2,
  User,
} from "lucide-react";

/**
 * 🆕 USER LICENSE ASSIGNMENT COMPONENT
 * Shows all users and allows assigning/changing their licenses
 */
export function UserLicenseAssignment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedLicense, setSelectedLicense] = useState("");
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Fetch assigned licenses with user details
  const { data: assignedLicenses, isLoading: loadingAssigned } = useQuery({
    queryKey: ["assigned-licenses"],
    queryFn: async () => {
      const response = await fetch("/api/licenses/assigned", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch assigned licenses");
      const data = await response.json();
      return data.assigned_licenses;
    },
  });

  // Fetch organization users (you'll need to implement this endpoint)
  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ["organization-users"],
    queryFn: async () => {
      const response = await fetch("/api/organization/users", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch users");
      const data = await response.json();
      return data.users || [];
    },
  });

  // Assign/change license mutation
  const assignMutation = useMutation({
    mutationFn: async ({ userId, licenseType }) => {
      const response = await fetch(`/api/users/${userId}/license`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ license_type: licenseType }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to assign license");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ License Updated",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["assigned-licenses"] });
      queryClient.invalidateQueries({ queryKey: ["organization-users"] });
      queryClient.invalidateQueries({ queryKey: ["license-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["current-license-info"] });
      setShowAssignModal(false);
      setSelectedUser(null);
      setSelectedLicense("");
    },
    onError: (error) => {
      toast({
        title: "❌ Failed to Assign License",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAssignLicense = () => {
    if (!selectedUser || !selectedLicense) {
      toast({
        title: "Missing Information",
        description: "Please select a user and license type",
        variant: "destructive",
      });
      return;
    }

    assignMutation.mutate({
      userId: selectedUser._id,
      licenseType: selectedLicense === "NONE" ? null : selectedLicense,
    });
  };

  const openAssignModal = (user) => {
    setSelectedUser(user);
    setSelectedLicense("");
    setShowAssignModal(true);
  };

  if (loadingAssigned || loadingUsers) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Users...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-7">
            <RefreshCcw className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const licenseTypes = [
    {
      value: "EXPLORE",
      label: "Explore",
      icon: "🔍",
      color: "bg-gray-100 text-gray-700",
    },
    {
      value: "PLAN",
      label: "Plan",
      icon: "📋",
      color: "bg-blue-100 text-blue-700",
    },
    {
      value: "EXECUTE",
      label: "Execute",
      icon: "⚡",
      color: "bg-green-100 text-green-700",
    },
    {
      value: "OPTIMIZE",
      label: "Optimize",
      icon: "🚀",
      color: "bg-purple-100 text-purple-700",
    },
  ];

  // Create a map of user IDs to their license info
  const userLicenseMap = {};
  assignedLicenses?.forEach((license) => {
    if (license.assigned_to_user_id) {
      userLicenseMap[license.assigned_to_user_id._id] = license;
    }
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User License Assignments
              </CardTitle>
              <CardDescription>
                Manage license assignments for organization members
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-3 p-3 bg-gray-50 rounded-sm font-semibold text-sm text-gray-700">
              <div className="col-span-4">User</div>
              <div className="col-span-2">Role</div>
              <div className="col-span-3">License</div>
              <div className="col-span-3 text-right">Actions</div>
            </div>

            {/* User Rows */}
            {users?.map((user) => {
              const license = userLicenseMap[user._id || user.id];
              const hasLicense = !!license;

              return (
                <div
                  key={user._id || user.id}
                  className="grid grid-cols-12 gap-3 p-3 border rounded-sm hover:bg-gray-50 transition-colors items-center"
                >
                  {/* User Info */}
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>

                  {/* Role */}
                  <div className="col-span-2">
                    <Badge variant="outline" className="text-xs">
                      {Array.isArray(user.role) ? user.role[0] : user.role}
                    </Badge>
                  </div>

                  {/* License Status */}
                  <div className="col-span-3">
                    {hasLicense ? (
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            licenseTypes.find(
                              (t) => t.value === license.license_type,
                            )?.color || "bg-gray-100"
                          }
                        >
                          <ShieldCheck className="h-3 w-3 mr-1" />
                          {license.license_type}
                        </Badge>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-amber-600">
                        <ShieldOff className="h-4 w-4" />
                        <span className="text-sm">No License</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="col-span-3 flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openAssignModal(user)}
                    >
                      {hasLicense ? "Change" : "Assign"}
                    </Button>
                  </div>
                </div>
              );
            })}

            {users?.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>No users found in your organization</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Assign/Change License Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {userLicenseMap[selectedUser?._id] ? "Change" : "Assign"} License
            </DialogTitle>
            <DialogDescription>
              {selectedUser && (
                <span>
                  Manage license for {selectedUser.firstName}{" "}
                  {selectedUser.lastName}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {/* Current License */}
            {userLicenseMap[selectedUser?._id] && (
              <div className="p-3 bg-blue-50 rounded-sm border border-blue-200">
                <div className="text-sm text-blue-700 font-medium mb-1">
                  Current License
                </div>
                <Badge className="bg-blue-100 text-blue-700">
                  {userLicenseMap[selectedUser._id].license_type}
                </Badge>
              </div>
            )}

            {/* New License Selection */}
            <div className="space-y-2">
              <Label>Select New License</Label>
              <Select
                value={selectedLicense}
                onValueChange={setSelectedLicense}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a license type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">
                    <div className="flex items-center gap-2">
                      <ShieldOff className="h-4 w-4" />
                      Remove License
                    </div>
                  </SelectItem>
                  {licenseTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <span>{type.icon}</span>
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignLicense}
              disabled={assignMutation.isPending || !selectedLicense}
            >
              {assignMutation.isPending ? (
                <>
                  <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirm
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
