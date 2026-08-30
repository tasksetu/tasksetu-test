import React, { useState, useEffect, useRef, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import Select from "react-select";
import CustomEditor from "../../common/CustomEditor";
import {
  Clock,
  Tag,
  AlertCircle,
  Loader2,
  Mail,
  Upload,
  Paperclip,
  X,
  Users,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import EmailTaskConfig from "../../workflow/EmailTaskConfig";
import LinkedTaskSelector from "../../workflow/LinkedTaskSelector";
import AssigneeSearchSelect from "../../common/AssigneeSearchSelect";
import { apiClient } from "../../../utils/apiClient";
import { useOrgUsers, useOrgForms } from "@/hooks/useProcessBuilder";

export default function ProcessEmailStepForm({
  stepToEdit = null,
  onClose,
  onSubmit,
  previousSteps = [],
}) {
  const { data: orgUsers = [] } = useOrgUsers();
  const { data: orgForms = [] } = useOrgForms();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      title: stepToEdit?.name || stepToEdit?.title || "",
      assignedTo: stepToEdit?.assignedUserId
        ? String(stepToEdit.assignedUserId)
        : "",
      dueDays: stepToEdit?.dueDays ?? 3,
      priority: stepToEdit?.priority || "Medium",
      description: stepToEdit?.description || "",
      status: stepToEdit?.status || "Open",
      visibility: "Private",
    },
  });

  const watchedAssignee = watch("assignedTo");

  const currentAssigneeId = useMemo(() => {
    if (!watchedAssignee) return null;
    return typeof watchedAssignee === "object"
      ? String(
          watchedAssignee.value || watchedAssignee.id || watchedAssignee._id,
        )
      : String(watchedAssignee);
  }, [watchedAssignee]);

  const [collaborators, setCollaborators] = useState(
    stepToEdit?.collaborators || [],
  );

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

  const [linkedTaskId, setLinkedTaskId] = useState(
    stepToEdit?.linkedTaskId || null,
  );
  const [autoInitiate, setAutoInitiate] = useState(
    stepToEdit?.configuration?.autoInitiate || false,
  );

  const [attachments, setAttachments] = useState(stepToEdit?.attachments || []);
  const [isDragActive, setIsDragActive] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const fileInputRef = useRef(null);

  const [emailConfig, setEmailConfig] = useState(
    stepToEdit?.emailConfig || {
      recipients: [{ name: "", email: "", source: "manual" }],
      subject: stepToEdit?.emailSubject || "",
      body: stepToEdit?.emailBody || "",
      variables: [],
      attachedFormId: stepToEdit?.formId || "",
      formLinkEnabled: false,
      autoComplete: stepToEdit?.emailAutoComplete || false,
      autoCompleteAfterDays: 1,
    },
  );

  const [configErrors, setConfigErrors] = useState({});

  useEffect(() => {
    if (stepToEdit) {
      if (stepToEdit.emailConfig) {
        setEmailConfig(stepToEdit.emailConfig);
      }
      if (stepToEdit.linkedTaskId) setLinkedTaskId(stepToEdit.linkedTaskId);
      if (stepToEdit.configuration?.autoInitiate)
        setAutoInitiate(stepToEdit.configuration.autoInitiate);
      if (stepToEdit.attachments) setAttachments(stepToEdit.attachments);
    }
  }, [stepToEdit]);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = (newFiles) => {
    setAttachmentError("");
    const currentSize = attachments.reduce((sum, f) => sum + (f.size || 0), 0);
    const incomingSize = newFiles.reduce((sum, f) => sum + (f.size || 0), 0);

    if (currentSize + incomingSize > 5 * 1024 * 1024) {
      setAttachmentError("File too large! Max 5MB total");
      return;
    }

    const formatted = newFiles.map((file) => ({
      id: `file-${Date.now()}-${Math.random()}`,
      name: file.name,
      originalName: file.name,
      size: file.size,
      file,
    }));

    setAttachments((prev) => [...prev, ...formatted]);
  };

  const removeFile = (indexToRemove) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const onFormSubmit = (data) => {
    const errs = {};
    const validRecipients = (emailConfig?.recipients || []).filter(
      (r) => r && r.email && r.email.trim() !== "",
    );
    if (validRecipients.length === 0) {
      errs.recipients = "At least one recipient email address is required.";
    }
    const cleanBody = (emailConfig?.body || "").replace(/<[^>]*>/g, "").trim();
    if (!cleanBody) {
      errs.body = "Email Body / Message is required.";
    }

    if (Object.keys(errs).length > 0) {
      setConfigErrors(errs);
      return;
    }
    setConfigErrors({});

    const sanitizedEmailConfig = {
      ...emailConfig,
      attachedFormId: emailConfig?.attachedFormId || null,
      recipients: (emailConfig?.recipients || []).map((r) => ({
        ...r,
        formId: r.formId || null,
        previousTaskId: r.previousTaskId || null,
        source: r.source || "manual",
      })),
      variables: (emailConfig?.variables || [])
        .filter((v) => v && v.enabled !== false)
        .map((v) => ({
          ...v,
          formId: v.formId || null,
        })),
    };

    const payload = {
      id:
        stepToEdit?.id ||
        `step_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: data.title.trim(),
      title: data.title.trim(),
      taskType: "Email",
      subtaskType: "email",
      mainTaskType: "regular",
      assignedUserId: data.assignedTo?.value || data.assignedTo || "",
      assignedTo: data.assignedTo?.value || data.assignedTo || "",
      dueDays: Number(data.dueDays) || 3,
      priority: data.priority || "Medium",
      status: data.status || "Open",
      visibility: "Private",
      collaborators: collaborators,
      description: (data.description || "").trim(),
      linkedTaskId: linkedTaskId || null,
      linkedToMilestone: linkedTaskId || null,
      configuration: {
        autoInitiate: !!linkedTaskId && autoInitiate,
        autoComplete: Boolean(emailConfig.autoComplete),
        autoCompleteAfterDays: emailConfig.autoCompleteAfterDays || 1,
        parentCancellationMode: "ignore_rejection",
      },
      emailConfig: sanitizedEmailConfig,
      emailSubject: sanitizedEmailConfig.subject,
      emailBody: sanitizedEmailConfig.body,
      emailAutoComplete: sanitizedEmailConfig.autoComplete,
      formId: sanitizedEmailConfig.attachedFormId || null,
      attachments,
    };
    onSubmit(payload);
  };

  return (
    <form
      onSubmit={handleSubmit(onFormSubmit)}
      className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-left"
    >
      {/* Title */}
      <div>
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
          Email Task Title <span className="text-red-500">*</span>
        </label>
        <input
          {...register("title", { required: "Task title is required" })}
          type="text"
          placeholder="Add email task title"
          className="w-full !h-8 px-3 border border-gray-300 rounded-md text-xs focus:outline-none focus:border-2 focus:border-indigo-500"
        />
        {errors.title && (
          <p className="text-red-500 text-xs mt-1 flex items-center">
            <AlertCircle className="w-3 h-3 mr-1" />
            {errors.title.message}
          </p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
          Email Task Description
        </label>
        <div className="border border-gray-300 rounded-md overflow-hidden bg-white focus-within:border-indigo-500">
          <Controller
            name="description"
            control={control}
            defaultValue={stepToEdit?.description || ""}
            render={({ field }) => (
              <CustomEditor
                value={field.value || ""}
                onChange={(content) => field.onChange(content)}
                placeholder="Add email task description..."
                className="w-full"
              />
            )}
          />
        </div>
      </div>
      

      {/* Assignee & Due Days Offset Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Assignee */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
            Assignee (Task Owner) <span className="text-red-500">*</span>
          </label>
          <Controller
            name="assignedTo"
            control={control}
            rules={{ required: "Assignee is required" }}
            render={({ field }) => (
              <AssigneeSearchSelect
                value={field.value}
                onChange={field.onChange}
                options={orgUsers}
                placeholder="Select assignee..."
              />
            )}
          />
          {errors.assignedTo && (
            <p className="text-red-500 text-xs mt-1 flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" />
              {errors.assignedTo.message}
            </p>
          )}
        </div>

        {/* DUE DAYS OFFSET */}
        <div className="flex flex-col">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            DUE DAYS OFFSET <span className="text-red-500">*</span>
          </label>
          <input
            {...register("dueDays", {
              required: "Due days offset is required",
              min: 0,
            })}
            type="number"
            min={0}
            className="w-full !h-8 px-3 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:border-2 focus:border-indigo-500"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            Days offset when process launched.
          </p>
        </div>
      </div>

      {/* Collaborators Row */}
      <div className="flex flex-col">
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1">
          <Users className="w-3.5 h-3.5 text-indigo-600" />
          Collaborators
        </label>
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

      {/* Email Configuration Component */}
      <EmailTaskConfig
        value={emailConfig}
        onChange={(cfg) => {
          setEmailConfig(cfg);
          setConfigErrors({});
        }}
        disabled={false}
        taskId={stepToEdit?.id}
        forms={orgForms}
        errors={configErrors}
      />

      {/* Linked Task Dependency & Auto Initiate */}
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

      {/* Attachments Section */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Attachments
          </label>
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
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center bg-indigo-100 text-indigo-600 rounded-full">
            <Upload className="w-4 h-4" />
          </div>
          <p className="text-xs font-semibold text-indigo-600">
            Drag & Drop files or click to browse
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            PDF, DOC, images supported
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {attachmentError && (
          <p className="text-red-500 text-xs flex items-center gap-1 mt-1">
            <AlertCircle className="w-3 h-3" />
            {attachmentError}
          </p>
        )}

        {attachments.length > 0 && (
          <div className="space-y-1.5 pt-2">
            {attachments.map((file, idx) => (
              <div
                key={file.id || idx}
                className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-md text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <Paperclip className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                  <span className="font-medium text-gray-700 truncate">
                    {file.name || file.originalName || "Attachment"}
                  </span>
                  {file.size && (
                    <span className="text-gray-400 text-[10px]">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                  className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="h-9 text-xs"
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
