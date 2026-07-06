
import { useState, useCallback } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { getTaskType } from "../utils/taskHelpers";

export const useTaskOperations = ({
  apiTasks,
  setApiTasks,
  refetchTasks,
  showSuccessToast,
  showErrorToast,
  companyStatuses,
}) => {
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: "",
    title: "",
    message: "",
    onConfirm: null,
    data: null,
  });

  const executeStatusChange = useCallback(
    async (task, newStatusCode, reason = null) => {
      try {
        const apiTaskId = task._id || task.id;
        const statusMapping = {
          OPEN: "OPEN",
          INPROGRESS: "INPROGRESS",
          "IN-PROGRESS": "INPROGRESS",
          IN_PROGRESS: "INPROGRESS",
          DONE: "DONE",
          COMPLETED: "DONE",
          ONHOLD: "ONHOLD",
          "ON-HOLD": "ONHOLD",
          CANCELLED: "CANCELLED",
          CANCELED: "CANCELLED",
        };
        const backendStatus =
          statusMapping[newStatusCode] || newStatusCode?.toString().toUpperCase();
        const payload = { status: backendStatus, notes: reason || undefined };
        if (newStatusCode === "DONE") payload.completedDate = new Date().toISOString();

        const response = await axios.patch(`/api/tasks/${apiTaskId}/status`, payload, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });

        if (response.data?.success) {
          setApiTasks((prev) =>
            prev.map((t) => {
              if (t.id === task.id || t._id === task._id) {
                const statusObj = companyStatuses.find((s) => s.code === newStatusCode);
                const newProgress =
                  newStatusCode === "DONE" ? 100 : t.progress;
                return {
                  ...t,
                  status: newStatusCode,
                  statusColor: statusObj?.color,
                  colorCode: statusObj?.color,
                  progress: newProgress,
                  updatedAt: new Date().toISOString(),
                  ...(newStatusCode === "DONE" && { completedDate: new Date().toISOString() }),
                };
              }
              return t;
            })
          );
          const newStatus = companyStatuses.find((s) => s.code === newStatusCode);
          showSuccessToast?.(
            `Task "${task.title}" status updated to "${newStatus?.label || newStatusCode}"`
          );
          await refetchTasks?.();
        } else {
          showErrorToast?.(response.data?.message || "Failed to update task status.");
        }
      } catch (error) {
        console.error("Status update error:", error);
        showErrorToast?.(error.response?.data?.message || "Error updating task status");
      }
    },
    [setApiTasks, companyStatuses, showSuccessToast, showErrorToast]
  );

  const handleDeleteTask = useCallback(
    async (taskId) => {
      try {
        const task = apiTasks.find((t) => t.id === taskId || t._id === taskId);
        if (!task) {
          showErrorToast?.("Task not found");
          return;
        }

        const apiTaskId = task._id || task.id;
        const response = await axios.delete(`/api/tasks/delete/${apiTaskId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });

        if (response.data?.success) {
          setApiTasks((prev) => prev.filter((t) => t.id !== taskId && t._id !== taskId));
          showSuccessToast?.(`Task "${task.title}" deleted`);
          await refetchTasks?.();
        } else {
          throw new Error(response.data?.message || "Failed to delete task");
        }
      } catch (error) {
        showErrorToast?.(error.response?.data?.message || "Error deleting task");
      }
    },
    [apiTasks, setApiTasks, refetchTasks, showSuccessToast, showErrorToast]
  );

  const handleBulkDeleteTasks = useCallback(
    async (selectedTaskIds, selectedTaskObjects) => {
      try {
        const token = localStorage.getItem("token");
        const deletePromises = selectedTaskObjects.map((task) =>
          axios.delete(`/api/tasks/delete/${task._id || task.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        );
        const results = await Promise.allSettled(deletePromises);
        let successCount = 0;
        results.forEach((result) => {
          if (result.status === "fulfilled" && result.value.data?.success) successCount++;
        });
        setApiTasks((prev) =>
          prev.filter((task) => !selectedTaskIds.includes(task.id) && !selectedTaskIds.includes(task._id))
        );
        showSuccessToast?.(`${successCount} tasks deleted`);
        await refetchTasks?.();
      } catch (error) {
        showErrorToast?.("Error occurred during bulk delete");
      }
    },
    [setApiTasks, refetchTasks, showSuccessToast, showErrorToast]
  );

  const handleSnoozeTask = useCallback(
    async (taskId, snoozeData = null) => {
      try {
        const task = apiTasks.find((t) => t.id === taskId || t._id === taskId);
        if (!task) {
          showErrorToast?.("Task not found");
          return;
        }
        if (task.status === "DONE") {
          showErrorToast?.("Completed tasks cannot be snoozed.");
          return;
        }

        const apiTaskId = task._id || task.id;

        if (snoozeData?.action === "unsnooze") {
          setApiTasks((prev) =>
            prev.map((t) =>
              t.id === taskId || t._id === taskId
                ? { ...t, isSnooze: false, snoozedUntil: null, snoozeUntil: null, snoozeReason: null }
                : t
            )
          );
          await refetchTasks?.();
          return;
        }

        const defaultSnoozeUntil = new Date();
        defaultSnoozeUntil.setHours(defaultSnoozeUntil.getHours() + 1);

        const response = await axios.patch(
          `/api/tasks/${apiTaskId}/snooze`,
          {
            snoozeUntil: snoozeData?.snoozeUntil || defaultSnoozeUntil.toISOString(),
            reason: snoozeData?.reason || "Task snoozed temporarily",
          },
          { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
        );

        if (response.data?.success) {
          setApiTasks((prev) =>
            prev.map((t) =>
              t.id === taskId || t._id === taskId
                ? {
                    ...t,
                    isSnooze: true,
                    snoozeUntil: snoozeData?.snoozeUntil || defaultSnoozeUntil.toISOString(),
                    snoozedUntil: snoozeData?.snoozeUntil || defaultSnoozeUntil.toISOString(),
                    snoozeReason: snoozeData?.reason || "Task snoozed temporarily",
                  }
                : t
            )
          );
          showSuccessToast?.("Task snoozed");
          await refetchTasks?.();
        }
      } catch (error) {
        showErrorToast?.(error.response?.data?.message || "Failed to update snooze status");
      }
    },
    [apiTasks, setApiTasks, refetchTasks, showSuccessToast, showErrorToast]
  );

  const handleMarkAsRisk = useCallback(
    async (taskId, riskData = null) => {
      try {
        const task = apiTasks.find((t) => t.id === taskId || t._id === taskId);
        if (!task) {
          showErrorToast?.("Task not found");
          return;
        }
        if (task.status === "DONE") {
          showErrorToast?.("Completed tasks cannot be marked as risk.");
          return;
        }

        const apiTaskId = task._id || task.id;

        if (riskData?.action === "unmark") {
          setApiTasks((prev) =>
            prev.map((t) =>
              t.id === taskId || t._id === taskId
                ? { ...t, isRisk: false, riskLevel: null, riskReason: null }
                : t
            )
          );
          await refetchTasks?.();
          return;
        }

        const response = await axios.patch(
          `/api/tasks/${apiTaskId}/mark-risk`,
          {
            riskLevel: riskData?.riskLevel || "medium",
            riskReason: riskData?.riskReason || "Task requires attention",
          },
          { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
        );

        if (response.data?.success) {
          setApiTasks((prev) =>
            prev.map((t) =>
              t.id === taskId || t._id === taskId
                ? {
                    ...t,
                    isRisk: true,
                    riskLevel: riskData?.riskLevel || "medium",
                    riskReason: riskData?.riskReason || "Task requires attention",
                  }
                : t
            )
          );
          showSuccessToast?.("Task marked as risky");
          await refetchTasks?.();
        }
      } catch (error) {
        showErrorToast?.(error.response?.data?.message || "Failed to update risk status");
      }
    },
    [apiTasks, setApiTasks, refetchTasks, showSuccessToast, showErrorToast]
  );

  const handleQuickMarkAsDone = useCallback(
    async (taskId, forceComplete = false, completionNotes = null) => {
      try {
        const task = apiTasks.find((t) => t.id === taskId || t._id === taskId);
        if (!task) {
          showErrorToast?.("Task not found");
          return;
        }
        if (task.status === "DONE") {
          showErrorToast?.("Task is already completed.");
          return;
        }

        const response = await axios.patch(
          `/api/tasks/${taskId}/quick-done`,
          {
            completionNotes: completionNotes || "Task completed quickly by user",
            forceComplete,
          },
          { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
        );

        if (response.data?.success) {
          setApiTasks((prev) =>
            prev.map((t) =>
              t.id === taskId || t._id === taskId
                ? { ...t, status: "DONE", progress: 100, completedDate: new Date().toISOString() }
                : t
            )
          );
          showSuccessToast?.(response.data.message || "Task marked as completed");
          await refetchTasks?.();
        }
      } catch (error) {
        showErrorToast?.(error.response?.data?.message || "Failed to mark task as completed");
      }
    },
    [apiTasks, setApiTasks, refetchTasks, showSuccessToast, showErrorToast]
  );

  const exportTasksCSV = useCallback(
    (tasksToExport, filename = "tasks.csv") => {
      if (!tasksToExport?.length) {
        showErrorToast?.("No tasks to export");
        return;
      }
      const headers = ["ID", "Title", "Assignee", "Status", "Priority", "Due Date", "Progress", "Tags", "Type"];
      const rows = tasksToExport.map((t) => [
        t.id || t._id || "",
        t.title || "",
        t.assignee || "",
        t.status || "",
        t.priority || "",
        t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-GB") : "",
        t.progress !== undefined ? `${t.progress}%` : "",
        (t.tags || []).join(", "),
        getTaskType(t),
      ]);
      const csvContent = [headers, ...rows]
        .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showSuccessToast?.("CSV exported");
    },
    [showSuccessToast, showErrorToast]
  );

  const exportTasksExcel = useCallback(
    (tasksToExport, filename = "tasks.xlsx") => {
      if (!tasksToExport?.length) {
        showErrorToast?.("No tasks to export");
        return;
      }
      const wsData = [
        ["ID", "Title", "Assignee", "Status", "Priority", "Due Date", "Progress", "Tags", "Type"],
        ...tasksToExport.map((t) => [
          t.id || t._id || "",
          t.title || "",
          t.assignee || "",
          t.status || "",
          t.priority || "",
          t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-GB") : "",
          t.progress !== undefined ? `${t.progress}%` : "",
          (t.tags || []).join(", "),
          getTaskType(t),
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Tasks");
      XLSX.writeFile(wb, filename);
      showSuccessToast?.("Excel exported");
    },
    [showSuccessToast, showErrorToast]
  );

  return {
    confirmModal,
    setConfirmModal,
    executeStatusChange,
    handleDeleteTask,
    handleBulkDeleteTasks,
    handleSnoozeTask,
    handleMarkAsRisk,
    handleQuickMarkAsDone,
    exportTasksCSV,
    exportTasksExcel,
  };
};