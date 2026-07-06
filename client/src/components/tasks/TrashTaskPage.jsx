

import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useShowToast } from "@/utils/ToastMessage";
import { Trash2, RotateCcw, Eye, Loader } from "lucide-react";

export default function TrashTaskPage() {
  const { showSuccessToast, showErrorToast } = useShowToast();
  const token = localStorage.getItem("token");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Fetch trashed tasks for current user
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["trash-tasks"],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/trash?page=${currentPage}&limit=${itemsPerPage}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json.data;
    },
    keepPreviousData: true,
  });

  // Recover task mutation
  const recoverMutation = useMutation({
    mutationFn: async (taskId) => {
      const res = await fetch(`/api/tasks/${taskId}/recover`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      showSuccessToast("Task recovered");
      refetch();
    },
    onError: (err) => showErrorToast(err.message),
  });

  // Permanently delete task mutation
  const deleteForeverMutation = useMutation({
    mutationFn: async (taskId) => {
      const res = await fetch(`/api/tasks/${taskId}/delete-forever`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      showSuccessToast("Task deleted permanently");
      refetch();
    },
    onError: (err) => showErrorToast(err.message),
  });

  // View task handler
  const handleView = (taskId) => {
    window.location.href = `/tasks/${taskId}`;
  };

  // Pagination helpers
  // If API returns { tasks: [], pagination: { ... } }, use tasks and pagination
  // If API returns just an array, treat as all tasks (no pagination)
  const isPaginated = Array.isArray(data?.tasks) && data?.pagination;
  const tasks = isPaginated ? data.tasks : Array.isArray(data) ? data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) : [];
  const totalTasks = isPaginated ? data.pagination.totalTasks : Array.isArray(data) ? data.length : 0;
  const totalPages = isPaginated ? data.pagination.totalPages : Math.ceil(totalTasks / itemsPerPage) || 1;

  return (
    <div className="trash-tasks-square py-3 px-6">
      <style>{`
        .trash-tasks-square .card,
        .trash-tasks-square .card:hover,
        .trash-tasks-square .card:focus-within {
          transform: none !important;
        }
      `}</style>
      <h2 className="text-2xl font-normal m-0" style={{ color: "#676a6c" }}>Trash Tasks</h2>
      <p className="mt-0 text-sm text-blue-600">
        Your deleted tasks
      </p>
      {isLoading ? (
         <div className="flex items-center justify-center min-h-[400px] ">
          <div className="flex flex-col items-center gap-3">
            <Loader className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-lg text-gray-600">Loading trashed tasks...</p>
          </div>
        </div>

      ) : isError ? (
        <div className="flex justify-center items-center py-10">
          <span className="text-lg text-red-500">{error?.message || "Error loading trashed tasks"}</span>
        </div>
      ) : (
        <div className="card mt-4 p-0">
          <div className="w-full overflow-x-auto">
            <Table wrapperClassName="max-w-[80rem]" className="w-full scroll-container scrollbar-hide">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-6 py-2 h-10 text-left text-xs font-medium leading-none text-gray-900 uppercase tracking-wider text-nowrap">Title</TableHead>
                  <TableHead className="px-6 py-2 h-10 text-left text-xs font-medium leading-none text-gray-900 uppercase tracking-wider text-nowrap">Deleted At</TableHead>
                  <TableHead className="px-6 py-2 h-10 text-left text-xs font-medium leading-none text-gray-900 uppercase tracking-wider text-nowrap">Deleted By</TableHead>
                  <TableHead className="px-6 py-2 h-10 text-left text-xs font-medium leading-none text-gray-900 uppercase tracking-wider text-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">No trash tasks found.</TableCell>
                  </TableRow>
                ) : (
                  tasks.map((task) => (
                    <TableRow key={task._id}>
                      <TableCell className="px-6 py-3 text-nowrap">{task.title}</TableCell>
                      <TableCell className="px-6 py-3 text-nowrap">{task.deleted_at ? new Date(task.deleted_at).toLocaleString() : "-"}</TableCell>
                      <TableCell className="px-6 py-3 text-nowrap">{task.deleted_by?.name || task.deleted_by?.email || "Unknown"}</TableCell>
                      <TableCell className="px-6 py-3 text-nowrap flex gap-2">
                        {/* <Button variant="outline" size="sm" onClick={() => handleView(task._id)} title="View">
                          <Eye className="w-4 h-4" />
                        </Button> */}
                        <Button variant="default" size="sm" onClick={() => recoverMutation.mutate(task._id)} disabled={recoverMutation.isPending} title="Recover">
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => deleteForeverMutation.mutate(task._id)} disabled={deleteForeverMutation.isPending} title="Delete Forever">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-5 py-3 border-t border-gray-200">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{tasks.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1}</span> to{' '}
                <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalTasks)}</span> of <span className="font-medium">{totalTasks}</span> tasks
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-9" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1}>
                  Prev
                </Button>
                <span className="text-sm">Page {currentPage} of {totalPages}</span>
                <Button variant="outline" size="sm" className="h-9" onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
                  Next
                </Button>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={currentPage}
                  onChange={(e) => {
                    const page = parseInt(e.target.value);
                    if (page >= 1 && page <= totalPages) setCurrentPage(page);
                  }}
                  className="w-16 px-2 py-1 h-9 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ml-2"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
