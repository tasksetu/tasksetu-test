import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { TaskForm } from "./TaskForm";
import SafeHtml from "../common/SafeHtml";
import {
  Plus,
  Calendar,
  User,
  Clock,
  AlertCircle,
  CheckCircle,
  PlayCircle,
  PauseCircle,
  Edit2,
  Trash2,
  GripVertical
} from "lucide-react";

export function TaskKanbanView() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["/api/tasks"],
    queryFn: async () => {
      const response = await fetch("/api/tasks");
      if (!response.ok) throw new Error("Failed to fetch tasks");
      return response.json();
    }
  });

  // Fetch users
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    }
  });

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const response = await fetch("/api/projects");
      if (!response.ok) throw new Error("Failed to fetch projects");
      return response.json();
    }
  });

  // Fetch task statuses
  const { data: taskStatuses = [] } = useQuery({
    queryKey: ["/api/task-statuses"],
  });

  // Update task status mutation
  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, newStatus }) => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) throw new Error("Failed to update task status");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(["/api/tasks"]);
      toast({
        title: "Task updated",
        description: `Task moved to ${data.status}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update task",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData) => {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData)
      });
      if (!response.ok) throw new Error("Failed to create task");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(["/api/tasks"]);
      setShowCreateForm(false);
      toast({
        title: "Task created successfully",
        description: `"${data.title}" has been created.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create task",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to update task");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(["/api/tasks"]);
      setEditingTask(null);
      toast({
        title: "Task updated successfully",
        description: `"${data.title}" has been updated.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update task",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (id) => {
      const response = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete task");
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/tasks"]);
      toast({
        title: "Task deleted successfully",
        description: "The task has been removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete task",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Define columns
  const columns = [
    {
      id: "todo",
      title: "To Do",
      icon: AlertCircle,
      color: "text-slate-600",
      bgColor: "bg-slate-50",
      borderColor: "border-slate-200"
    },
    {
      id: "in-progress",
      title: "In Progress",
      icon: PlayCircle,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200"
    },
    {
      id: "completed",
      title: "Completed",
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200"
    }
  ];

  // Group tasks by status
  const tasksByStatus = tasks.reduce((acc, task) => {
    const status = task.status || "todo";
    if (!acc[status]) acc[status] = [];
    acc[status].push(task);
    return acc;
  }, {});

  // Drag and drop handlers
  const handleDragStart = useCallback((e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback((e, newStatus) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (draggedTask && draggedTask.status !== newStatus) {
      updateTaskStatusMutation.mutate({
        taskId: draggedTask._id,
        newStatus
      });
    }
    setDraggedTask(null);
  }, [draggedTask, updateTaskStatusMutation]);

  const getUserName = (userId) => {
    const user = users.find(u => u._id === userId);
    return user ? `${user.firstName} ${user.lastName}` : "Unassigned";
  };

  const getUserInitials = (userId) => {
    const user = users.find(u => u._id === userId);
    if (!user) return "UN";
    return `${user.firstName?.charAt(0) || ""}${user.lastName?.charAt(0) || ""}`.toUpperCase();
  };

  const formatDate = (date) => {
    if (!date) return "No due date";
    const taskDate = new Date(date);
    const today = new Date();
    const diffTime = taskDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Due today";
    if (diffDays === 1) return "Due tomorrow";
    if (diffDays > 0) return `Due in ${diffDays} days`;
    return `Overdue by ${Math.abs(diffDays)} days`;
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case "high": return "border-l-red-500";
      case "medium": return "border-l-blue-500";
      case "low": return "border-l-green-500";
      default: return "border-l-slate-300";
    }
  };

  const handleCreateTask = (taskData) => {
    createTaskMutation.mutate(taskData);
  };

  const handleUpdateTask = (taskData) => {
    updateTaskMutation.mutate({
      id: editingTask._id,
      data: taskData
    });
  };

  const handleDeleteTask = (taskId) => {
    if (confirm("Are you sure you want to delete this task?")) {
      deleteTaskMutation.mutate(taskId);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {columns.map((column) => (
          <Card key={column.id} className="border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
            <CardHeader className="pb-4">
              <div className="h-6 bg-slate-200 rounded animate-pulse"></div>
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-32 bg-slate-200 rounded animate-pulse"></div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Kanban Board
          </h2>
          <p className="text-slate-600  mt-1">
            Drag and drop tasks to update their status
          </p>
        </div>
        {/* <Button 
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button> */}
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {columns.map((column) => {
          const IconComponent = column.icon;
          const columnTasks = tasksByStatus[column.id] || [];

          return (
            <Card
              key={column.id}
              className={`border-slate-200  shadow-sm bg-white  transition-all duration-200 ${dragOverColumn === column.id ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
                }`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <CardHeader className={`pb-4 ${column.bgColor} rounded-t-lg border-b ${column.borderColor}`}>
                <CardTitle className={`text-lg font-semibold ${column.color} flex items-center justify-between`}>
                  <div className="flex items-center space-x-2">
                    <IconComponent className="h-5 w-5" />
                    <span>{column.title}</span>
                  </div>
                  <Badge variant="secondary" className="bg-white/80 text-slate-700">
                    {columnTasks.length}
                  </Badge>
                </CardTitle>
              </CardHeader>

              <CardContent className="p-4 space-y-3 min-h-[400px]">
                {columnTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className={`p-3 rounded-full ${column.bgColor} mb-3`}>
                      <IconComponent className={`h-6 w-6 ${column.color}`} />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                      No tasks in {column.title.toLowerCase()}
                    </p>
                  </div>
                ) : (
                  columnTasks.map((task) => (
                    <Card
                      key={task._id}
                      className={`cursor-move hover:shadow-md transition-all duration-200 border-l-4 ${getPriorityColor(task.priority)} ${draggedTask?._id === task._id ? 'opacity-50' : ''
                        }`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="font-semibold text-slate-900 dark:text-white text-sm leading-tight">
                            {task.title}
                          </h4>
                          <div className="flex items-center space-x-1 ml-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingTask(task)}
                              className="h-6 w-6 p-0 hover:bg-slate-100"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTask(task._id)}
                              className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {task.description && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
                            <SafeHtml html={task.description} truncate={true} maxLength={120} as="span" />
                          </p>
                        )}

                        <div className="space-y-2">
                          {task.dueDate && (
                            <div className="flex items-center space-x-1 text-xs text-slate-500">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(task.dueDate)}</span>
                            </div>
                          )}

                          {task.assignedToId && (
                            <div className="flex items-center space-x-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs bg-slate-100 text-slate-600">
                                  {getUserInitials(task.assignedToId)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs text-slate-600 dark:text-slate-400">
                                {getUserName(task.assignedToId)}
                              </span>
                            </div>
                          )}

                          {task.priority && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${task.priority === "high"
                                ? "border-red-200 text-red-700 bg-red-50"
                                : task.priority === "medium"
                                  ? "border-blue-200 text-blue-700 bg-blue-50"
                                  : "border-green-200 text-green-700 bg-green-50"
                                }`}
                            >
                              {task.priority}
                            </Badge>
                          )}
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1 text-xs text-slate-500">
                              <GripVertical className="h-3 w-3" />
                              <span>Drag to move</span>
                            </div>
                            {updateTaskStatusMutation.isPending && (
                              <div className="flex items-center space-x-1 text-xs text-blue-600">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                <span>Updating...</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create Task Form */}
      <TaskForm
        isOpen={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        onSubmit={handleCreateTask}
        users={users}
        projects={projects}
        taskStatuses={taskStatuses}
        isLoading={createTaskMutation.isPending}
      />

      {/* Edit Task Form */}
      <TaskForm
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSubmit={handleUpdateTask}
        initialData={editingTask}
        users={users}
        projects={projects}
        taskStatuses={taskStatuses}
        isLoading={updateTaskMutation.isPending}
      />
    </div>
  );
}