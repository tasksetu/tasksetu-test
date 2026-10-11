import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useShowToast } from "@/utils/ToastMessage";

// Calculate due date based on priority
export const calculateDueDateFromPriority = (
  priority,
  creationDate = new Date(),
) => {
  const date = new Date(creationDate);
  const prioritySettings = JSON.parse(
    localStorage.getItem("prioritySettings") || "{}",
  );

  // Default days mapping
  const defaultDays = {
    low: 30,
    medium: 14,
    high: 7,
    critical: 2,
    urgent: 1,
  };

  const daysToAdd =
    prioritySettings[String(priority || "").toLowerCase()] ||
    defaultDays[String(priority || "").toLowerCase()] ||
    7;
  date.setDate(date.getDate() + daysToAdd);

  return date.toISOString().split("T")[0]; // Return YYYY-MM-DD format
};

function CompanyPriorityRow({
  priority,
  onEdit,
  onDelete,
  onSetDefault,
  canEdit,
}) {
  // Guard against undefined priority
  if (!priority) {
    return null;
  }

  const taskCount = priority?.tasksUsing || 0;
  const priorityId = priority?._id || priority?.id;

  return (
    <tr className="hover:bg-gray-50/80 transition-colors">
      <td className="px-6 py-3.5 whitespace-nowrap">
        <div className="flex items-center gap-2.5">
          <span
            className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm shrink-0"
            style={{ backgroundColor: priority.color || "#6b7280" }}
          />
          <span className="font-medium text-gray-900 text-sm">
            {priority.label || "Unnamed Priority"}
          </span>
          {priority.isDefault && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
              Default
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-3.5 whitespace-nowrap">
        <code className="text-xs font-mono font-medium text-gray-700 bg-gray-100 px-2.5 py-1 rounded border border-gray-200/80">
          {priority.code || "-"}
        </code>
      </td>
      <td className="px-6 py-3.5 whitespace-nowrap">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/70">
          {priority.daysToDue ?? 0} {priority.daysToDue === 1 ? "day" : "days"}
        </span>
      </td>
      <td className="px-6 py-3.5 whitespace-nowrap">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
            priority.active !== false
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-gray-100 text-gray-600 border-gray-200"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              priority.active !== false ? "bg-emerald-500" : "bg-gray-400"
            }`}
          />
          {priority.active !== false ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-6 py-3.5 whitespace-nowrap text-center">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200">
          {taskCount} {taskCount === 1 ? "task" : "tasks"}
        </span>
      </td>
      <td className="px-6 py-3.5 whitespace-nowrap text-center">
        <div className="flex justify-center items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 font-medium transition-colors"
            onClick={onEdit}
            disabled={!canEdit}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!canEdit || priority.isDefault}
            className={`h-7 px-2.5 text-xs font-medium transition-colors ${
              priority.isDefault
                ? "text-gray-300 cursor-not-allowed hover:bg-transparent"
                : "text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
            }`}
            onClick={priority.isDefault ? undefined : onSetDefault}
          >
            Set Default
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-2.5 text-xs font-medium transition-colors ${
              taskCount > 0 || !canEdit
                ? "text-gray-300 cursor-not-allowed hover:bg-transparent"
                : "text-red-600 hover:text-red-800 hover:bg-red-50"
            }`}
            onClick={() => onDelete(priorityId)}
            disabled={!canEdit || taskCount > 0}
            title={
              taskCount > 0
                ? `Cannot delete: ${taskCount} tasks using this priority`
                : "Delete priority"
            }
          >
            Delete
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default function PriorityManager() {
  const queryClient = useQueryClient();
  const { showSuccessToast, showErrorToast } = useShowToast();

  const { data: fetchedPriorities = [], isLoading: prioritiesLoading } =
    useQuery({
      queryKey: ["/api/task-priorities"],
      enabled: !!localStorage.getItem("token"),
    });

  const [priorities, setPriorities] = useState([]);

  useEffect(() => {
    setPriorities(Array.isArray(fetchedPriorities) ? fetchedPriorities : []);
  }, [fetchedPriorities]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPriority, setEditingPriority] = useState(null);
  const [formData, setFormData] = useState({
    code: "",
    label: "",
    daysToDue: 14,
    color: "#6B7280",
    active: true,
  });

  // Save priority settings to localStorage whenever priorities change
  React.useEffect(() => {
    const settings = {};
    (Array.isArray(priorities) ? priorities : []).forEach((priority) => {
      if (priority?.code)
        settings[String(priority.code).toLowerCase()] = priority.daysToDue;
    });
    localStorage.setItem("prioritySettings", JSON.stringify(settings));
  }, [priorities]);

  const createPriorityMutation = useMutation({
    mutationFn: async (data) => {
      const res = await apiRequest("POST", "/api/task-priorities", data);
      return res.json();
    },
    onSuccess: (payload) => {
      if (payload?.success === false)
        return showErrorToast(payload?.message || "Failed to create priority");
      showSuccessToast("Priority created");
      queryClient.invalidateQueries({ queryKey: ["/api/task-priorities"] });
      setShowAddForm(false);
      setEditingPriority(null);
    },
    onError: (err) =>
      showErrorToast(err?.message || "Failed to create priority"),
  });

  const updatePriorityMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await apiRequest("PUT", `/api/task-priorities/${id}`, data);
      return res.json();
    },
    onSuccess: (payload) => {
      if (payload?.success === false)
        return showErrorToast(payload?.message || "Failed to update priority");
      showSuccessToast("Priority updated");
      queryClient.invalidateQueries({ queryKey: ["/api/task-priorities"] });
      setShowAddForm(false);
      setEditingPriority(null);
    },
    onError: (err) =>
      showErrorToast(err?.message || "Failed to update priority"),
  });

  const deletePriorityMutation = useMutation({
    mutationFn: async (id) => {
      const res = await apiRequest("DELETE", `/api/task-priorities/${id}`);
      return res.json();
    },
    onSuccess: (payload) => {
      if (payload?.success === false)
        return showErrorToast(payload?.message || "Failed to delete priority");
      showSuccessToast("Priority deleted");
      queryClient.invalidateQueries({ queryKey: ["/api/task-priorities"] });
    },
    onError: (err) =>
      showErrorToast(err?.message || "Failed to delete priority"),
  });

  const handleEdit = (priority) => {
    setEditingPriority(priority);
    setFormData({
      code: priority.code,
      label: priority.label,
      color: priority.color || "#6B7280",
      daysToDue: priority.daysToDue ?? 14,
      active: priority.active ?? true,
    });
    setShowAddForm(true);
  };

  const handleDelete = (priorityId) =>
    deletePriorityMutation.mutate(priorityId);

  const handleSetDefault = (priority) => {
    const id = priority?._id || priority?.id;
    if (!id) return;
    updatePriorityMutation.mutate({ id, data: { isDefault: true } });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingPriority) {
      updatePriorityMutation.mutate({
        id: editingPriority._id || editingPriority.id,
        data: {
          label: formData.label,
          color: formData.color,
          daysToDue: parseInt(formData.daysToDue),
          active: !!formData.active,
        },
      });
    } else {
      createPriorityMutation.mutate({
        code: String(formData.code || "")
          .trim()
          .toLowerCase(),
        label: formData.label,
        color: formData.color,
        daysToDue: parseInt(formData.daysToDue),
        active: !!formData.active,
      });
    }
  };

  return (
    <div className="py-4 px-4 sm:px-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between pb-1">
        <div>
          <h1 className="text-2xl font-normal m-0" style={{ color: "#676a6c" }}>
            Priority Manager
          </h1>
          <p className="mt-0.5 text-sm text-blue-600">
            Manage task priorities and their system mappings
          </p>
        </div>
      </div>

      {showAddForm && (
        <div className="card p-5 rounded-md border border-gray-200 shadow-sm bg-white">
          <div className="border-b border-gray-200 pb-3 mb-4">
            <h3 className="text-base font-semibold text-gray-900">
              {editingPriority ? "Edit Priority" : "Add New Priority"}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Configure priority details and automatic due-date SLA offsets.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Code
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  className="w-full h-9 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder="e.g., medium"
                  required
                  disabled={!!editingPriority}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Label
                </label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) =>
                    setFormData({ ...formData, label: e.target.value })
                  }
                  className="w-full h-9 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
                  placeholder="e.g., Medium"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Days to Due Date
                </label>
                <input
                  type="number"
                  value={formData.daysToDue}
                  onChange={(e) =>
                    setFormData({ ...formData, daysToDue: e.target.value })
                  }
                  className="w-full h-9 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
                  placeholder="7"
                  min="1"
                  max="365"
                  required
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Auto-assign due date after this many days
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="priorityActive"
                checked={!!formData.active}
                onChange={(e) =>
                  setFormData({ ...formData, active: e.target.checked })
                }
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <label htmlFor="priorityActive" className="text-sm font-medium text-gray-700 cursor-pointer">
                Active (available in task forms)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                className="h-8 rounded-sm"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingPriority(null);
                  setFormData({
                    code: "",
                    label: "",
                    daysToDue: 14,
                    color: "#6B7280",
                    active: true,
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="h-8 rounded-sm"
                disabled={updatePriorityMutation.isPending || createPriorityMutation.isPending}
              >
                {(updatePriorityMutation.isPending || createPriorityMutation.isPending) && (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                )}
                {editingPriority ? "Save Changes" : "Add Priority"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Main Table Card */}
      <div className="card p-0 rounded-md border border-gray-200 shadow-sm overflow-hidden bg-white">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Company Task Priorities
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Task priority configured for your organization
            </p>
          </div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 w-fit">
            {(Array.isArray(priorities) ? priorities : []).length} Priorities
          </span>
        </div>

        {prioritiesLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <p className="text-sm text-gray-500">Loading priorities...</p>
          </div>
        ) : (Array.isArray(priorities) ? priorities : []).length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-500">
            No priorities configured.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-6 py-3 text-left">Priority</th>
                  <th className="px-6 py-3 text-left">Code</th>
                  <th className="px-6 py-3 text-left">Days to Due</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-center">Tasks Using</th>
                  <th className="px-6 py-3 text-center w-56">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {(Array.isArray(priorities) ? priorities : [])
                  .filter((priority) => priority && (priority._id || priority.id))
                  .map((priority) => (
                    <CompanyPriorityRow
                      key={priority._id || priority.id}
                      priority={priority}
                      onEdit={() => handleEdit(priority)}
                      onDelete={handleDelete}
                      onSetDefault={() => handleSetDefault(priority)}
                      canEdit={true}
                    />
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
