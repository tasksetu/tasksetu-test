import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Users,
  UserPlus,
  Edit,
  Trash2,
  Save,
  X,
  ChevronDown,
  Building,
  UserCheck,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/shared/hooks/useAuth";
import ConfirmDialog from "@/components/common/ConfirmDialog";

export function OrganizationHierarchy() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState({
    managerId: "",
    reportyId: "",
  });

  // Edit state
  const [editingEntry, setEditingEntry] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    entryId: null,
  });

  // Check if user has orga_Admin role
  const checkAdminAccess = () => {
    if (!user || !user.role.includes("org_admin")) {
      setLocation("/dashboard");
      toast({
        title: "Access Denied",
        description: "Only organization administrators can access this feature",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  // Get organization users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/organization/users-detailed"],
    enabled: !!user && user.role.includes("org_admin"),
  });

  // Get existing hierarchy entries
  const { data: hierarchyEntries = [], isLoading: hierarchyLoading } = useQuery({
    queryKey: ["/api/organization/hierarchy"],
    queryFn: async () => {
      const response = await fetch("/api/organization/hierarchy", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const result = await response.json();
      return result.data || [];
    },
  });

  // Filter users by role
  const managerUsers = users.filter((u) => u.role.includes("manager"));

  const getAvailableReportyUsers = () => {
    const selectedManagerId = formData.managerId || editingEntry?.managerId;
    const selectedAdminIds = hierarchyEntries.map((entry) => entry.managerId);
    const selectedManagerIds = hierarchyEntries.map((entry) => entry.managerId);

    return users.filter((u) => {
      // Exclude current user if they're being edited
      if (editingEntry && u._id === editingEntry.reportyId) return false;
      // Exclude users already selected as admin or manager
      if (
        selectedAdminIds.includes(u._id) ||
        selectedManagerIds.includes(u._id)
      )
        return false;
      // Exclude the selected manager from reporty dropdown
      if (selectedManagerId && u._id === selectedManagerId) return false;
      // Exclude managers from reporting to other managers
      if (u.role.includes("manager")) return false;
      // Only show employees
      return u.role.includes("employee");
    });
  };

  // Create hierarchy entry mutation
  const createHierarchyMutation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch("/api/organization/hierarchy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create hierarchy entry");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Hierarchy entry created",
        description: "The organization hierarchy has been updated",
      });
      setFormData({ managerId: "", reportyId: "" });
      queryClient.invalidateQueries({
        queryKey: ["/api/organization/hierarchy"],
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create hierarchy entry",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update hierarchy entry mutation
  const updateHierarchyMutation = useMutation({
    mutationFn: async ({ id, ...data }) => {
      const response = await fetch(`/api/organization/hierarchy/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update hierarchy entry");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Hierarchy entry updated",
        description: "The organization hierarchy has been updated",
      });
      setEditingEntry(null);
      setFormData({ managerId: "", reportyId: "" });
      queryClient.invalidateQueries({
        queryKey: ["/api/organization/hierarchy"],
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update hierarchy entry",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete hierarchy entry mutation
  const deleteHierarchyMutation = useMutation({
    mutationFn: async (id) => {
      const response = await fetch(`/api/organization/hierarchy/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete hierarchy entry");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Hierarchy entry deleted",
        description: "The organization hierarchy has been updated",
      });
      setDeleteConfirm({ isOpen: false, entryId: null });
      queryClient.invalidateQueries({
        queryKey: ["/api/organization/hierarchy"],
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete hierarchy entry",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.managerId || !formData.reportyId) {
      toast({
        title: "Validation Error",
        description: "Please select both manager and reporty",
        variant: "destructive",
      });
      return;
    }

    if (editingEntry) {
      updateHierarchyMutation.mutate({ id: editingEntry._id, ...formData });
    } else {
      createHierarchyMutation.mutate(formData);
    }
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setFormData({
      managerId: entry.manager?._id || entry.managerId,
      reportyId: entry.reporty?._id || entry.reportyId,
    });
  };

  const handleDelete = (entryId) => {
    setDeleteConfirm({ isOpen: true, entryId });
  };

  const confirmDelete = () => {
    deleteHierarchyMutation.mutate(deleteConfirm.entryId);
  };

  const cancelEdit = () => {
    setEditingEntry(null);
    setFormData({ managerId: "", reportyId: "" });
  };

  if (!user || !user.role.includes("org_admin")) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#f3f3f4" }}
      >
        <div className="text-center">
          <Shield className="mx-auto text-red-600 mb-4" size={48} />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 mb-4">
            You don't have permission to access this page.
          </p>
          <Button onClick={() => setLocation("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen font-['Open_Sans','Helvetica_Neue',Helvetica,Arial,sans-serif]"
      style={{ backgroundColor: "#f3f3f4" }}
    >
      <div className="p-4">
        {/* PAGE HEADER */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2
              className="text-xl font-normal m-0"
              style={{ color: "#676a6c" }}
            >
              Organization{" "}
              <span className="font-semibold text-blue-600">
                Hierarchy Management
              </span>
            </h2>
            <p className="text-xs mt-0.5 m-0" style={{ color: "#9a9a9a" }}>
              Manage manager and reporting relationships
            </p>
          </div>
          <Button
            variant="outline"
            className="h-8 rounded-md text-xs"
            onClick={() => setLocation("/dashboard")}
          >
            <ChevronDown size={14} className="mr-1 rotate-270" />
            Back to Dashboard
          </Button>
        </div>

        {/* FORM SECTION */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-md mb-3">
          <div
            className="py-2.5 px-4 border-b border-gray-200 rounded-t-lg"
            style={{ backgroundColor: "#f9f9f9" }}
          >
            <h5
              className="text-xs font-semibold uppercase tracking-wider m-0 flex items-center gap-1.5"
              style={{ color: "#676a6c" }}
            >
              <Building size={12} className="text-blue-600" />
              {editingEntry
                ? "Edit Hierarchy Entry"
                : "Create New Hierarchy Entry"}
            </h5>
          </div>

          <form onSubmit={handleSubmit} className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Manager Dropdown */}
              <div>
                <label
                  className="block text-xs font-medium mb-1"
                  style={{ color: "#676a6c" }}
                >
                  <UserCheck size={12} className="inline mr-1" />
                  Select Manager
                </label>
                <select
                  value={formData.managerId}
                  onChange={(e) =>
                    setFormData({ ...formData, managerId: e.target.value })
                  }
                  className="w-full h-8 border border-gray-300 rounded px-2 text-xs"
                  style={{ color: "#676a6c" }}
                  required
                >
                  <option value="">Choose a manager...</option>
                  {managerUsers.map((manager) => (
                    <option key={manager._id} value={manager._id}>
                      {manager.firstName || manager.username}{" "}
                      {manager.lastName || ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reporty Dropdown */}
              <div>
                <label
                  className="block text-xs font-medium mb-1"
                  style={{ color: "#676a6c" }}
                >
                  <Users size={12} className="inline mr-1" />
                  Select Reporty (Reporting User)
                </label>
                <select
                  value={formData.reportyId}
                  onChange={(e) =>
                    setFormData({ ...formData, reportyId: e.target.value })
                  }
                  className="w-full h-8 border border-gray-300 rounded px-2 text-xs"
                  style={{ color: "#676a6c" }}
                  required
                >
                  <option value="">Choose a reporty...</option>
                  {getAvailableReportyUsers().map((reporty) => (
                    <option key={reporty._id} value={reporty._id}>
                      {reporty.firstName || reporty.username}{" "}
                      {reporty.lastName || ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                className="h-8 rounded-md text-xs"
                disabled={
                  createHierarchyMutation.isPending ||
                  updateHierarchyMutation.isPending
                }
              >
                <Save size={14} className="mr-1" />
                {editingEntry ? "Update Entry" : "Create Entry"}
              </Button>
              {editingEntry && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 rounded-md text-xs"
                  onClick={cancelEdit}
                >
                  <X size={14} className="mr-1" />
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </div>

        {/* HIERARCHY TABLE */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-md">
          <div
            className="py-2.5 px-4 border-b border-gray-200 rounded-t-lg"
            style={{ backgroundColor: "#f9f9f9" }}
          >
            <h5
              className="text-xs font-semibold uppercase tracking-wider m-0 flex items-center gap-1.5"
              style={{ color: "#676a6c" }}
            >
              <Users size={12} className="text-blue-600" />
              Current Hierarchy Structure
              <span className="ml-1 text-[10px] font-normal normal-case text-gray-400">
                ({hierarchyEntries.length} entries)
              </span>
            </h5>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ backgroundColor: "#f9f9f9" }}>
                <tr>
                  <th
                    className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "#676a6c" }}
                  >
                    Manager
                  </th>
                  <th
                    className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "#676a6c" }}
                  >
                    Reporty
                  </th>
                  <th
                    className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "#676a6c" }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {hierarchyLoading ? (
                  <tr>
                    <td
                      colSpan="3"
                      className="px-4 py-8 text-center text-sm"
                      style={{ color: "#9a9a9a" }}
                    >
                      Loading hierarchy data...
                    </td>
                  </tr>
                ) : hierarchyEntries.length === 0 ? (
                  <tr>
                    <td
                      colSpan="3"
                      className="px-4 py-8 text-center text-sm"
                      style={{ color: "#9a9a9a" }}
                    >
                      No hierarchy entries found. Create your first entry above.
                    </td>
                  </tr>
                ) : (
hierarchyEntries.map((entry) => (
                    <tr
                      key={entry._id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <UserCheck size={14} className="text-blue-600" />
                          <span
                            className="text-xs"
                            style={{ color: "#676a6c" }}
                          >
                           {entry?.manager?.firstName} 
                           </span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <Users size={14} className="text-green-600" />
                          <span
                            className="text-xs"
                            style={{ color: "#676a6c" }}
                          >
                          {entry?.reporty?.firstName}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => handleEdit(entry)}
                          >
                            <Edit size={10} className="mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => handleDelete(entry._id)}
                          >
                            <Trash2 size={10} className="mr-1" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* DELETE CONFIRM DIALOG */}
        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          onClose={() => setDeleteConfirm({ isOpen: false, entryId: null })}
          onConfirm={confirmDelete}
          title="Delete Hierarchy Entry"
          description="Are you sure you want to delete this hierarchy entry? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
        />
      </div>
    </div>
  );
}
