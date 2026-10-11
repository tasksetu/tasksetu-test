import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusFormModal from "./StatusFormModal";
import { apiRequest } from "@/lib/queryClient";
import { useShowToast } from "@/utils/ToastMessage";

// No static/mock data: statuses are now DB-driven via /api/task-statuses

export default function StatusManager() {
  const queryClient = useQueryClient();
  const { showSuccessToast, showErrorToast } = useShowToast();

  const { data: fetchedStatuses = [], isLoading: statusesLoading } = useQuery({
    queryKey: ["/api/task-statuses"],
    enabled: !!localStorage.getItem("token"),
  });

  const [companyStatuses, setCompanyStatuses] = useState([]);

  useEffect(() => {
    setCompanyStatuses(Array.isArray(fetchedStatuses) ? fetchedStatuses : []);
  }, [fetchedStatuses]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStatus, setEditingStatus] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);

  const createStatusMutation = useMutation({
    mutationFn: async (statusData) => {
      const res = await apiRequest("POST", "/api/task-statuses", statusData);
      return res.json();
    },
    onSuccess: (payload) => {
      if (payload?.success === false) {
        showErrorToast(payload?.message || "Failed to create status");
        return;
      }
      showSuccessToast("Status created");
      queryClient.invalidateQueries({ queryKey: ["/api/task-statuses"] });
      setShowAddForm(false);
    },
    onError: (err) => {
      showErrorToast(err?.message || "Failed to create status");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await apiRequest("PUT", `/api/task-statuses/${id}`, data);
      return res.json();
    },
    onSuccess: (payload) => {
      if (payload?.success === false) {
        showErrorToast(payload?.message || "Failed to update status");
        return;
      }
      showSuccessToast("Status updated");
      queryClient.invalidateQueries({ queryKey: ["/api/task-statuses"] });
      setEditingStatus(null);
    },
    onError: (err) => {
      showErrorToast(err?.message || "Failed to update status");
    },
  });

  const reorderStatusesMutation = useMutation({
    mutationFn: async (orderedIds) => {
      const res = await apiRequest("PATCH", "/api/task-statuses/reorder", {
        orderedIds,
      });
      return res.json();
    },
    onSuccess: (payload) => {
      if (payload?.success === false) {
        showErrorToast(payload?.message || "Failed to reorder statuses");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/task-statuses"] });
    },
    onError: (err) => {
      showErrorToast(err?.message || "Failed to reorder statuses");
    },
  });

  const deleteStatusMutation = useMutation({
    mutationFn: async (id) => {
      const res = await apiRequest("DELETE", `/api/task-statuses/${id}`);
      return res.json();
    },
    onSuccess: (payload) => {
      if (payload?.success === false) {
        showErrorToast(payload?.message || "Failed to delete status");
        return;
      }
      showSuccessToast("Status deleted");
      queryClient.invalidateQueries({ queryKey: ["/api/task-statuses"] });
      setDeleteModal(null);
    },
    onError: (err) => {
      showErrorToast(err?.message || "Failed to delete status");
    },
  });

  const handleAddStatus = (statusData) => {
    createStatusMutation.mutate(statusData);
  };

  const handleUpdateStatus = (updatedStatus) => {
    const id = updatedStatus?._id || updatedStatus?.id;
    if (!id) return;
    updateStatusMutation.mutate({ id, data: updatedStatus });
  };

  const handleDeleteStatus = (statusId) => {
    deleteStatusMutation.mutate(statusId);
  };

  const handleSetDefault = (status) => {
    const id = status?._id || status?.id;
    if (!id) return;
    updateStatusMutation.mutate({ id, data: { isDefault: true } });
  };

  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);

  const handleReorderStatuses = (reorderedStatuses) => {
    const updatedStatuses = reorderedStatuses.map((status, index) => ({
      ...status,
      order: index + 1,
    }));
    setCompanyStatuses(updatedStatuses);
  };

  const handleDragStart = (e, status) => {
    setDraggedItem(status);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.target.outerHTML);
    e.target.style.opacity = "0.5";
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = "1";
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (e, status) => {
    e.preventDefault();
    setDragOverItem(status);
  };

  const getStatusId = (s) => s?._id || s?.id;

  const handleDrop = (e, targetStatus) => {
    e.preventDefault();

    if (
      !draggedItem ||
      getStatusId(draggedItem) === getStatusId(targetStatus)
    ) {
      return;
    }

    const currentStatuses = [...activeCompanyStatuses].sort(
      (a, b) => a.order - b.order,
    );
    const draggedIndex = currentStatuses.findIndex(
      (s) => getStatusId(s) === getStatusId(draggedItem),
    );
    const targetIndex = currentStatuses.findIndex(
      (s) => getStatusId(s) === getStatusId(targetStatus),
    );

    // Remove dragged item from its current position
    currentStatuses.splice(draggedIndex, 1);
    // Insert at new position
    currentStatuses.splice(targetIndex, 0, draggedItem);

    // Update order numbers
    const reorderedStatuses = currentStatuses.map((status, index) => ({
      ...status,
      order: index + 1,
    }));

    // Update the full statuses array maintaining inactive items
    const updatedAllStatuses = companyStatuses.map((status) => {
      const reordered = reorderedStatuses.find(
        (r) => getStatusId(r) === getStatusId(status),
      );
      return reordered || status;
    });

    setCompanyStatuses(updatedAllStatuses);
    reorderStatusesMutation.mutate(
      reorderedStatuses.map((s) => getStatusId(s)),
    );
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const activeCompanyStatuses = useMemo(
    () => companyStatuses.filter((s) => s.active),
    [companyStatuses],
  );

  const sortedActiveCompanyStatuses = useMemo(
    () => [...activeCompanyStatuses].sort((a, b) => a.order - b.order),
    [activeCompanyStatuses],
  );

  return (
    <div className="py-4 px-4 sm:px-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between pb-1">
        <div>
          <h1 className="text-2xl font-normal m-0" style={{ color: "#676a6c" }}>
            Company Status Configuration
          </h1>
          <p className="mt-0.5 text-sm text-blue-600">
            Configure task status for your organization
          </p>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card p-0 rounded-md border border-gray-200 shadow-sm overflow-hidden bg-white">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Company Task Status
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Task status configured for your organization. Drag and drop rows to customize workflow order.
            </p>
          </div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 w-fit">
            {activeCompanyStatuses.length} Statuses
          </span>
        </div>

        {statusesLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <p className="text-sm text-gray-500">Loading statuses...</p>
          </div>
        ) : sortedActiveCompanyStatuses.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-500">
            No task statuses found.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-6 py-3 w-28 text-left">Order</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Code</th>
                  <th className="px-6 py-3 text-left">Type</th>
                  <th className="px-6 py-3 text-center">Tasks Using</th>
                  <th className="px-6 py-3 text-center w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {sortedActiveCompanyStatuses.map((status) => (
                  <CompanyStatusRow
                    key={status._id || status.id}
                    status={status}
                    onEdit={() => setEditingStatus(status)}
                    onDelete={() => setDeleteModal(status)}
                    onSetDefault={() => handleSetDefault(status)}
                    canEdit={true}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDrop={handleDrop}
                    isDraggedOver={
                      dragOverItem &&
                      getStatusId(dragOverItem) === getStatusId(status)
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddForm && (
        <div className="status-form-modal-overlay">
          <div className="status-form-modal">
            <h2>Create New Status</h2>
            <StatusFormModal
              onSubmit={handleAddStatus}
              onClose={() => setShowAddForm(false)}
              existingStatuses={companyStatuses}
            />
          </div>
        </div>
      )}

      {editingStatus && (
        <div className="status-form-modal-overlay">
          <div className="status-form-modal">
            <h2>Edit Status</h2>
            <StatusFormModal
              status={editingStatus}
              onSubmit={handleUpdateStatus}
              onClose={() => setEditingStatus(null)}
              existingStatuses={companyStatuses}
              isEdit={true}
            />
          </div>
        </div>
      )}

      {deleteModal && (
        <ConfirmDeleteStatusModal
          status={deleteModal}
          onConfirm={handleDeleteStatus}
          onClose={() => setDeleteModal(null)}
        />
      )}

      {/* Slide-in Drawer */}
    </div>
  );
}

function CompanyStatusRow({
  status,
  onEdit,
  onDelete,
  onSetDefault,
  canEdit,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragEnter,
  onDrop,
  isDraggedOver,
}) {
  const taskCount = status?.tasksUsing || 0;
  const statusId = status?._id || status?.id;

  return (
    <tr
      className={`transition-colors duration-150 ${
        isDraggedOver
          ? "bg-blue-50/80 ring-2 ring-blue-400 ring-inset"
          : "hover:bg-gray-50/80"
      }`}
      draggable={canEdit}
      onDragStart={(e) => onDragStart(e, status)}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragEnter={(e) => onDragEnter(e, status)}
      onDrop={(e) => onDrop(e, status)}
    >
      <td className="px-6 py-3.5 whitespace-nowrap">
        <div className="flex items-center gap-2">
          {canEdit && (
            <div
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 rounded-md cursor-grab active:cursor-grabbing transition-colors inline-flex items-center justify-center"
              title="Drag to reorder"
            >
              <GripVertical className="w-4 h-4" />
            </div>
          )}
          <span className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-semibold text-gray-700 bg-gray-100/80 border border-gray-200/60">
            {status.order}
          </span>
        </div>
      </td>
      <td className="px-6 py-3.5 whitespace-nowrap">
        <div className="flex items-center gap-2.5">
          <span
            className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm shrink-0"
            style={{ backgroundColor: status.color || "#6b7280" }}
          />
          <span className="font-medium text-gray-900 text-sm">
            {status.label}
          </span>
          {status.isDefault && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
              Default
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-3.5 whitespace-nowrap">
        <code className="text-xs font-mono font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200/80">
          {status.code}
        </code>
      </td>
      <td className="px-6 py-3.5 whitespace-nowrap">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
            status.isFinal
              ? "bg-rose-50 text-rose-700 border-rose-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              status.isFinal ? "bg-rose-500" : "bg-emerald-500"
            }`}
          />
          {status.isFinal ? "Final" : "Active"}
        </span>
      </td>
      <td className="px-6 py-3.5 whitespace-nowrap text-center">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200">
          {taskCount} {taskCount === 1 ? "task" : "tasks"}
        </span>
      </td>
      <td className="px-6 py-3.5 whitespace-nowrap text-center">
        <div className="flex justify-center items-center">
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              disabled={status.isDefault}
              className={`h-7 px-3 text-xs font-medium transition-colors ${
                status.isDefault
                  ? "text-gray-300 cursor-not-allowed hover:bg-transparent"
                  : "text-blue-600 hover:text-blue-800 hover:bg-blue-50"
              }`}
              onClick={status.isDefault ? undefined : onSetDefault}
            >
              Set Default
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

function ConfirmDeleteStatusModal({ status, onConfirm, onClose }) {
  const statusId = status?._id || status?.id;
  const taskCount = status?.tasksUsing || 0;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h3>Delete Status: {status?.label}</h3>
          <Button
            variant="ghost"
            size="icon"
            className="close-button"
            onClick={onClose}
          >
            ×
          </Button>
        </div>

        <div className="modal-content">
          <div className="warning-message">
            <p>
              This action will permanently delete the "{status?.label}" status.
            </p>
            {taskCount > 0 && (
              <p className="mt-2 text-sm text-gray-600">
                Cannot delete: {taskCount} tasks are currently using this
                status.
              </p>
            )}
          </div>

          <div className="modal-actions">
            <Button variant="outline" className="h-9" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="h-9"
              onClick={() => onConfirm(statusId)}
              disabled={!statusId || taskCount > 0}
            >
              Delete Status
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
