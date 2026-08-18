import React, { useState, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { Calendar, Tag, AlertCircle, Loader2, Mail, Upload, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmailTaskConfig from "../components/workflow/EmailTaskConfig";
import LinkedTaskSelector from "../components/workflow/LinkedTaskSelector";
import AssigneeSearchSelect from "../components/common/AssigneeSearchSelect";
import { apiClient } from "../utils/apiClient";

export default function EmailSubtaskForm({
  user,
  isOrgUser,
  parentTask,
  isSubmitting,
  onCancel,
  onSubmit,
  editData = null,
}) {
  const [orgUsers, setOrgUsers] = useState([]);
  const [formTemplates, setFormTemplates] = useState([]);
  const [linkedTaskId, setLinkedTaskId] = useState(editData?.linkedTaskId || null);
  const [autoInitiate, setAutoInitiate] = useState(editData?.configuration?.autoInitiate || false);

  const [attachments, setAttachments] = useState(editData?.attachments || []);
  const [isDragActive, setIsDragActive] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const fileInputRef = useRef(null);

  const [emailConfig, setEmailConfig] = useState(
    editData?.emailConfig || {
      recipients: [{ name: "", email: "", source: "manual" }],
      subject: "",
      body: "",
      variables: [],
      attachedFormId: "",
      formLinkEnabled: false,
      autoComplete: false,
      autoCompleteAfterDays: 1,
    },
  );

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      title: editData?.title || "",
      assignedTo: editData?.assignedTo || "",
      dueDate: editData?.dueDate
        ? new Date(editData.dueDate).toISOString().slice(0, 16)
        : "",
      priority: editData?.priority || "medium",
      description: editData?.description || "",
    },
  });

  // Sync state when editData changes
  useEffect(() => {
    if (editData) {
      if (editData.emailConfig) {
        setEmailConfig(editData.emailConfig);
      }
      if (editData.linkedTaskId) setLinkedTaskId(editData.linkedTaskId);
      if (editData.configuration?.autoInitiate) setAutoInitiate(editData.configuration.autoInitiate);
      if (editData.attachments) setAttachments(editData.attachments);
    }
  }, [editData]);

  // Fetch users & form templates for dropdowns
  useEffect(() => {
    fetchOrgUsers();
    fetchForms();
  }, []);

  const fetchOrgUsers = async () => {
    try {
      const res = await apiClient.get("/api/users/search-for-assignment");
      if (res.data?.success) setOrgUsers(res.data.users || []);
    } catch (err) {
      console.error("Failed to fetch org users", err);
    }
  };

  const fetchForms = async () => {
    try {
      const res = await apiClient.get("/api/forms?limit=100");
      const list =
        res.data?.data?.forms ||
        res.data?.forms ||
        res.data?.data ||
        (Array.isArray(res.data) ? res.data : []);
      setFormTemplates(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to fetch form templates", err);
      setFormTemplates([]);
    }
  };

  const getTodayDate = () => new Date().toISOString().slice(0, 16);

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

  const [configErrors, setConfigErrors] = useState({});

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
      ...data,
      taskType: "email",
      mainTaskType: "email",
      linkedTaskId,
      configuration: {
        autoInitiate: !!linkedTaskId && autoInitiate,
        autoComplete: emailConfig.autoComplete,
        autoCompleteAfterDays: emailConfig.autoCompleteAfterDays,
      },
      emailConfig: sanitizedEmailConfig,
      attachments,
    };
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4 text-left">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Email Task Title <span className="text-red-500">*</span>
        </label>
        <input
          {...register("title", { required: "Task title is required" })}
          type="text"
          placeholder="e.g. Send Vendor Onboarding Packet"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-2 focus:border-blue-500"
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
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Email Task Description
        </label>
        <textarea
          {...register("description")}
          rows={3}
          placeholder="Internal notes for team members..."
          className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-2 focus:border-blue-500"
        />
      </div>

      {/* Assignee & Due Date Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Assignee */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Assignee (Task Owner)
          </label>
          <Controller
            name="assignedTo"
            control={control}
            render={({ field }) => (
              <AssigneeSearchSelect
                value={field.value}
                onChange={field.onChange}
                options={orgUsers}
                placeholder="Select assignee..."
              />
            )}
          />
        </div>

        {/* Due Date */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Due Date <span className="text-red-500">*</span>
          </label>
          <input
            {...register("dueDate", { required: "Due date is required" })}
            type="datetime-local"
            min={getTodayDate()}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-2 focus:border-blue-500"
          />
          {errors.dueDate && (
            <p className="text-red-500 text-xs mt-1 flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" />
              {errors.dueDate.message}
            </p>
          )}
        </div>
      </div>

      {/* Email Configuration Component */}
      <EmailTaskConfig
        value={emailConfig}
        onChange={(cfg) => {
          setEmailConfig(cfg);
          setConfigErrors({});
        }}
        disabled={isSubmitting}
        taskId={editData?._id}
        forms={formTemplates}
        errors={configErrors}
      />

      {/* Linked Task Dependency & Auto Initiate */}
      <LinkedTaskSelector
        parentTaskId={parentTask?._id || parentTask?.id}
        sequence={(parentTask?.subtaskCount || 0) + 1}
        excludeTaskId={editData?._id}
        linkedTaskId={linkedTaskId}
        onLinkedTaskChange={setLinkedTaskId}
        autoInitiate={autoInitiate}
        onAutoInitiateChange={setAutoInitiate}
        disabled={isSubmitting}
      />

    

      {/* Attachments Section (Matching Standard Subtask Design) */}
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
          className={`w-full border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition-all ${
            isDragActive
              ? "border-blue-500 bg-blue-50/50"
              : "border-gray-300 bg-gray-50/60 hover:bg-blue-50/30 hover:border-blue-300"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center bg-blue-100 text-blue-600 rounded-full">
            <Upload className="w-4 h-4" />
          </div>
          <p className="text-sm font-semibold text-blue-600">
            Drag & Drop files or click to browse
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
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

        {/* File List */}
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
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 hover:bg-blue-700 text-white min-w-[170px]"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving Email Task...
            </span>
          ) : (
            "Create Email Task"
          )}
        </Button>
      </div>
    </form>
  );
}
