import { useState, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import {
  X,
  Calendar as CalendarIcon,
  User,
  Tag as TagIcon,
  Upload,
  FileText,
  Image,
  Paperclip,
  AlertCircle,
  Plus,
  Trash2,
} from "lucide-react";

// Form validation schema
const taskSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be under 200 characters"),
  description: z
    .string()
    .max(2000, "Description must be under 2000 characters")
    .optional(),
  priority: z.string().toLowerCase().optional().default("medium"), // ✅ Changed: Accept any string for custom priorities
  statusId: z.string().optional(),
  dueDate: z.date().optional(),
  projectId: z.string().optional(),
  estimatedHours: z.number().min(0).max(1000).optional(),
});

export function TaskForm({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
  users = [],
  projects = [],
  taskStatuses = [],
  isLoading = false,
}) {
  const [assignees, setAssignees] = useState(initialData?.assignedTo || []);
  const [tags, setTags] = useState(initialData?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);

  // Form setup with validation
  const form = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      priority: initialData?.priority || "medium",
      statusId: initialData?.statusId || "",
      dueDate: initialData?.dueDate ? new Date(initialData.dueDate) : null,
      projectId: initialData?.projectId || "",
      estimatedHours: initialData?.estimatedHours || "",
    },
    mode: "onChange",
  });

  const {
    handleSubmit,
    register,
    control,
    formState: { errors, isValid },
  } = form;

  // Priority levels configuration
  const priorityLevels = [
    { value: "low", label: "Low", color: "priority-low", icon: "🟢" },
    { value: "medium", label: "Medium", color: "priority-medium", icon: "🟡" },
    { value: "high", label: "High", color: "priority-high", icon: "🟠" },
    { value: "urgent", label: "Urgent", color: "priority-urgent", icon: "🔴" },
  ];

  // Form handlers
  const handleFormSubmit = (data) => {
    const taskData = {
      ...data,
      assignedTo: assignees,
      tags,
      attachments: files,
      dueDate: data.dueDate?.toISOString(),
      estimatedHours: data.estimatedHours
        ? parseFloat(data.estimatedHours)
        : undefined,
    };

    onSubmit(taskData);
  };

  // Assignee management
  const addAssignee = (userId) => {
    const user = users.find((u) => u._id === userId);
    if (user && !assignees.find((a) => a._id === userId)) {
      setAssignees([...assignees, user]);
    }
  };

  const removeAssignee = (userId) => {
    setAssignees(assignees.filter((a) => a._id !== userId));
  };

  // Tag management
  const addTag = () => {
    const trimmedTag = tagInput.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < 10) {
      setTags([...tags, trimmedTag]);
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  // File handling
  const handleFileSelect = (selectedFiles) => {
    const newFiles = Array.from(selectedFiles).filter((file) => {
      if (file.size > 10 * 1024 * 1024) {
        return false;
      }
      return !files.find((f) => f.name === file.name && f.size === file.size);
    });

    setFiles((prev) => [...prev, ...newFiles].slice(0, 10));
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  // File icon helper
  const getFileIcon = (fileType) => {
    if (fileType.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (fileType.includes("pdf")) return <FileText className="h-4 w-4" />;
    return <Paperclip className="h-4 w-4" />;
  };

  // File size formatter
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white  border-slate-200  shadow-2xl">
        <DialogHeader className="pb-6 border-b border-slate-200 ">
          <DialogTitle className="text-2xl font-bold text-slate-900 ">
            {initialData ? "Edit Task" : "Create New Task"}
          </DialogTitle>
          <DialogDescription className="text-slate-600  font-medium mt-2">
            {initialData
              ? "Update the task details below"
              : "Fill in the details below to create a new task"}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          className="space-y-3 pt-6"
        >
          {/* Title Field */}
          <div className="space-y-3">
            <Label
              htmlFor="title"
              className="text-sm font-semibold text-slate-900 mb-1"
            >
              Task Title{" "}
              <span className="text-red-600 dark:text-red-400">*</span>
            </Label>
            <div className="relative">
              <Input
                id="title"
                {...register("title")}
                placeholder="Enter a descriptive task title..."
                className={`bg-white  border-slate-300  text-slate-900  placeholder:text-slate-500  font-medium h-9 px-4 focus:border-blue-500  focus:ring-2 focus:ring-blue-200  ${errors.title ? "border-red-500 dark:border-red-400" : ""}`}
              />
              {errors.title && (
                <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-red-600 dark:text-red-400" />
              )}
            </div>
            {errors.title && (
              <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2 mt-2">
                <AlertCircle className="h-4 w-4" />
                {errors.title.message}
              </p>
            )}
          </div>

          {/* Description Field */}
          <div className="space-y-3">
            <Label
              htmlFor="description"
              className="text-sm font-semibold text-slate-900 mb-1"
            >
              Description
            </Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Provide detailed information about the task..."
              rows={5}
              className={`bg-white  border-slate-300  text-slate-900  placeholder:text-slate-500  font-medium p-4 resize-none focus:border-blue-500  focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 ${errors.description ? "border-red-500 dark:border-red-400" : ""}`}
            />
            {errors.description && (
              <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2 mt-2">
                <AlertCircle className="h-4 w-4" />
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Priority and Status Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-slate-900 mb-1">
                Priority{" "}
                <span className="text-red-600 dark:text-red-400">*</span>
              </Label>
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger
                      className={`bg-white  border-slate-300  text-slate-900  h-9 px-4 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 ${errors.priority ? "border-red-500 dark:border-red-400" : ""}`}
                    >
                      <SelectValue
                        placeholder="Select priority"
                        className="text-slate-500 "
                      />
                    </SelectTrigger>
                    <SelectContent className="bg-white  border-slate-300  shadow-xl">
                      {priorityLevels.map((priority) => (
                        <SelectItem
                          key={priority.value}
                          value={priority.value}
                          className="text-slate-900  hover:bg-slate-100  py-3 px-4"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{priority.icon}</span>
                            <span className="font-medium">
                              {priority.label}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.priority && (
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2 mt-2">
                  <AlertCircle className="h-4 w-4" />
                  {errors.priority.message}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold text-slate-900 mb-1">
                Status
              </Label>
              <Controller
                name="statusId"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="bg-white  border-slate-300 dark:border-slate-600 text-slate-900  h-9 px-4 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800">
                      <SelectValue
                        placeholder="Select status"
                        className="text-slate-500 dark:text-slate-400"
                      />
                    </SelectTrigger>
                    <SelectContent className="bg-white  border-slate-300 dark:border-slate-600 shadow-xl">
                      {taskStatuses.map((status) => (
                        <SelectItem
                          key={status._id}
                          value={status._id}
                          className="text-slate-900  hover:bg-slate-100 dark:hover:bg-slate-700 py-3 px-4 font-medium"
                        >
                          {status.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Due Date and Project */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                Due Date
              </Label>
              <Controller
                name="dueDate"
                control={control}
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value
                          ? format(field.value, "PPP")
                          : "Pick a due date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-popover border-border">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                        disabled={(date) => date < new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                Project
              </Label>
              <Controller
                name="projectId"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="bg-input border-border text-foreground">
                      <SelectValue placeholder="Select project (optional)" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {projects.map((project) => (
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
                )}
              />
            </div>
          </div>

          {/* Assignees Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">
              Assignees
            </Label>
            <Select onValueChange={addAssignee}>
              <SelectTrigger className="bg-input border-border text-foreground">
                <SelectValue placeholder="Add team members" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {users
                  .filter((user) => !assignees.find((a) => a._id === user._id))
                  .map((user) => (
                    <SelectItem
                      key={user._id}
                      value={user._id}
                      className="text-popover-foreground hover:bg-accent"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                            {user.firstName?.[0]}
                            {user.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        {user.firstName} {user.lastName}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            {assignees.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {assignees.map((user) => (
                  <Badge
                    key={user._id}
                    variant="secondary"
                    className="flex items-center gap-2 py-1 px-3 bg-secondary text-secondary-foreground border-border"
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-xs">
                        {user.firstName?.[0]}
                        {user.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">
                      {user.firstName} {user.lastName}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAssignee(user._id)}
                      className="ml-1 hover:bg-accent rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Tags Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">Tags</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Add tags (press Enter)"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground pr-10"
                />
                <TagIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <Button
                type="button"
                onClick={addTag}
                variant="outline"
                size="sm"
                className="border-border hover:bg-accent"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="flex items-center gap-1 border-border"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:bg-accent rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* File Attachments */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">
              File Attachments
            </Label>

            <div
              className={`border-2 border-dashed rounded-sm p-4 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-muted-foreground"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
                accept="image/*,application/pdf,.doc,.docx,.txt,.xlsx,.csv"
              />

              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-primary hover:text-primary/80 font-medium"
                  >
                    Click to upload
                  </button>
                  <span className="text-muted-foreground">
                    {" "}
                    or drag and drop
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Images, PDFs, Documents (max 10MB each, 10 files total)
                </p>
              </div>
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, index) => (
                  <Card key={index} className="bg-card border-border">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getFileIcon(file.type)}
                          <div>
                            <p
                              className="text-sm font-medium text-card-foreground truncate max-w-xs"
                              title={file.name}
                            >
                              {file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="border-border hover:bg-accent"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-8 mt-8 border-t border-slate-200 dark:border-slate-700">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 px-6 py-3 font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="outline"
              disabled={!isValid || isLoading}
              className="bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-400 disabled:text-slate-200 px-8 py-3 font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {isLoading ? (
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {initialData ? "Updating..." : "Creating..."}
                </div>
              ) : initialData ? (
                "Update Task"
              ) : (
                "Create Task"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
