import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  ArrowUpRight,
  Calendar,
  Flag,
  Check,
  X,
  Archive,
  ExternalLink,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { format, addDays, isToday, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import { useShowToast } from "@/utils/ToastMessage";

export default function QuickTaskWidget() {
  const { showSuccessToast, showErrorToast } = useShowToast();
  const [quickTasks, setQuickTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("low");
  const [newTaskDueDate, setNewTaskDueDate] = useState(addDays(new Date(), 3));
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState("");
  const inputRef = useRef(null);

  // Auto-archive completed tasks after 7 days
  useEffect(() => {
    const autoArchiveInterval = setInterval(
      () => {
        setQuickTasks((prev) =>
          prev.map((task) => {
            if (task.status === "done" && task.completedAt) {
              const daysSinceCompleted = Math.floor(
                (new Date().getTime() - new Date(task.completedAt).getTime()) /
                  (1000 * 60 * 60 * 24),
              );

              if (daysSinceCompleted >= 7) {
                return { ...task, status: "archived", updatedAt: new Date() };
              }
            }
            return task;
          }),
        );
      },
      1000 * 60 * 60,
    ); // Check every hour

    return () => clearInterval(autoArchiveInterval);
  }, []);

  // Mock data for demonstration
  useEffect(() => {
    const mockTasks = [
      {
        id: "1",
        title: "Follow up with SAP for service requests",
        createdBy: "current-user",
        priority: "medium",
        dueDate: addDays(new Date(), 2),
        status: "open",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "2",
        title: "Book invoices from Deloitte & KPMG",
        createdBy: "current-user",
        priority: "high",
        dueDate: new Date(),
        status: "open",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "3",
        title: "Give solution for storage maintenance",
        createdBy: "current-user",
        priority: "low",
        status: "done",
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        conversionFlag: {
          isConverted: true,
          convertedToTaskId: "TSK-001",
          convertedToTaskType: "regular",
          convertedAt: new Date(),
        },
      },
    ];
    setQuickTasks(mockTasks);
  }, []);

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case "high":
        return <Flag className="h-3 w-3 text-red-600" />;
      case "medium":
        return <Flag className="h-3 w-3 text-yellow-600" />;
      case "low":
        return <Flag className="h-3 w-3 text-green-600" />;
      default:
        return <Flag className="h-3 w-3 text-gray-600" />;
    }
  };

  const checkForDuplicates = (title) => {
    const similar = quickTasks.find(
      (task) =>
        task.title.toLowerCase().includes(title.toLowerCase()) &&
        task.status !== "archived",
    );
    if (similar && title.length > 3) {
      setDuplicateWarning(
        `A similar quick task exists: "${similar.title}". Continue?`,
      );
    } else {
      setDuplicateWarning("");
    }
  };

  const handleCreateQuickTask = () => {
    if (!newTaskTitle.trim()) {
      showErrorToast("Quick Task cannot be empty.");
      return;
    }

    const newTask = {
      id: Date.now().toString(),
      title: newTaskTitle.trim(),
      createdBy: "current-user",
      priority: newTaskPriority,
      dueDate: newTaskDueDate,
      status: "open",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setQuickTasks((prev) => [newTask, ...prev]);
    setNewTaskTitle("");
    setNewTaskPriority("low");
    setNewTaskDueDate(addDays(new Date(), 3));
    setShowNewTaskForm(false);
    setDuplicateWarning("");
  };

  const handleToggleComplete = (taskId) => {
    setQuickTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: task.status === "open" ? "done" : "open",
              completedAt: task.status === "open" ? new Date() : undefined,
              updatedAt: new Date(),
            }
          : task,
      ),
    );
  };

  const handleArchiveTask = (taskId) => {
    setQuickTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? { ...task, status: "archived", updatedAt: new Date() }
          : task,
      ),
    );
  };

  const handleConvertToTask = (taskId, taskType) => {
    // Mock conversion - in real app this would open the task creation form
    const convertedTaskId = `TSK-${Date.now().toString().slice(-3)}`;

    setQuickTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              conversionFlag: {
                isConverted: true,
                convertedToTaskId,
                convertedToTaskType: taskType,
                convertedAt: new Date(),
              },
              updatedAt: new Date(),
            }
          : task,
      ),
    );
  };

  const filteredTasks = quickTasks.filter((task) =>
    showArchived ? task.status === "archived" : task.status !== "archived",
  );

  const openTasks = filteredTasks.filter((task) => task.status === "open");
  const doneTasks = filteredTasks.filter((task) => task.status === "done");

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            My Quick Tasks
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived ? "View Active" : "View Archived"}
            </Button>
            <Button
              size="sm"
              onClick={() => setShowNewTaskForm(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              Quick Task
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* New Task Form */}
        {showNewTaskForm && (
          <div className="p-4 border border-gray-200 rounded-sm bg-gray-50">
            <div className="space-y-3">
              <Input
                ref={inputRef}
                placeholder="What needs to be done?"
                value={newTaskTitle}
                onChange={(e) => {
                  setNewTaskTitle(e.target.value);
                  checkForDuplicates(e.target.value);
                }}
                onKeyPress={(e) => e.key === "Enter" && handleCreateQuickTask()}
                className="font-medium h-9"
                autoFocus
              />

              {duplicateWarning && (
                <div className="flex items-center space-x-2 text-sm text-yellow-700 bg-yellow-50 p-2 rounded">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{duplicateWarning}</span>
                </div>
              )}

              <div className="flex items-center space-x-3">
                <Select
                  value={newTaskPriority}
                  onValueChange={(value) => setNewTaskPriority(value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  type="date"
                  value={format(newTaskDueDate, "yyyy-MM-dd")}
                  onChange={(e) => setNewTaskDueDate(new Date(e.target.value))}
                  className="w-40 h-9"
                />

                <div className="flex space-x-2">
                  <Button size="sm" onClick={handleCreateQuickTask}>
                    <Check className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowNewTaskForm(false);
                      setNewTaskTitle("");
                      setDuplicateWarning("");
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Task List */}
        <div className="space-y-2">
          {/* Open Tasks */}
          {openTasks.map((task) => (
            <QuickTaskItem
              key={task.id}
              task={task}
              onToggleComplete={handleToggleComplete}
              onArchive={handleArchiveTask}
              onConvert={handleConvertToTask}
              getPriorityColor={getPriorityColor}
              getPriorityIcon={getPriorityIcon}
            />
          ))}

          {/* Done Tasks */}
          {doneTasks.length > 0 && (
            <>
              <div className="pt-4 pb-2">
                <h4 className="text-sm font-medium text-gray-500">
                  Completed ({doneTasks.length})
                </h4>
              </div>
              {doneTasks.map((task) => (
                <QuickTaskItem
                  key={task.id}
                  task={task}
                  onToggleComplete={handleToggleComplete}
                  onArchive={handleArchiveTask}
                  onConvert={handleConvertToTask}
                  getPriorityColor={getPriorityColor}
                  getPriorityIcon={getPriorityIcon}
                />
              ))}
            </>
          )}

          {filteredTasks.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">
                {showArchived ? "No archived tasks" : "No quick tasks yet"}
              </p>
              {!showArchived && (
                <p className="text-xs mt-1">
                  Click "Quick Task" to add your first one
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Quick Task Item Component
function QuickTaskItem({
  task,
  onToggleComplete,
  onArchive,
  onConvert,
  getPriorityColor,
  getPriorityIcon,
}) {
  const [showConvertMenu, setShowConvertMenu] = useState(false);

  const isOverdue =
    task.dueDate &&
    isPast(task.dueDate) &&
    !isToday(task.dueDate) &&
    task.status === "open";
  const isDueToday =
    task.dueDate && isToday(task.dueDate) && task.status === "open";

  return (
    <div
      className={cn(
        "flex items-center space-x-3 p-3 border rounded-sm transition-colors",
        task.status === "done"
          ? "bg-gray-50 border-gray-200"
          : "bg-white border-gray-200 hover:border-gray-300",
        isOverdue && "border-red-200 bg-red-50",
      )}
    >
      {/* Checkbox */}
      <Checkbox
        checked={task.status === "done"}
        onCheckedChange={() => onToggleComplete(task.id)}
        disabled={task.conversionFlag?.isConverted}
      />

      {/* Task Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <p
            className={cn(
              "text-sm font-medium truncate",
              task.status === "done"
                ? "line-through text-gray-500"
                : "text-gray-900",
            )}
            title={task.title}
          >
            {task.title}
          </p>

          {/* Priority Badge */}
          <Badge
            variant="outline"
            className={cn("text-xs", getPriorityColor(task.priority))}
          >
            <div className="flex items-center space-x-1">
              {getPriorityIcon(task.priority)}
              <span className="capitalize">{task.priority}</span>
            </div>
          </Badge>
        </div>

        {/* Due Date & Status */}
        <div className="flex items-center space-x-2 mt-1">
          {task.dueDate && (
            <div
              className={cn(
                "flex items-center space-x-1 text-xs",
                isOverdue
                  ? "text-red-600"
                  : isDueToday
                    ? "text-orange-600"
                    : "text-gray-500",
              )}
            >
              <Calendar className="h-3 w-3" />
              <span>{format(task.dueDate, "MMM d")}</span>
              {isOverdue && <span className="font-medium">(Overdue)</span>}
              {isDueToday && <span className="font-medium">(Due Today)</span>}
            </div>
          )}

          {/* Conversion Status */}
          {task.conversionFlag?.isConverted && (
            <Badge
              variant="outline"
              className="text-xs bg-blue-50 text-blue-700 border-blue-200"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Moved to Task → {task.conversionFlag.convertedToTaskId}
            </Badge>
          )}
        </div>
      </div>

      {/* Actions */}
      {task.status !== "archived" && !task.conversionFlag?.isConverted && (
        <div className="flex items-center space-x-1">
          {/* Convert to Task */}
          {task.status === "open" && (
            <div className="relative">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowConvertMenu(!showConvertMenu)}
                className="h-8 w-8 p-0"
              >
                <ArrowUpRight className="h-4 w-4" />
              </Button>

              {showConvertMenu && (
                <div className="absolute right-0 top-8 z-10 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-32">
                  <Button
                    variant="ghost"
                    className="block w-full text-left px-3 py-1 text-sm hover:bg-gray-50 h-auto justify-start rounded-none"
                    onClick={() => {
                      onConvert(task.id, "regular");
                      setShowConvertMenu(false);
                    }}
                  >
                    Regular Task
                  </Button>
                  <Button
                    variant="ghost"
                    className="block w-full text-left px-3 py-1 text-sm hover:bg-gray-50 h-auto justify-start rounded-none"
                    onClick={() => {
                      onConvert(task.id, "recurring");
                      setShowConvertMenu(false);
                    }}
                  >
                    Recurring Task
                  </Button>
                  <Button
                    variant="ghost"
                    className="block w-full text-left px-3 py-1 text-sm hover:bg-gray-50 h-auto justify-start rounded-none"
                    onClick={() => {
                      onConvert(task.id, "milestone");
                      setShowConvertMenu(false);
                    }}
                  >
                    Milestone
                  </Button>
                  <Button
                    variant="ghost"
                    className="block w-full text-left px-3 py-1 text-sm hover:bg-gray-50 h-auto justify-start rounded-none"
                    onClick={() => {
                      onConvert(task.id, "approval");
                      setShowConvertMenu(false);
                    }}
                  >
                    Approval Task
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Archive */}
          {task.status === "done" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onArchive(task.id)}
              className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
            >
              <Archive className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
