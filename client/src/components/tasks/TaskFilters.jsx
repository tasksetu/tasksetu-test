import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, X } from "lucide-react";

export function TaskFilters({
  searchTerm,
  onSearchChange,
  filters,
  onFilterChange,
  users = [],
  projects = [],
  taskStatuses = [],
  onClearFilters
}) {
  const hasActiveFilters = () => {
    return searchTerm ||
      filters.statusId !== "all" ||
      filters.priority !== "all" ||
      filters.assignedToId !== "all" ||
      filters.projectId !== "all";
  };

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-slate-400" />
          <Input
            placeholder="Search tasks by title, description, or tags..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 font-medium shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
          />
        </div>
        {hasActiveFilters() && (
          <Button
            variant="outline"
            onClick={onClearFilters}
            className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium shadow-sm"
          >
            <X className="h-4 w-4 mr-2" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Filter Dropdowns */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Status Filter */}
        <Select
          value={filters.statusId}
          onValueChange={(value) => onFilterChange({ ...filters, statusId: value })}
        >
          <SelectTrigger className="bg-input border-border text-foreground">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all" className="text-popover-foreground">All Status</SelectItem>
            {taskStatuses.map(status => (
              <SelectItem
                key={status._id}
                value={status._id}
                className="text-popover-foreground hover:bg-accent"
              >
                {status.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Priority Filter */}
        <Select
          value={filters.priority}
          onValueChange={(value) => onFilterChange({ ...filters, priority: value })}
        >
          <SelectTrigger className="bg-input border-border text-foreground">
            <SelectValue placeholder="All Priorities" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all" className="text-popover-foreground">All Priorities</SelectItem>
            <SelectItem value="low" className="text-popover-foreground hover:bg-accent">Low</SelectItem>
            <SelectItem value="medium" className="text-popover-foreground hover:bg-accent">Medium</SelectItem>
            <SelectItem value="high" className="text-popover-foreground hover:bg-accent">High</SelectItem>
            <SelectItem value="urgent" className="text-popover-foreground hover:bg-accent">Urgent</SelectItem>
          </SelectContent>
        </Select>

        {/* Assignee Filter */}
        <Select
          value={filters.assignedToId}
          onValueChange={(value) => onFilterChange({ ...filters, assignedToId: value })}
        >
          <SelectTrigger className="bg-input border-border text-foreground">
            <SelectValue placeholder="All Assignees" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all" className="text-popover-foreground">All Assignees</SelectItem>
            {users.map(user => (
              <SelectItem
                key={user._id}
                value={user._id}
                className="text-popover-foreground hover:bg-accent"
              >
                {user.firstName} {user.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Project Filter */}
        <Select
          value={filters.projectId}
          onValueChange={(value) => onFilterChange({ ...filters, projectId: value })}
        >
          <SelectTrigger className="bg-input border-border text-foreground">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all" className="text-popover-foreground">All Projects</SelectItem>
            {projects.map(project => (
              <SelectItem
                key={project._id}
                value={project._id}
                className="text-popover-foreground hover:bg-accent"
              >
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}