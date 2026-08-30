import React, { useState, useEffect, useRef, useMemo } from "react";
import Select from "react-select";
import {
  Tag,
  User,
  Users,
  AlertCircle,
  Calendar,
  Clock,
  Paperclip,
  Upload,
  Plus,
  Trash2,
  FileText,
  X,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import CustomEditor from "../../common/CustomEditor";
import AssigneeSearchSelect from "../../common/AssigneeSearchSelect";
import LinkedTaskSelector from "../../workflow/LinkedTaskSelector";
import { useOrgUsers, useOrgForms } from "@/hooks/useProcessBuilder";
import { useTaskPriorities } from "@/hooks/useTaskPriorities";

export default function ProcessStandardStepForm({
  stepToEdit = null,
  onClose,
  onSubmit,
  previousSteps = [],
}) {
  const { data: orgUsers = [] } = useOrgUsers();
  const { data: orgForms = [] } = useOrgForms();
  const { data: taskPriorities = [] } = useTaskPriorities();

  const [formData, setFormData] = useState({
    title: "",
    assignee: "",
    dueDays: 3,
    priority: "Medium",
    status: "OPEN",
    visibility: "Private",
    description: "",
    tags: [],
    formId: "none",
  });

  const [collaborators, setCollaborators] = useState(
    stepToEdit?.collaborators || [],
  );

  const currentAssigneeId = useMemo(() => {
    if (!formData.assignee) return null;
    return typeof formData.assignee === "object"
      ? String(
          formData.assignee.value ||
            formData.assignee.id ||
            formData.assignee._id,
        )
      : String(formData.assignee);
  }, [formData.assignee]);

  const collaboratorOptions = useMemo(() => {
    return (orgUsers || [])
      .filter((u) => String(u.id || u._id) !== currentAssigneeId)
      .map((u) => {
        const name =
          u.name ||
          `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
          u.email;
        const role = u.role?.name || u.role || "User";
        return {
          value: u.id || u._id,
          label: `${name} (${u.email}) - ${role}`,
        };
      });
  }, [orgUsers, currentAssigneeId]);

  useEffect(() => {
    if (currentAssigneeId) {
      setCollaborators((prev) =>
        prev.filter((c) => {
          const val = typeof c === "object" ? c.value || c.id || c._id : c;
          return String(val) !== currentAssigneeId;
        }),
      );
    }
  }, [currentAssigneeId]);

  const [tagInput, setTagInput] = useState("");
  const [linkedTaskId, setLinkedTaskId] = useState(
    stepToEdit?.linkedTaskId || null,
  );
  const [autoInitiate, setAutoInitiate] = useState(
    stepToEdit?.configuration?.autoInitiate ||
      stepToEdit?.autoInitiate ||
      false,
  );

  const [uploadedFiles, setUploadedFiles] = useState(
    stepToEdit?.attachments || [],
  );
  const [attachmentSize, setAttachmentSize] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const attachmentsInputRef = useRef(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (stepToEdit) {
      setFormData({
        title: stepToEdit.name || stepToEdit.title || stepToEdit.taskName || "",
        assignee: stepToEdit.assignedUserId
          ? String(stepToEdit.assignedUserId)
          : "",
        dueDays: stepToEdit.dueDays ?? 3,
        priority: stepToEdit.priority || "Medium",
        status: stepToEdit.status || "OPEN",
        visibility: stepToEdit.visibility || "Private",
        description: stepToEdit.description || "",
        tags: Array.isArray(stepToEdit.tags) ? stepToEdit.tags : [],
        formId: stepToEdit.formId || "none",
      });
      setLinkedTaskId(stepToEdit.linkedTaskId || null);
      setAutoInitiate(
        stepToEdit.configuration?.autoInitiate ||
          stepToEdit.autoInitiate ||
          false,
      );
    } else {
      setFormData({
        title: "",
        assignee: "",
        dueDays: 3,
        priority: "Medium",
        status: "OPEN",
        visibility: "Private",
        description: "",
        tags: [],
        formId: "none",
      });
      setLinkedTaskId(null);
      setAutoInitiate(false);
    }
    setTagInput("");
    setErrors({});
  }, [stepToEdit, orgUsers]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim().replace(/^#/, "");
    if (trimmedTag && !formData.tags.includes(trimmedTag)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, trimmedTag],
      }));
      setTagInput("");
    }
  };

  const handleRemoveTag = (indexToRemove) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== indexToRemove),
    }));
  };

  const processAttachmentFiles = (files) => {
    const incomingFiles = Array.from(files || []);
    if (incomingFiles.length === 0) return;

    const currentSize = uploadedFiles.reduce(
      (sum, f) => sum + (f.size || 0),
      0,
    );
    const incomingSize = incomingFiles.reduce(
      (sum, file) => sum + file.size,
      0,
    );

    if (currentSize + incomingSize > 5 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        attachments: "File too large! Max 5MB total",
      }));
      return;
    }

    const newAttachments = incomingFiles.map((file) => ({
      id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: file.name,
      size: file.size,
      file,
    }));

    setUploadedFiles((prev) => [...prev, ...newAttachments]);
    setAttachmentSize(currentSize + incomingSize);
  };

  const handleAttachmentsDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleAttachmentsDragLeave = (e) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleAttachmentsDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    processAttachmentFiles(e.dataTransfer?.files);
  };

  const removeFile = (fileId) => {
    setUploadedFiles((prev) => {
      const file = prev.find((f) => f.id === fileId);
      if (file) {
        setAttachmentSize((s) => Math.max(0, s - (file.size || 0)));
      }
      return prev.filter((f) => f.id !== fileId);
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = "Sub-task title is required";
    }
    if (!formData.assignee) {
      newErrors.assignee = "Assignee is required";
    }
    if (
      formData.dueDays < 0 ||
      formData.dueDays === "" ||
      isNaN(formData.dueDays)
    ) {
      newErrors.dueDays = "Please enter a valid due days offset";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const assigneeId =
      typeof formData.assignee === "object"
        ? formData.assignee?.value || formData.assignee?.id || ""
        : formData.assignee;

    onSubmit({
      id:
        stepToEdit?.id ||
        `step_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      taskType: "Regular",
      subtaskType: "regular",
      mainTaskType: "regular",
      name: formData.title.trim(),
      title: formData.title.trim(),
      assignedUserId: assigneeId,
      assignedTo: assigneeId,
      dueDays: Number(formData.dueDays),
      priority: formData.priority,
      status: formData.status,
      visibility: "Private",
      collaborators: collaborators,
      description: formData.description.trim(),
      tags: formData.tags,
      approvalRequired: false,
      formId: formData.formId === "none" ? null : formData.formId,
      linkedTaskId: linkedTaskId || null,
      linkedToMilestone: linkedTaskId || null,
      attachments: uploadedFiles,
      configuration: {
        autoInitiate: !!linkedTaskId && autoInitiate,
        autoComplete: false,
        autoCompleteAfterDays: null,
        parentCancellationMode: "ignore_rejection",
      },
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-left"
    >
      {/* TASK TITLE */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label
            htmlFor="subtaskTitle"
            className="text-xs font-semibold text-gray-700 uppercase tracking-wider"
          >
            Regular Task Name <span className="text-red-500">*</span>
          </Label>
          <span className="text-xs text-gray-400 font-normal">
            {formData.title.length}/60
          </span>
        </div>
        <Input
          id="subtaskTitle"
          type="text"
          value={formData.title}
          onChange={(e) => handleChange("title", e.target.value)}
          placeholder="Add task title"
          className={`bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 text-xs !h-8 ${
            errors.title ? "border-red-500 focus:border-red-500" : ""
          }`}
          maxLength={60}
          autoFocus
        />
        {errors.title && (
          <p className="text-xs text-red-500 mt-1">{errors.title}</p>
        )}
      </div>
      {/* Description */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
          Regular Task Description
        </Label>
        <div className="border border-gray-300 rounded-md overflow-hidden bg-white focus-within:border-blue-500">
          <CustomEditor
            value={formData.description}
            onChange={(content) => handleChange("description", content)}
            placeholder="Add task description..."
            className="w-full"
          />
        </div>
      </div>
      {/* Row 1: Assignee & Priority */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* Assignee */}
        <div className="flex flex-col">
          <div className="h-5 flex items-center justify-between mb-1.5">
            <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Assigned To <span className="text-red-500">*</span>
            </Label>
          </div>
          <AssigneeSearchSelect
            value={formData.assignee}
            onChange={(value) => handleChange("assignee", value)}
            isOrgUser={true}
            options={orgUsers}
            placeholder="Search and select assignee..."
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Search by name, email, department, or designation
          </p>
          {errors.assignee && (
            <p className="text-xs text-red-500 mt-1">{errors.assignee}</p>
          )}
        </div>

        {/* Priority */}
        <div className="flex flex-col">
          <div className="h-5 flex items-center mb-1.5">
            <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Priority
            </Label>
          </div>
          <select
            value={formData.priority}
            onChange={(e) => handleChange("priority", e.target.value)}
            className="w-full !h-8 px-3 border border-gray-300 rounded-md bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
        </div>
      </div>

      {/* Collaborators Row */}
      <div className="flex flex-col">
        <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1">
          <Users className="w-3.5 h-3.5 text-indigo-600" />
          Collaborators
        </Label>
        <Select
          isMulti
          menuPlacement="auto"
          options={collaboratorOptions}
          value={collaborators}
          onChange={(val) => setCollaborators(val || [])}
          className="react-select-container text-xs"
          classNamePrefix="react-select"
          placeholder="Select collaborators..."
        />
        <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
          <Info className="w-3 h-3 text-indigo-500 shrink-0" />
          Note: The task owner (assignee) is automatically excluded from the
          collaborators list.
        </p>
      </div>

      {/* Row 2: Due Days Offset & Labels/Tags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* Due Days Offset */}
        <div className="flex flex-col">
          <div className="h-5 flex items-center mb-1.5">
            <Label
              htmlFor="dueDays"
              className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1"
            >
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              DUE DAYS OFFSET <span className="text-red-500">*</span>
            </Label>
          </div>
          <Input
            id="dueDays"
            type="number"
            min="0"
            max="365"
            value={formData.dueDays}
            onChange={(e) => handleChange("dueDays", e.target.value)}
            className={`bg-white border-gray-300 text-gray-900 text-xs !h-8 ${
              errors.dueDays ? "border-red-500 focus:border-red-500" : ""
            }`}
          />
          <p className="text-[11px] text-gray-400 mt-1">
            Days offset when process launched.
          </p>
          {errors.dueDays && (
            <p className="text-xs text-red-500 mt-1">{errors.dueDays}</p>
          )}
        </div>

        {/* Labels / Tags */}
        <div className="flex flex-col">
          <div className="h-5 flex items-center gap-1.5 mb-1.5">
            <Label
              htmlFor="tagsInput"
              className="text-xs font-semibold text-gray-700 uppercase tracking-wider"
            >
              Labels / Tags
            </Label>
          </div>
          <div className="space-y-2">
            <div className="relative flex items-center">
              <Input
                id="tagsInput"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Type tag and press Enter or comma..."
                className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 text-xs pr-10 !h-8"
              />
              <Button
                type="button"
                onClick={handleAddTag}
                size="icon"
                className="absolute right-1 h-6 w-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md"
                title="Add tag"
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>

            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 rounded-md border border-gray-200">
                {formData.tags.map((tag, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="bg-indigo-50 border-indigo-200 text-indigo-700 text-xs px-2 py-0.5 flex items-center gap-1 rounded"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(index)}
                      className="hover:text-indigo-900 font-bold ml-1"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Form Attachment Dropdown */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-indigo-600" />
          Form Attachment
        </Label>
        <select
          value={formData.formId}
          onChange={(e) => handleChange("formId", e.target.value)}
          className="w-full !h-8 px-3 border border-gray-300 rounded-md bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="none">— No Attached Form —</option>
          {orgForms.map((f) => (
            <option key={f.id} value={f.id}>
              📋 {f.title} ({f.category || "General"})
            </option>
          ))}
        </select>
        <p className="text-[11px] text-gray-500">
          Attach a custom dynamic form for users to fill out during this step.
        </p>
      </div>

      {/* Attachments Dropzone */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Attachments
          </Label>
          <span className="text-[11px] text-gray-400 font-normal">
            (Max 5MB total)
          </span>
        </div>
        <div
          className={`w-full border-2 border-dashed rounded-md p-3 text-center cursor-pointer transition-all ${
            isDragActive
              ? "border-indigo-500 bg-indigo-50/50"
              : "border-gray-300 bg-gray-50/60 hover:bg-indigo-50/30 hover:border-indigo-300"
          }`}
          onDragOver={handleAttachmentsDragOver}
          onDragLeave={handleAttachmentsDragLeave}
          onDrop={handleAttachmentsDrop}
          onClick={() => attachmentsInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center bg-indigo-100 text-indigo-600 rounded-full">
            <Upload className="w-3.5 h-3.5" />
          </div>
          <p className="text-xs font-semibold text-indigo-700">
            Drag &amp; Drop files or click to browse
          </p>
          <p className="text-[11px] text-gray-500">
            PDF, DOC, images supported
          </p>
        </div>
        <input
          ref={attachmentsInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
          onChange={(e) => {
            processAttachmentFiles(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />

        {uploadedFiles.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between px-3 py-1.5 rounded-md border bg-gray-50/80 border-gray-200 text-xs"
              >
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <Paperclip className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                  <span className="text-gray-800 font-medium truncate">
                    {file.name}
                  </span>
                  {file.size > 0 && (
                    <span className="text-[11px] text-gray-500 ml-1">
                      ({(file.size / 1024).toFixed(2)} KB)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="text-gray-400 hover:text-red-500 text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <div className="text-[11px] text-gray-500 text-right">
              Total size: {(attachmentSize / 1024 / 1024).toFixed(2)} MB / 5MB
            </div>
          </div>
        )}
        {errors.attachments && (
          <p className="text-xs text-red-500 mt-1">{errors.attachments}</p>
        )}
      </div>

      {/* Linked Task Selector */}
      <LinkedTaskSelector
        parentTaskId={stepToEdit?.parentTaskId}
        sequence={1}
        excludeTaskId={stepToEdit?.id}
        linkedTaskId={linkedTaskId}
        onLinkedTaskChange={setLinkedTaskId}
        autoInitiate={autoInitiate}
        onAutoInitiateChange={setAutoInitiate}
        disabled={false}
        previousSteps={previousSteps}
      />

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="border-gray-300 text-gray-600 hover:bg-gray-50 h-9 text-xs"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[140px] h-9 text-xs font-semibold"
        >
          {stepToEdit ? "Save Step" : "Add Step"}
        </Button>
      </div>
    </form>
  );
}
