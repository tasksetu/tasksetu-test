import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, UserPlus, Trash2, Shield, Eye } from "lucide-react";
import { useShowToast } from "../../utils/ToastMessage";

export default function ShareFormModal({ open, onClose, formId }) {
  const { showSuccessToast, showErrorToast } = useShowToast();
  const queryClient = useQueryClient();
  const token = localStorage.getItem("token");

  const [userEmail, setUserEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("VIEWER");

  // Fetch list of users who have access to the form
  const { data: sharedUsersData, isLoading } = useQuery({
    queryKey: ["form-shared-users", formId],
    queryFn: async () => {
      const response = await fetch(`/api/forms/${formId}/shared-users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data.data;
    },
    enabled: open && !!formId,
  });

  // Search for user by email
  const searchUserMutation = useMutation({
    mutationFn: async (email) => {
      const response = await fetch(`/api/users/search?email=${email}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data.data;
    },
  });

  // Share form mutation
  const shareFormMutation = useMutation({
    mutationFn: async ({ user_id, role }) => {
      const response = await fetch(`/api/forms/${formId}/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id, role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      showSuccessToast("Form shared");
      queryClient.invalidateQueries(["form-shared-users", formId]);
      setUserEmail("");
    },
    onError: (error) => {
      showErrorToast(error.message || "Unable to share form");
    },
  });

  // Unshare form mutation
  const unshareFormMutation = useMutation({
    mutationFn: async (user_id) => {
      const response = await fetch(`/api/forms/${formId}/share/${user_id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      showSuccessToast("Access removed");
      queryClient.invalidateQueries(["form-shared-users", formId]);
    },
    onError: (error) => {
      showErrorToast(error.message || "Unable to remove access");
    },
  });

  const handleShare = async () => {
    if (!userEmail.trim()) {
      showErrorToast("Enter a user email");
      return;
    }

    try {
      // Search for user by email
      const user = await searchUserMutation.mutateAsync(userEmail.trim());

      if (!user) {
        showErrorToast("User not found");
        return;
      }

      // Share form with found user
      await shareFormMutation.mutateAsync({
        user_id: user._id || user.user_id,
        role: selectedRole,
      });
    } catch (error) {
      showErrorToast(error.message || "Error finding user");
    }
  };

  const handleUnshare = (user_id) => {
    if (confirm("Are you sure you want to remove this user's access?")) {
      unshareFormMutation.mutate(user_id);
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case "OWNER":
        return <Shield className="h-4 w-4 text-purple-600" />;
      case "EDITOR":
        return <Shield className="h-4 w-4 text-blue-600" />;
      case "VIEWER":
        return <Eye className="h-4 w-4 text-gray-600" />;
      default:
        return null;
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case "OWNER":
        return "bg-purple-100 text-purple-800";
      case "EDITOR":
        return "bg-blue-100 text-blue-800";
      case "VIEWER":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-sm shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Share Form</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Add User Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Add User</h3>
            <div className="flex gap-3">
              <Input
                placeholder="Enter user email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="flex-1 h-9"
                onKeyPress={(e) => {
                  if (e.key === "Enter") handleShare();
                }}
              />
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIEWER">
                    <div className="flex items-center gap-2">
                      <Eye className="h-3 w-3" />
                      <span>Viewer</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="EDITOR">
                    <div className="flex items-center gap-2">
                      <Shield className="h-3 w-3" />
                      <span>Editor</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleShare}
                disabled={
                  !userEmail.trim() ||
                  shareFormMutation.isPending ||
                  searchUserMutation.isPending
                }
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              <strong>Viewer:</strong> Can view form and responses only
              <br />
              <strong>Editor:</strong> Can edit form, publish, and attach to
              tasks
            </p>
          </div>

          {/* Current Access List */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">
              People with Access
            </h3>

            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : (
              <div className="space-y-2">
                {/* Owner */}
                {sharedUsersData?.owner && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <Shield className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {sharedUsersData.owner.firstName || "Unnamed User"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {sharedUsersData.owner.email}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(
                        "OWNER",
                      )}`}
                    >
                      Owner
                    </span>
                  </div>
                )}

                {/* Shared Users */}
                {sharedUsersData?.shared_with?.length > 0 ? (
                  sharedUsersData.shared_with.map((user) => (
                    <div
                      key={user.user_id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            user.role === "EDITOR"
                              ? "bg-blue-100"
                              : "bg-gray-100"
                          }`}
                        >
                          {getRoleIcon(user.role)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {user.name || "Unnamed User"}
                          </p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(
                            user.role,
                          )}`}
                        >
                          {user.role === "EDITOR" ? "Editor" : "Viewer"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleUnshare(user.user_id)}
                          disabled={unshareFormMutation.isPending}
                          className="text-red-600 hover:text-red-700 p-1 h-8 w-8"
                          title="Remove access"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    This form hasn't been shared with anyone yet
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
