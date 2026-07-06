import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import SafeHtml from "../common/SafeHtml";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Calendar,
  User,
  Flag,
  Tag as TagIcon,
  Paperclip
} from "lucide-react";
import { format } from "date-fns";

export function TaskCard({
  task,
  onEdit,
  onDelete,
  users = [],
  taskStatuses = [],
  onClick
}) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const getStatusColor = (status) => {
    switch (status?.name?.toLowerCase()) {
      case "completed":
        return "status-completed";
      case "in progress":
        return "status-in-progress";
      case "OPEN":
      case "todo":
      case "not started":
        return "status-todo";
      default:
        return "bg-gray-900/30 text-gray-300 border border-gray-700/50";
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case "urgent":
        return "priority-urgent";
      case "high":
        return "priority-high";
      case "medium":
        return "priority-medium";
      case "low":
        return "priority-low";
      default:
        return "priority-medium";
    }
  };

  const getAssigneeUsers = () => {
    if (!task.assignedTo || !Array.isArray(task.assignedTo)) return [];
    return task.assignedTo.map(assigneeId =>
      users.find(user => user._id === assigneeId)
    ).filter(Boolean);
  };

  const getStatus = () => {
    return taskStatuses.find(status => status._id === task.statusId);
  };

  const handleDelete = () => {
    onDelete(task._id);
    setShowDeleteDialog(false);
  };

  const assigneeUsers = getAssigneeUsers();
  const status = getStatus();

  return (
    <Card
      className="p-4 hover:shadow-xl transition-all duration-200 cursor-pointer group border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md hover:scale-[1.02]"
      onClick={() => onClick?.(task)}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
          {task.title}
        </h3>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-border">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(task);
                }}
                className="text-popover-foreground hover:bg-accent"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Task
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteDialog(true);
                }}
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Status and Priority Badges */}
      <div className="flex gap-2 mb-3">
        {status && (
          <Badge className={`${getStatusColor(status)} px-2 py-1 text-xs font-medium`}>
            {status.name}
          </Badge>
        )}
        <Badge className={`${getPriorityColor(task.priority)} px-2 py-1 text-xs font-medium`}>
          <Flag className="h-3 w-3 mr-1" />
          {task.priority || 'Medium'}
        </Badge>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-slate-700 dark:text-slate-300 text-sm mb-3 line-clamp-3 font-medium">
          <SafeHtml html={task.description} truncate={true} maxLength={150} as="span" />
        </p>
      )}

      {/* Task Details */}
      <div className="space-y-3">
        {/* Assignees */}
        {assigneeUsers.length > 0 && (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            <div className="flex -space-x-2">
              {assigneeUsers.slice(0, 3).map((user, index) => (
                <Avatar key={index} className="h-6 w-6 border-2 border-white dark:border-slate-800">
                  <AvatarFallback className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 font-semibold">
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
              ))}
              {assigneeUsers.length > 3 && (
                <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-800 flex items-center justify-center">
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold">+{assigneeUsers.length - 3}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Due Date */}
        {task.dueDate && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
              Due: {format(new Date(task.dueDate), 'MMM d, yyyy')}
            </span>
          </div>
        )}

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <TagIcon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            {task.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800">
                #{tag}
              </Badge>
            ))}
            {task.tags.length > 3 && (
              <Badge variant="outline" className="text-xs border-border">
                +{task.tags.length - 3} more
              </Badge>
            )}
          </div>
        )}

        {/* Attachments */}
        {task.attachments && task.attachments.length > 0 && (
          <div className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {task.attachments.length} attachment{task.attachments.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-card-foreground">Delete Task</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete "{task.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}