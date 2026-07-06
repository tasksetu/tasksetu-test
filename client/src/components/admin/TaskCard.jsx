import { format } from "date-fns";
import { Calendar, User, MoreHorizontal, Edit2, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SafeHtml from "../common/SafeHtml";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// Note: Schema types removed for JavaScript compatibility
import { cn, getStatusColor, getPriorityColor, getInitials } from "@/lib/utils";

export function TaskCard({ task, onEdit, onDelete, className }) {
  const statusColor = getStatusColor(task.status);
  const priorityColor = getPriorityColor(task.priority);

  return (
    <Card className={cn("admin-card", className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-foreground truncate mb-1" title={task.title}>
              {task.title}
            </h4>
            <p className="text-xs text-muted-foreground line-clamp-2">
              <SafeHtml html={task.description} truncate={true} maxLength={100} as="span" />
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(task)}>
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete?.(task)}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <Badge className={cn("text-xs px-2 py-1", statusColor)}>
            {task.status.replace("-", " ")}
          </Badge>
          <Badge className={cn("text-xs px-2 py-1", priorityColor)}>
            {task.priority}
          </Badge>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            {task.assignee && (
              <div className="flex items-center gap-1">
                <Avatar className="w-5 h-5">
                  <AvatarImage src={task.assignee.avatar || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(task.assignee.fullName)}
                  </AvatarFallback>
                </Avatar>
                <span>{task.assignee.fullName}</span>
              </div>
            )}

            {task.dueDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{format(new Date(task.dueDate), "MMM d")}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
