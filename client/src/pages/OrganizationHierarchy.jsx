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
  const { data: hierarchyEntries = [], isLoading: hierarchyLoading } = useQuery(
    {
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
    },
  );

  // Role checking helper to support array, string, and multiple role fields
  const userHasRole = (u, targetRole) => {
    if (!u) return false;
    const roles = [];
    if (Array.isArray(u.role)) roles.push(...u.role);
    else if (typeof u.role === "string" && u.role.trim()) roles.push(u.role.trim());
    if (Array.isArray(u.roles)) roles.push(...u.roles);
    else if (typeof u.roles === "string" && u.roles.trim()) roles.push(u.roles.trim());
    return roles.some(
      (r) => String(r).toLowerCase().trim() === targetRole.toLowerCase().trim()
    );
  };

  // User display name helper
  const getUserDisplayName = (u) => {
    if (!u) return "";
    const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim();
    return fullName || u.username || u.email || "User";
  };

  // Helper for role tag in dropdowns
  const getUserRoleLabel = (u) => {
    const isMgr = userHasRole(u, "manager");
    const isEmp = userHasRole(u, "employee");
    if (isMgr && isEmp) return " (Manager & Employee)";
    if (isMgr) return " (Manager)";
    if (isEmp) return " (Employee)";
    return "";
  };

  // Filter users who have manager role (including dual-role manager & employee)
  const managerUsers = users.filter((u) => userHasRole(u, "manager"));

  const getAvailableReportyUsers = () => {
    const selectedManagerId =
      formData.managerId ||
      editingEntry?.manager?._id ||
      editingEntry?.managerId;

    const currentEditingReportyId =
      editingEntry?.reporty?._id ||
      editingEntry?.reportyId;

    return users.filter((u) => {
      // Must have "employee" role (users with both "manager" and "employee" qualify!)
      if (!userHasRole(u, "employee")) return false;

      // When editing this entry, allow the currently assigned reporty
      if (
        editingEntry &&
        currentEditingReportyId &&
        String(u._id) === String(currentEditingReportyId)
      ) {
        return true;
      }

      // Exclude the selected manager from being their own reporty
      if (selectedManagerId && String(u._id) === String(selectedManagerId)) {
        return false;
      }

      // Exclude if already reporting to this exact manager in an active entry
      const alreadyReportsToThisManager = hierarchyEntries.some((entry) => {
        if (editingEntry && String(entry._id) === String(editingEntry._id)) {
          return false;
        }
        const entryManagerId =
          entry.manager?._id ||
          entry.managerId ||
          (typeof entry.manager === "string" ? entry.manager : null);
        const entryReportyId =
          entry.reporty?._id ||
          entry.reportyId ||
          (typeof entry.reporty === "string" ? entry.reporty : null);
        return (
          String(entryManagerId) === String(selectedManagerId) &&
          String(entryReportyId) === String(u._id)
        );
      });
      if (alreadyReportsToThisManager) return false;

      // Direct circular prevention:
      // If user 'u' is ALREADY managing the selectedManager in an active hierarchy entry,
      // then selectedManager cannot also manage 'u' (prevents direct circular loops).
      if (selectedManagerId) {
        const reverseLinkExists = hierarchyEntries.some((entry) => {
          if (editingEntry && String(entry._id) === String(editingEntry._id)) {
            return false;
          }
          const entryManagerId =
            entry.manager?._id ||
            entry.managerId ||
            (typeof entry.manager === "string" ? entry.manager : null);
          const entryReportyId =
            entry.reporty?._id ||
            entry.reportyId ||
            (typeof entry.reporty === "string" ? entry.reporty : null);
          return (
            String(entryManagerId) === String(u._id) &&
            String(entryReportyId) === String(selectedManagerId)
          );
        });
        if (reverseLinkExists) return false;
      }

      return true;
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

    if (formData.managerId === formData.reportyId) {
      toast({
        title: "Validation Error",
        description: "A user cannot be their own manager",
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
            className="h-8 rounded-sm text-xs"
            onClick={() => setLocation("/dashboard")}
          >
            <ChevronDown size={14} className="mr-1 rotate-270" />
            Back to Dashboard
          </Button>
        </div>

        {/* FORM SECTION */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-sm mb-3">
          <div
            className="py-2.5 px-4 border-b border-gray-200 rounded-t-sm"
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
                  className="w-full h-8 border border-gray-300 rounded-sm px-2 text-xs"
                  style={{ color: "#676a6c" }}
                  required
                >
                  <option value="">Choose a manager...</option>
                  {managerUsers.map((manager) => (
                    <option key={manager._id} value={manager._id}>
                      {getUserDisplayName(manager)}
                      {getUserRoleLabel(manager)}
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
                  className="w-full h-8 border border-gray-300 rounded-sm px-2 text-xs"
                  style={{ color: "#676a6c" }}
                  required
                >
                  <option value="">Choose a reporty...</option>
                  {getAvailableReportyUsers().map((reporty) => (
                    <option key={reporty._id} value={reporty._id}>
                      {getUserDisplayName(reporty)}
                      {getUserRoleLabel(reporty)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                className="h-8 rounded-sm text-xs"
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
                  className="h-8 rounded-sm text-xs"
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
        <div className="bg-white border border-gray-200 shadow-sm rounded-sm">
          <div
            className="py-2.5 px-4 border-b border-gray-200 rounded-t-sm"
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
                          <div>
                            <span
                              className="text-xs font-medium"
                              style={{ color: "#676a6c" }}
                            >
                              {getUserDisplayName(entry?.manager)}
                            </span>
                            {entry?.manager?.email && (
                              <span className="block text-[10px] text-gray-400">
                                {entry.manager.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <Users size={14} className="text-green-600" />
                          <div>
                            <span
                              className="text-xs font-medium"
                              style={{ color: "#676a6c" }}
                            >
                              {getUserDisplayName(entry?.reporty)}
                            </span>
                            {entry?.reporty?.email && (
                              <span className="block text-[10px] text-gray-400">
                                {entry.reporty.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 text-xs rounded-sm"
                            onClick={() => handleEdit(entry)}
                          >
                            <Edit size={12} className="mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 text-xs text-red-600 border-red-200 hover:bg-red-50 rounded-sm"
                            onClick={() => handleDelete(entry._id)}
                          >
                            <Trash2 size={12} className="mr-1" />
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
          onCancel={() => setDeleteConfirm({ isOpen: false, entryId: null })}
          onClose={() => setDeleteConfirm({ isOpen: false, entryId: null })}
          onConfirm={confirmDelete}
          title="Delete Hierarchy Entry"
          description="Are you sure you want to delete this hierarchy entry? This action cannot be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          confirmVariant="destructive"
          isConfirming={deleteHierarchyMutation.isPending}
        />
      </div>
    </div>
  );
}
