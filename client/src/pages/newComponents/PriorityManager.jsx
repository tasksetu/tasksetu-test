import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
    <tr>
      <td className="px-6 py-2 text-sm text-gray-900">
        {priority.label || "Unnamed Priority"}
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
            {priority.daysToDue ?? 0} days
          </span>
          {priority.isDefault && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-green-100 text-green-800">
              Default
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-2 whitespace-nowrap">
        <div className="text-sm">
          <div className="text-gray-900 font-medium">{taskCount}</div>
          <div className="text-gray-500">tasks</div>
        </div>
      </td>
      <td className="px-6 py-2">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="h-8"
            onClick={onEdit}
            disabled={!canEdit}
          >
            Edit
          </Button>
          <Button
            variant="destructive"
            className="h-8"
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
          <Button
            variant="primary"
            className="h-8 bg-green-600 hover:bg-green-700"
            onClick={onSetDefault}
            disabled={!canEdit}
          >
            Set Default
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
    <div className="py-3 px-6 min-h-full overflow-x-hidden bg-gray-50 [&_button]:!rounded-md">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-normal m-0"
                style={{ color: "#676a6c" }}>Priority Manager</h1>
           <p className="mt-0 text-sm text-blue-600">
            Manage task priorities and their system mappings
          </p>
        </div>
        {/* <Button
          variant="primary"
          className="h-8 mt-4 lg:mt-0"
          onClick={() => setShowAddForm(true)}
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Priority
        </Button> */}
      </div>

      {showAddForm && (
        <div className="card rounded-md [&:hover]:!transform-none [&:hover]:!shadow-none">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            {editingPriority ? "Edit Priority" : "Add New Priority"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-3  gap-3">
              <div>
                <label className="form-label">Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  className="form-input"
                  placeholder="e.g., medium"
                  required
                  disabled={!!editingPriority}
                />
              </div>
              <div>
                <label className="form-label">Label</label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) =>
                    setFormData({ ...formData, label: e.target.value })
                  }
                  className="form-input"
                  placeholder="e.g., Medium"
                  required
                />
              </div>
              <div>
                <label className="form-label">Days to Due Date</label>
                <input
                  type="number"
                  value={formData.daysToDue}
                  onChange={(e) =>
                    setFormData({ ...formData, daysToDue: e.target.value })
                  }
                  className="form-input"
                  placeholder="7"
                  min="1"
                  max="365"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Auto-assign due date after this many days
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Color</label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                  className="w-full h-10 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex items-center gap-2 mt-6">
                <input
                  type="checkbox"
                  checked={!!formData.active}
                  onChange={(e) =>
                    setFormData({ ...formData, active: e.target.checked })
                  }
                />
                <span className="text-sm text-gray-700">Active</span>
              </div>
            </div>
            <div className="flex justify-between space-x-3">
              <Button
                type="button"
                variant="outline"
                className="h-8"
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
              <Button type="submit" variant="primary" className="h-8">
                {editingPriority ? "Update Priority" : "Add Priority"}
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="card rounded-md p-0 overflow-hidden [&:hover]:!transform-none [&:hover]:!shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Days to Due
                </th>
                <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tasks Using
                </th>
                <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
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
      </div>
    </div>
  );
}
