import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

  return (
    <div className="status-manager-container py-3 px-6 max-w-7xl mx-auto space-y-3 bg-gray-50 min-h-full">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div className="relative">
         <h1 className="text-2xl font-normal mt-2"
                style={{ color: "#676a6c" }}>
            Company Status Configuration
          </h1>
           <p className="mt-0 text-sm text-blue-600">
            Configure task status for your organization
          </p>
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-sm rounded-sm shadow-xl border border-gray-200/50 p-7">
        {/* <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Button
              variant="primary"
              className="h-9 relative overflow-hidden group"
              onClick={() => setShowAddForm(true)}
            >
              <svg
                className="w-5 h-5 mr-2 transition-transform duration-300 group-hover:rotate-90"
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
              Add Status
            </Button>
          </div>
          <div className="text-sm text-gray-500">
            {statusesLoading
              ? "Loading statuses..."
              : `Statuses: ${activeCompanyStatuses.length}`}
          </div>
        </div> */}

        <div className="">
          <div className="status-list company-statuses">
            <div className="section-header">
              <h3>Company Task Status</h3>
              <p>Task status configured for your organization</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order
                    </th>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
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
                  {activeCompanyStatuses
                    .sort((a, b) => a.order - b.order)
                    .map((status) => (
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
                          (dragOverItem._id || dragOverItem.id) ===
                            (status._id || status.id)
                        }
                      />
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
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
      className={`${isDraggedOver ? "bg-blue-50" : "hover:bg-gray-50"} transition-colors duration-200`}
      draggable={canEdit}
      onDragStart={(e) => onDragStart(e, status)}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragEnter={(e) => onDragEnter(e, status)}
      onDrop={(e) => onDrop(e, status)}
    >
      <td className="px-6 py-2 whitespace-nowrap">
        <div className="flex items-center space-x-2">
          <div className={`text-gray-400 ${canEdit ? "cursor-move" : ""}`}>
            &#894;&#894;
          </div>
          <span className="text-sm font-medium text-gray-900">
            {status.order}
          </span>
        </div>
      </td>
      <td className="px-6 py-2 whitespace-nowrap">
        <div className="flex items-center space-x-3">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: status.color }}
          />
          <span className="text-sm font-medium text-gray-900">
            {status.label}
          </span>
          {status.isDefault && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
              DEFAULT
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-2 whitespace-nowrap">
        <code className="text-sm bg-gray-100 px-2 py-1 rounded-md">
          {status.code}
        </code>
      </td>
      <td className="px-6 py-2 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${
            status.isFinal
              ? "bg-red-100 text-red-800"
              : "bg-green-100 text-green-800"
          }`}
        >
          {status.isFinal ? "Final" : "Active"}
        </span>
      </td>
      <td className="px-6 py-2 whitespace-nowrap">
        <div className="text-sm">
          <div className="text-gray-900 font-medium">{taskCount}</div>
          <div className="text-gray-500">tasks</div>
        </div>
      </td>
      <td className="px-6 py-2 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex space-x-2">
          {canEdit && (
            <>
              <Button
                variant="ghost"
                className="text-indigo-600 hover:text-indigo-900 transition-colors duration-200"
                onClick={onEdit}
              >
                Edit
              </Button>
              {!status.isDefault && (
                <Button
                  variant="ghost"
                  className="text-blue-600 hover:text-blue-900 transition-colors duration-200"
                  onClick={onSetDefault}
                >
                  Set Default
                </Button>
              )}
              <Button
                variant="ghost"
                className={`transition-colors duration-200 ${
                  taskCount > 0
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-red-600 hover:text-red-900"
                }`}
                onClick={() => onDelete(statusId)}
                disabled={taskCount > 0}
                title={
                  taskCount > 0
                    ? `Cannot delete: ${taskCount} tasks using this status`
                    : "Delete status"
                }
              >
                Delete
              </Button>
            </>
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
