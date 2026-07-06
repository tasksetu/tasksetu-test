import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Save,
  Send,
  Loader,
  CheckCircle,
  AlertCircle,
  Star,
  Info,
  Eye,
} from "lucide-react";
import { useShowToast } from "../../utils/ToastMessage";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import SignatureCanvas from "react-signature-canvas";
import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

/**
 * FormSubmissionModal - Modal for filling and submitting forms attached to tasks/subtasks
 *
 * Features:
 * - Load form schema and existing submission
 * - Render all 23 field types
 * - Auto-save drafts
 * - Submit final form
 * - Edit existing submissions
 * - Multi-submission support: Users can submit same form multiple times
 */
export default function FormSubmissionModal({
  open,
  onClose,
  formData,
  taskId,
  subtaskId,
  submissionId, // ✅ NEW: Pass specific submission ID to edit existing submission
  readOnly = false, // ✅ NEW: Read-only preview mode
  onSubmitSuccess,
}) {
  const { showSuccessToast, showErrorToast } = useShowToast();
  const token = localStorage.getItem("token");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formSchema, setFormSchema] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [openMultiSelects, setOpenMultiSelects] = useState({});
  const [restricted, setRestricted] = useState(false);
  const [isArchived, setIsArchived] = useState(false); // ✅ NEW: Track if form is archived
  const [loadedVersionNumber, setLoadedVersionNumber] = useState(null); // ✅ Version from API

  // ✅ FIX: Track loaded state to prevent re-fetching on parent re-renders
  const loadedRef = useRef({ formVersionId: null, submissionId: null });
  const isInitialLoadRef = useRef(true);

  // Authenticated file opener for form submission files
  const openFormFile = (subId, attachmentId, fileName, mimeType) => {
    if (!subId || !attachmentId || !token) return;
    fetch(`/api/forms/submissions/${subId}/files/${attachmentId}/view`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (response.ok) return response.blob();
        throw new Error("Failed to load file");
      })
      .then((blob) => {
        const blobWithType = new Blob([blob], { type: mimeType || blob.type });
        const url = window.URL.createObjectURL(blobWithType);
        window.open(url, "_blank");
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      })
      .catch((error) => {
        console.error("Error opening form file:", error);
        showErrorToast?.("Failed to open file");
      });
  };

  // Load form schema and existing submission
  useEffect(() => {
    if (open && formData) {
      // ✅ FIX: Only reload if formVersionId or submissionId actually changed
      const currentFormVersionId = formData.formVersionId;
      const currentSubmissionId = submissionId || null;

      // Skip reload if same form/submission is already loaded
      if (
        loadedRef.current.formVersionId === currentFormVersionId &&
        loadedRef.current.submissionId === currentSubmissionId &&
        !isInitialLoadRef.current
      ) {
        console.log("📝 Skipping reload - same form/submission already loaded");
        return;
      }

      loadFormData();
      loadedRef.current = {
        formVersionId: currentFormVersionId,
        submissionId: currentSubmissionId,
      };
      isInitialLoadRef.current = false;
    }
  }, [open, formData?.formVersionId, submissionId]); // ✅ Only depend on formVersionId, not entire formData object

  // ✅ FIX: Reset refs when modal closes to allow fresh load on next open
  useEffect(() => {
    if (!open) {
      isInitialLoadRef.current = true;
    }
  }, [open]);

  const loadFormData = async () => {
    try {
      setLoading(true);

      // Fetch form version details
      const versionResponse = await fetch(
        `/api/forms/versions/${formData.formVersionId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (versionResponse.status === 403) {
        // Form is restricted for this user
        setRestricted(true);
        setLoading(false);
        return;
      }

      if (!versionResponse.ok) throw new Error("Failed to load form");

      const versionData = await versionResponse.json();
      const schema =
        versionData.data?.version?.snapshot_data ||
        versionData.data?.snapshot_data;
      const versionObj = versionData.data?.version || versionData.data;

      // ✅ Store version number from API
      setLoadedVersionNumber(versionObj?.version_number || null);

      // ✅ Check if form is archived - archived forms cannot accept new submissions
      if (versionData.data?.form_status === "ARCHIVED") {
        setIsArchived(true);
        setLoading(false);
        return;
      }

      setFormSchema(schema);

      // ✅ MULTI-SUBMISSION SUPPORT: If submissionId provided, load that specific submission
      if (submissionId) {
        console.log("📝 Loading specific submission:", submissionId);
        const submissionResponse = await fetch(
          `/api/forms/submissions/${submissionId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (submissionResponse.ok) {
          const submissionData = await submissionResponse.json();
          setExistingSubmission(submissionData.data);
          setFormValues(submissionData.data?.submission_data_json || {});
        } else {
          throw new Error("Failed to load submission");
        }
      } else {
        // ✅ No submissionId means creating NEW submission - initialize with defaults
        console.log("📝 Creating new submission");
        const defaults = {};
        schema?.fields?.forEach((field) => {
          if (field.default_value !== undefined) {
            defaults[field.field_id] = field.default_value;
          }
        });
        setFormValues(defaults);
        setExistingSubmission(null);
      }
    } catch (error) {
      console.error("Error loading form:", error);
      // Only show toast for non-restriction errors
      if (!restricted) showErrorToast(error.message || "Unable to load form");
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIX: Validate a single field (for real-time validation)
  const validateSingleField = (field, value) => {
    const fieldErrors = [];

    // Skip validation for display-only fields
    if (["title", "label", "qr_code"].includes(field.type)) {
      return fieldErrors;
    }

    // Required field validation - skip for real-time (show on blur or submit)
    // We only validate format/constraints in real-time

    // Skip further validation if field is empty
    if (value === undefined || value === null || value === "")
      return fieldErrors;

    // Email validation
    if (field.type === "email" || field.type === "EMAIL") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        fieldErrors.push("Invalid email format");
      }
    }

    // URL validation
    if (field.type === "url" || field.type === "URL") {
      try {
        new URL(value);
      } catch {
        fieldErrors.push("Invalid URL format");
      }
    }

    // Phone validation
    if (field.type === "phone" || field.type === "PHONE") {
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(value)) {
        fieldErrors.push("Phone number must be 10 digits");
      }
    }

    // Number validations
    if (
      field.type === "number" ||
      field.type === "NUM_INT" ||
      field.type === "NUM_DEC" ||
      field.type === "decimal"
    ) {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        fieldErrors.push("Must be a valid number");
      } else {
        // Check min
        if (
          field.validation?.min != null &&
          !isNaN(field.validation.min) &&
          numValue < field.validation.min
        ) {
          fieldErrors.push(`Minimum value is ${field.validation.min}`);
        }
        // Check max
        if (
          field.validation?.max != null &&
          !isNaN(field.validation.max) &&
          numValue > field.validation.max
        ) {
          fieldErrors.push(`Maximum value is ${field.validation.max}`);
        }
      }
    }

    // Text length validations
    if (
      (field.type === "text" ||
        field.type === "TXT_1" ||
        field.type === "textarea" ||
        field.type === "TXT_M") &&
      typeof value === "string"
    ) {
      if (
        field.validation?.minlength &&
        value.length < field.validation.minlength
      ) {
        fieldErrors.push(
          `Minimum length is ${field.validation.minlength} characters`,
        );
      }
      if (
        field.validation?.maxlength &&
        value.length > field.validation.maxlength
      ) {
        fieldErrors.push(
          `Maximum length is ${field.validation.maxlength} characters`,
        );
      }
    }

    // Pattern validation
    if (field.validation?.pattern && typeof value === "string") {
      try {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(value)) {
          fieldErrors.push(
            field.validation?.patternMessage || "Invalid format",
          );
        }
      } catch (e) {
        console.error("Invalid regex pattern:", field.validation.pattern);
      }
    }

    return fieldErrors;
  };

  const handleFieldChange = (fieldKey, value) => {
    setFormValues((prev) => ({
      ...prev,
      [fieldKey]: value,
    }));

    // ✅ FIX: Real-time validation - validate this field immediately
    const field = formSchema?.fields?.find((f) => f.field_id === fieldKey);
    if (field) {
      const fieldErrors = validateSingleField(field, value);
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        if (fieldErrors.length > 0) {
          newErrors[fieldKey] = fieldErrors;
        } else {
          delete newErrors[fieldKey];
        }
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const errors = {};

    formSchema?.fields?.forEach((field) => {
      const fieldKey = field.field_id;
      const value = formValues[fieldKey];

      // Required field validation
      if (field.isRequired) {
        if (value === undefined || value === null || value === "") {
          errors[fieldKey] = [`${field.label} is required`];
          return;
        }
        // Check for empty arrays (checkboxes, multi-select)
        if (Array.isArray(value) && value.length === 0) {
          errors[fieldKey] = [`${field.label} is required`];
          return;
        }
        // Check for empty objects (location picker)
        if (
          typeof value === "object" &&
          !Array.isArray(value) &&
          Object.keys(value).length === 0
        ) {
          errors[fieldKey] = [`${field.label} is required`];
          return;
        }
      }

      // Skip further validation if field is empty and not required
      if (!value) return;

      const fieldErrors = [];

      // Email validation
      if (field.type === "email" || field.type === "EMAIL") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          fieldErrors.push("Invalid email format");
        }
      }

      // URL validation
      if (field.type === "url" || field.type === "URL") {
        try {
          new URL(value);
        } catch {
          fieldErrors.push("Invalid URL format");
        }
      }

      // Phone validation
      if (field.type === "phone" || field.type === "PHONE") {
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(value)) {
          fieldErrors.push("Phone number must be 10 digits");
        }
      }

      // Number validations
      if (
        field.type === "number" ||
        field.type === "NUM_INT" ||
        field.type === "NUM_DEC" ||
        field.type === "decimal"
      ) {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          fieldErrors.push("Must be a valid number");
        } else {
          // Check min - only if min is a valid number (not null, not undefined)
          if (
            field.validation?.min != null &&
            !isNaN(field.validation.min) &&
            numValue < field.validation.min
          ) {
            fieldErrors.push(`Minimum value is ${field.validation.min}`);
          }
          // Check max - only if max is a valid number (not null, not undefined)
          if (
            field.validation?.max != null &&
            !isNaN(field.validation.max) &&
            numValue > field.validation.max
          ) {
            fieldErrors.push(`Maximum value is ${field.validation.max}`);
          }
        }
      }

      // Text length validations
      if (
        (field.type === "text" ||
          field.type === "TXT_1" ||
          field.type === "textarea" ||
          field.type === "TXT_M") &&
        typeof value === "string"
      ) {
        if (
          field.validation?.minlength &&
          value.length < field.validation.minlength
        ) {
          fieldErrors.push(
            `Minimum length is ${field.validation.minlength} characters`,
          );
        }
        if (
          field.validation?.maxlength &&
          value.length > field.validation.maxlength
        ) {
          fieldErrors.push(
            `Maximum length is ${field.validation.maxlength} characters`,
          );
        }
      }

      // Pattern validation
      if (field.validation?.pattern && typeof value === "string") {
        try {
          const regex = new RegExp(field.validation.pattern);
          if (!regex.test(value)) {
            fieldErrors.push(
              field.validation?.patternMessage || "Invalid format",
            );
          }
        } catch (e) {
          console.error("Invalid regex pattern:", field.validation.pattern);
        }
      }

      if (fieldErrors.length > 0) {
        errors[fieldKey] = fieldErrors;
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveDraft = async () => {
    try {
      setSubmitting(true);

      const payload = {
        form_version_id: formData.formVersionId,
        task_id: taskId,
        subtask_id: subtaskId,
        form_data: formValues,
        status: "IN_PROGRESS",
      };

      let response;
      if (existingSubmission) {
        // Update existing submission
        response = await fetch(
          `/api/forms/submissions/${existingSubmission._id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          },
        );
      } else {
        // Create new submission
        response = await fetch("/api/forms/submissions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save draft");
      }

      const result = await response.json();
      setExistingSubmission(result.data);
      showSuccessToast("Draft saved");
    } catch (error) {
      console.error("Error saving draft:", error);
      showErrorToast(error.message || "Unable to save draft");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      showErrorToast("Fix validation errors before submitting");
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        form_version_id: formData.formVersionId,
        task_id: taskId,
        subtask_id: subtaskId,
        form_data: formValues,
        status: "COMPLETED",
        submitted_at: new Date().toISOString(),
      };

      let response;
      if (existingSubmission) {
        // Update and complete existing submission
        response = await fetch(
          `/api/forms/submissions/${existingSubmission._id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          },
        );
      } else {
        // Create new completed submission
        response = await fetch("/api/forms/submissions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to submit form");
      }

      const result = await response.json();
      showSuccessToast("Form submitted");

      if (onSubmitSuccess) {
        onSubmitSuccess(result.data);
      }

      onClose(true);
    } catch (error) {
      console.error("Error submitting form:", error);
      showErrorToast(error.message || "Unable to submit form");
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field) => {
    // Use field_id as the unique key (field_code doesn't exist in API response)
    const fieldKey = field.field_id;

    if (!fieldKey) {
      console.error("[Field Render Error] Field missing field_id:", field);
      return (
        <div className="text-red-500 text-sm">
          Error: Field missing field_id
        </div>
      );
    }

    // Get value for THIS specific field only
    const value = formValues[fieldKey];
    const fieldErrors = validationErrors[fieldKey] || [];
    const hasError = fieldErrors.length > 0;

    // Render field label with tooltip
    const renderLabel = () => {
      if (
        field.type === "TITLE" ||
        field.type === "title" ||
        field.type === "LABEL" ||
        field.type === "label"
      ) {
        return null;
      }

      return (
        <Label className="flex items-center gap-2 mb-2">
          {field.label}
          {field.isRequired && <span className="text-red-500">*</span>}
          {field.tooltip && (
            <div className="group relative">
              <Info className="h-4 w-4 text-slate-400 cursor-help" />
              <div className="hidden group-hover:block absolute z-10 w-64 p-2 bg-slate-900 text-white text-xs rounded-sm shadow-lg -top-2 left-6">
                {field.tooltip}
              </div>
            </div>
          )}
        </Label>
      );
    };

    // Render help text and validation errors
    const renderHelpText = () => {
      if (!field.help_text && !field.description && fieldErrors.length === 0)
        return null;

      return (
        <div className="mt-1 space-y-1">
          {(field.help_text || field.description) && (
            <p className="text-xs text-slate-500">
              {field.help_text || field.description}
            </p>
          )}
          {fieldErrors.length > 0 &&
            fieldErrors.map((error, idx) => (
              <p
                key={idx}
                className="text-xs text-red-500 flex items-center gap-1"
              >
                <AlertCircle className="w-3 h-3" />
                {error}
              </p>
            ))}
        </div>
      );
    };

    switch (field.type) {
      // TXT_1 - Single-line Text
      case "TXT_1":
      case "text":
        return (
          <div>
            {renderLabel()}
            <Input
              type="text"
              placeholder={field.placeholder || ""}
              value={value || ""}
              onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
              required={field.isRequired}
              readOnly={field.read_only}
              disabled={field.read_only || readOnly}
              maxLength={field.validation?.maxlength}
              className={hasError ? "border-red-500" : ""}
            />
            {renderHelpText()}
          </div>
        );

      // EMAIL - Email field
      case "EMAIL":
      case "email":
        return (
          <div>
            {renderLabel()}
            <Input
              type="email"
              placeholder={field.placeholder || "email@example.com"}
              value={value || ""}
              onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
              required={field.isRequired}
              readOnly={field.read_only}
              disabled={field.read_only || readOnly}
              className={hasError ? "border-red-500" : ""}
            />
            {renderHelpText()}
          </div>
        );

      // URL - URL field
      case "URL":
      case "url":
        return (
          <div>
            {renderLabel()}
            <Input
              type="url"
              placeholder={field.placeholder || "https://example.com"}
              value={value || ""}
              onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
              required={field.isRequired}
              readOnly={field.read_only}
              disabled={field.read_only || readOnly}
              className={hasError ? "border-red-500" : ""}
            />
            {renderHelpText()}
          </div>
        );

      // TXT_M - Multi-line Text
      case "TXT_M":
      case "textarea":
        return (
          <div>
            {renderLabel()}
            <Textarea
              placeholder={field.placeholder || ""}
              value={value || ""}
              onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
              required={field.isRequired}
              readOnly={field.read_only}
              disabled={field.read_only || readOnly}
              rows={field.meta?.rows || 4}
              maxLength={field.validation?.maxlength}
              className={hasError ? "border-red-500" : ""}
            />
            {field.meta?.show_character_count &&
              field.validation?.maxlength && (
                <div className="text-xs text-slate-500 text-right mt-1">
                  {(value || "").length} / {field.validation.maxlength}
                </div>
              )}
            {renderHelpText()}
          </div>
        );

      // RICH - Rich Text / HTML
      case "RICH":
      case "rich_text":
        return (
          <div>
            {renderLabel()}
            <ReactQuill
              theme="snow"
              value={value || field.default_value || ""}
              onChange={(content) => handleFieldChange(fieldKey, content)}
              readOnly={field.read_only}
              placeholder={field.placeholder || "Enter formatted text..."}
              modules={{
                toolbar:
                  field.meta?.allow_formatting !== false
                    ? [
                        ["bold", "italic", "underline"],
                        ["link"],
                        [{ list: "ordered" }, { list: "bullet" }],
                        ["clean"],
                      ]
                    : false,
              }}
              className={hasError ? "border-red-500 rounded-sm" : ""}
            />
            {renderHelpText()}
          </div>
        );

      // NUM_INT - Integer
      case "NUM_INT":
      case "number":
        return (
          <div>
            {renderLabel()}
            <Input
              type="number"
              placeholder={field.placeholder || ""}
              value={value !== undefined && value !== null ? value : ""}
              onChange={(e) =>
                handleFieldChange(
                  fieldKey,
                  e.target.value === "" ? "" : parseInt(e.target.value) || 0,
                )
              }
              required={field.isRequired}
              readOnly={field.read_only}
              disabled={field.read_only || readOnly}
              min={field.validation?.min}
              max={field.validation?.max}
              step={field.validation?.step || 1}
              className={hasError ? "border-red-500" : ""}
            />
            {renderHelpText()}
          </div>
        );

      // NUM_DEC - Decimal
      case "NUM_DEC":
      case "decimal":
        return (
          <div>
            {renderLabel()}
            <Input
              type="number"
              placeholder={field.placeholder || ""}
              value={value !== undefined && value !== null ? value : ""}
              onChange={(e) =>
                handleFieldChange(
                  fieldKey,
                  e.target.value === "" ? "" : parseFloat(e.target.value) || 0,
                )
              }
              required={field.isRequired}
              readOnly={field.read_only}
              disabled={field.read_only || readOnly}
              min={field.validation?.min}
              max={field.validation?.max}
              step={field.validation?.step || 0.01}
              className={hasError ? "border-red-500" : ""}
            />
            {renderHelpText()}
          </div>
        );

      // DROPS - Dropdown (single)
      case "DROPS":
      case "dropdown":
        return (
          <div>
            {renderLabel()}
            <Select
              value={value || ""}
              onValueChange={(val) => handleFieldChange(fieldKey, val)}
              disabled={field.read_only || readOnly}
            >
              <SelectTrigger className={hasError ? "border-red-500" : ""}>
                <SelectValue
                  placeholder={field.placeholder || "-- Select --"}
                />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option, idx) => (
                  <SelectItem key={idx} value={option.value || option}>
                    {option.label || option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {renderHelpText()}
          </div>
        );

      // DROPM - Dropdown (multi) / Multiselect
      case "DROPM":
      case "multiselect":
        const selectedValues = value || [];
        const isOpen = openMultiSelects[fieldKey] || false;

        return (
          <div>
            {renderLabel()}
            <div className="relative group">
              <div
                onClick={() =>
                  !field.read_only &&
                  setOpenMultiSelects((prev) => ({
                    ...prev,
                    [fieldKey]: !prev[fieldKey],
                  }))
                }
                className={`border rounded-md p-2 min-h-[40px] bg-white cursor-pointer ${hasError ? "border-red-500" : "border-slate-300"} ${field.read_only ? "bg-slate-50 cursor-not-allowed" : "hover:border-slate-400"}`}
              >
                <div className="flex flex-wrap gap-1">
                  {selectedValues.length > 0 ? (
                    selectedValues.map((val, idx) => {
                      const option = field.options?.find(
                        (opt) => (opt.value || opt) === val,
                      );
                      const label = option?.label || option || val;
                      return (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                        >
                          {label}
                          {!field.read_only && (
                            <Button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFieldChange(
                                  fieldKey,
                                  selectedValues.filter((v) => v !== val),
                                );
                              }}
                              variant="ghost"
                              size="icon"
                              className="hover:text-blue-900 h-4 w-4 p-0"
                            >
                              ×
                            </Button>
                          )}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-slate-400 text-sm">
                      {field.placeholder || "-- Select multiple --"}
                    </span>
                  )}
                </div>
              </div>
              {!field.read_only && isOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() =>
                      setOpenMultiSelects((prev) => ({
                        ...prev,
                        [fieldKey]: false,
                      }))
                    }
                  ></div>
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    {field.options?.map((option, idx) => {
                      const optionValue = option.value || option;
                      const optionLabel = option.label || option;
                      const isSelected = selectedValues.includes(optionValue);

                      return (
                        <div
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            const newValue = isSelected
                              ? selectedValues.filter((v) => v !== optionValue)
                              : [...selectedValues, optionValue];
                            handleFieldChange(fieldKey, newValue);
                          }}
                          className={`px-3 py-2 cursor-pointer hover:bg-slate-100 flex items-center gap-2 ${
                            isSelected ? "bg-blue-50" : ""
                          }`}
                        >
                          <Checkbox checked={isSelected} />
                          <span className="text-sm">{optionLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            {renderHelpText()}
          </div>
        );

      // RADIO - Radio buttons
      case "RADIO":
      case "radio":
        return (
          <div>
            {renderLabel()}
            <RadioGroup
              value={value || ""}
              onValueChange={(val) => handleFieldChange(fieldKey, val)}
              disabled={field.read_only || readOnly}
            >
              {field.options?.map((option, idx) => {
                const optionValue = option.value || option;
                const optionLabel = option.label || option;
                return (
                  <div key={idx} className="flex items-center space-x-2">
                    <RadioGroupItem
                      value={optionValue}
                      id={`${fieldKey}_${idx}`}
                    />
                    <Label
                      htmlFor={`${fieldKey}_${idx}`}
                      className="text-sm cursor-pointer font-normal"
                    >
                      {optionLabel}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
            {renderHelpText()}
          </div>
        );

      // CHECK - Checkboxes
      case "CHECK":
      case "checkbox":
        return (
          <div>
            {renderLabel()}
            <div className="space-y-2">
              {field.options?.map((option, idx) => {
                const optionValue = option.value || option;
                const optionLabel = option.label || option;
                const selectedValues = value || [];
                const isChecked = selectedValues.includes(optionValue);

                return (
                  <div key={idx} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${fieldKey}_${idx}`}
                      checked={isChecked}
                      disabled={field.read_only || readOnly}
                      onCheckedChange={(checked) => {
                        const currentValue = value || [];
                        const newValue = checked
                          ? [...currentValue, optionValue]
                          : currentValue.filter((v) => v !== optionValue);
                        handleFieldChange(fieldKey, newValue);
                      }}
                    />
                    <Label
                      htmlFor={`${fieldKey}_${idx}`}
                      className="text-sm cursor-pointer font-normal"
                    >
                      {optionLabel}
                    </Label>
                  </div>
                );
              })}
            </div>
            {renderHelpText()}
          </div>
        );

      // DATE - Date
      case "DATE":
      case "date":
        // ✅ Format date value to YYYY-MM-DD for HTML date input
        const formattedDate = value
          ? new Date(value).toISOString().split("T")[0]
          : "";
        return (
          <div>
            {renderLabel()}
            <Input
              type="date"
              value={formattedDate}
              onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
              required={field.isRequired}
              readOnly={field.read_only}
              disabled={field.read_only || readOnly}
              min={field.validation?.min}
              max={field.validation?.max}
              className={hasError ? "border-red-500" : ""}
            />
            {renderHelpText()}
          </div>
        );

      // DATETIME - DateTime
      case "DATETIME":
      case "datetime":
        // ✅ Format datetime value to YYYY-MM-DDTHH:mm for HTML datetime-local input
        const formattedDateTime = value
          ? new Date(value).toISOString().slice(0, 16)
          : "";
        return (
          <div>
            {renderLabel()}
            <Input
              type="datetime-local"
              value={formattedDateTime}
              onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
              required={field.isRequired}
              readOnly={field.read_only}
              disabled={field.read_only || readOnly}
              className={hasError ? "border-red-500" : ""}
            />
            {renderHelpText()}
          </div>
        );

      // PHONE - Phone number
      case "PHONE":
      case "phone":
        return (
          <div>
            {renderLabel()}
            <div className="flex gap-2">
              <Input
                type="text"
                className="w-24 bg-slate-50"
                value={field.meta?.country_code || "+91"}
                readOnly
              />
              <Input
                type="tel"
                className={`flex-1 ${hasError ? "border-red-500" : ""}`}
                placeholder={field.placeholder || "9876543210"}
                value={value || ""}
                onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                required={field.isRequired}
                readOnly={field.read_only}
                disabled={field.read_only || readOnly}
                pattern={field.validation?.pattern}
              />
            </div>
            {renderHelpText()}
          </div>
        );

      // TOGGLE - Toggle
      case "TOGGLE":
      case "toggle":
        return (
          <div>
            {renderLabel()}
            <div className="flex items-center space-x-2">
              <Switch
                checked={value === true || value === "true"}
                onCheckedChange={(checked) =>
                  handleFieldChange(fieldKey, checked)
                }
                disabled={field.read_only || readOnly}
              />
              <Label className="text-sm text-slate-600 font-normal">
                {value ? "Yes" : "No"}
              </Label>
            </div>
            {renderHelpText()}
          </div>
        );

      // RATING - Rating
      case "RATING":
      case "rating":
        const maxRating = field.meta?.rating_scale || 5;
        return (
          <div>
            {renderLabel()}
            <div className="flex gap-1 items-center">
              {[...Array(maxRating)].map((_, idx) => {
                const ratingValue = idx + 1;
                return (
                  <Button
                    key={idx}
                    type="button"
                    onClick={() =>
                      !field.read_only &&
                      handleFieldChange(fieldKey, ratingValue)
                    }
                    disabled={field.read_only || readOnly}
                    variant="ghost"
                    size="icon"
                    className={`p-1 ${
                      ratingValue <= (value || 0)
                        ? "text-yellow-400"
                        : "text-slate-300"
                    } ${field.read_only ? "cursor-not-allowed" : "cursor-pointer hover:text-yellow-300"}`}
                  >
                    <Star className="h-6 w-6 fill-current" />
                  </Button>
                );
              })}
              {value > 0 && (
                <span className="ml-2 text-sm text-slate-600">
                  {value} / {maxRating}
                </span>
              )}
            </div>
            {renderHelpText()}
          </div>
        );

      // FILE - File Upload
      case "FILE":
      case "file":
      case "file_upload":
        // ✅ FIX: Show existing file info for prefill
        const existingFiles = value;
        const hasExistingFiles =
          existingFiles &&
          ((Array.isArray(existingFiles) && existingFiles.length > 0) ||
            (typeof existingFiles === "string" && existingFiles.length > 0) ||
            (typeof existingFiles === "object" && existingFiles.name));

        // Helper to find matching attachment for authenticated file access
        const findMatchingAttachment = (file) => {
          if (!existingSubmission?.attachments?.length) return null;
          const fCode = field.field_code || field.field_id;
          const fName =
            typeof file === "string"
              ? file.split("/").pop()
              : file?.filename || file?.name;
          const fPath =
            typeof file === "string"
              ? file
              : file?.file_path || file?.url || file?.path;
          return (
            existingSubmission.attachments.find(
              (a) =>
                a.field_id === fCode &&
                (a.filename === fName || a.file_path === fPath),
            ) ||
            existingSubmission.attachments.find((a) => a.field_id === fCode)
          );
        };

        return (
          <div>
            {renderLabel()}
            {/* ✅ Show existing files if any */}
            {hasExistingFiles && (
              <div className="mb-2 p-2 bg-slate-50 border border-slate-200 rounded-md">
                <p className="text-xs text-slate-600 mb-1">
                  Currently attached:
                </p>
                <div className="flex flex-wrap gap-2">
                  {Array.isArray(existingFiles) ? (
                    existingFiles.map((file, idx) => {
                      const fileName =
                        typeof file === "string"
                          ? file.includes("/")
                            ? file.split("/").pop()
                            : file.substring(0, 30) + "..."
                          : file?.name || file?.filename || `File ${idx + 1}`;
                      const matchAtt = findMatchingAttachment(file);
                      return (
                        <div
                          key={idx}
                          className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                        >
                          {matchAtt?._id ? (
                            <button
                              type="button"
                              onClick={() =>
                                openFormFile(
                                  existingSubmission._id,
                                  matchAtt._id,
                                  fileName,
                                  matchAtt.mime_type,
                                )
                              }
                              className="hover:underline cursor-pointer"
                            >
                              📎 {fileName}
                            </button>
                          ) : (
                            <span>📎 {fileName}</span>
                          )}
                          {!field.read_only && (
                            <Button
                              type="button"
                              onClick={() => {
                                const newFiles = existingFiles.filter(
                                  (_, i) => i !== idx,
                                );
                                handleFieldChange(
                                  fieldKey,
                                  newFiles.length > 0 ? newFiles : null,
                                );
                              }}
                              variant="ghost"
                              size="icon"
                              className="hover:text-red-600 ml-1 h-4 w-4 p-0"
                            >
                              ×
                            </Button>
                          )}
                        </div>
                      );
                    })
                  ) : typeof existingFiles === "string" ? (
                    <div className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                      {(() => {
                        const matchAtt = findMatchingAttachment(existingFiles);
                        const displayName = existingFiles.includes("/")
                          ? existingFiles.split("/").pop()
                          : "View file";
                        return matchAtt?._id ? (
                          <button
                            type="button"
                            onClick={() =>
                              openFormFile(
                                existingSubmission._id,
                                matchAtt._id,
                                displayName,
                                matchAtt.mime_type,
                              )
                            }
                            className="hover:underline cursor-pointer"
                          >
                            📎 {displayName}
                          </button>
                        ) : existingFiles.startsWith("data:") ? (
                          <span>📎 Uploaded file</span>
                        ) : (
                          <span>📎 {displayName}</span>
                        );
                      })()}
                      {!field.read_only && (
                        <Button
                          type="button"
                          onClick={() => handleFieldChange(fieldKey, null)}
                          variant="ghost"
                          size="icon"
                          className="hover:text-red-600 ml-1 h-4 w-4 p-0"
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  ) : existingFiles?.name ? (
                    <div className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                      {(() => {
                        const matchAtt = findMatchingAttachment(existingFiles);
                        return matchAtt?._id ? (
                          <button
                            type="button"
                            onClick={() =>
                              openFormFile(
                                existingSubmission._id,
                                matchAtt._id,
                                existingFiles.name,
                                matchAtt.mime_type,
                              )
                            }
                            className="hover:underline cursor-pointer"
                          >
                            📎 {existingFiles.name}
                          </button>
                        ) : (
                          <span>📎 {existingFiles.name}</span>
                        );
                      })()}
                      {!field.read_only && (
                        <Button
                          type="button"
                          onClick={() => handleFieldChange(fieldKey, null)}
                          variant="ghost"
                          size="icon"
                          className="hover:text-red-600 ml-1 h-4 w-4 p-0"
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
            <Input
              type="file"
              onChange={async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) {
                  handleFieldChange(fieldKey, null);
                  return;
                }

                // ✅ FIX: Convert files to base64 for JSON submission (matching FieldRenderer.jsx)
                const filePromises = Array.from(files).map((file) => {
                  return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                      resolve({
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        data: reader.result, // base64 string
                      });
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                  });
                });

                try {
                  const fileData = await Promise.all(filePromises);
                  // If multiple files allowed, send array; otherwise send single object
                  handleFieldChange(
                    fieldKey,
                    field.meta?.maxFiles > 1 || field.meta?.multiple
                      ? fileData
                      : fileData[0],
                  );
                } catch (err) {
                  console.error("Error reading files:", err);
                  showErrorToast("Error reading file(s)");
                }
              }}
              required={field.isRequired && !hasExistingFiles}
              disabled={field.read_only || readOnly}
              accept={
                field.meta?.allowed_mime_types?.join(",") ||
                field.meta?.fileTypes?.join(",") ||
                field.validation?.allowed_types?.join(",") ||
                "*"
              }
              multiple={field.meta?.maxFiles > 1 || field.meta?.multiple}
              className={hasError ? "border-red-500" : ""}
            />
            {/* ✅ Show selected file info */}
            {value && typeof value === "object" && value.name && (
              <div className="mt-2 text-sm text-green-600">
                File selected: {value.name} ({(value.size / 1024).toFixed(1)}{" "}
                KB)
              </div>
            )}
            {value &&
              Array.isArray(value) &&
              value.length > 0 &&
              value[0]?.name && (
                <div className="mt-2 text-sm text-green-600">
                  {value.length} file(s) selected:{" "}
                  {value.map((f) => f.name).join(", ")}
                </div>
              )}
            {hasExistingFiles && !field.read_only && (
              <p className="text-xs text-slate-500 mt-1">
                Select new file(s) to replace existing
              </p>
            )}
            {(field.meta?.maxSizeMB || field.validation?.max_size) && (
              <p className="text-xs text-slate-500 mt-1">
                Max file size:{" "}
                {field.meta?.maxSizeMB ||
                  (field.validation.max_size / 1024 / 1024).toFixed(1)}{" "}
                MB
              </p>
            )}
            {renderHelpText()}
          </div>
        );

      // SIGN - Signature
      case "SIGN":
      case "signature": // API uses 'signature'
        return (
          <div>
            {renderLabel()}
            <SignatureField
              value={value}
              onChange={(signatureData) =>
                handleFieldChange(fieldKey, signatureData)
              }
              disabled={field.read_only || readOnly}
              hasError={hasError}
            />
            {renderHelpText()}
          </div>
        );

      // LOC - Location Picker
      case "LOC":
      case "location":
      case "location_picker": // API uses 'location_picker'
        return (
          <div>
            {renderLabel()}
            <LocationPickerField
              field={field}
              value={value}
              onChange={(location) => handleFieldChange(fieldKey, location)}
              disabled={field.read_only || readOnly}
            />
            {renderHelpText()}
          </div>
        );

      // LOOKUP - Lookup / Reference
      case "LOOKUP":
      case "lookup":
        return (
          <div>
            {renderLabel()}
            <Input
              type="text"
              placeholder={field.placeholder || "Search..."}
              value={value || ""}
              onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
              required={field.isRequired}
              readOnly={field.read_only}
              disabled={field.read_only || readOnly}
              list={`${fieldKey}-options`}
              className={hasError ? "border-red-500" : ""}
            />
            {renderHelpText()}
          </div>
        );

      // TITLE - Section Title / Instruction
      case "TITLE":
      case "title":
        return (
          <div className="text-xl font-bold text-slate-900 mb-2">
            {field.label}
          </div>
        );

      // LABEL - Read-only Label
      case "LABEL":
      case "label":
        return (
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {field.label}
            {field.description && (
              <p className="text-xs text-slate-500 mt-1">{field.description}</p>
            )}
          </div>
        );

      // QR - QR / Barcode (future)
      case "qr_code":
        return (
          <div>
            {renderLabel()}
            <div className="border border-slate-300 rounded-sm p-4 bg-slate-50 text-center">
              <p className="text-sm text-slate-600">
                QR Code: {value || "Not scanned"}
              </p>
            </div>
            {renderHelpText()}
          </div>
        );

      default:
        return (
          <div>
            {renderLabel()}
            <Input
              type="text"
              placeholder={`${field.type} field`}
              value={value || ""}
              onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
              required={field.isRequired}
              readOnly={field.read_only}
              disabled={field.read_only || readOnly}
              className={hasError ? "border-red-500" : ""}
            />
            {renderHelpText()}
          </div>
        );
    }
  };

  // Determine layout from formSchema settings
  const formLayout = formSchema?.settings?.layout || "1-column";
  const gridColumns =
    formLayout === "2-columns" || formLayout === "2-column"
      ? 2
      : formLayout === "3-columns" || formLayout === "3-column"
        ? 3
        : 1;

  // Dynamic modal width based on layout
  const modalMaxWidth =
    gridColumns === 3
      ? "max-w-6xl"
      : gridColumns === 2
        ? "max-w-5xl"
        : "max-w-3xl";

  console.log("📋 FormSubmissionModal layout:", {
    formLayout,
    gridColumns,
    settings: formSchema?.settings,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div
        className={`bg-white rounded-sm shadow-xl ${modalMaxWidth} w-full max-h-[90vh] overflow-hidden flex flex-col`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {readOnly
                ? "View Submission"
                : formData?.formTitle || formSchema?.title || "Form Submission"}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {(formData?.formTitle || formSchema?.title) && (
                <>
                  {readOnly ? formData?.formTitle || formSchema?.title : ""}
                  {readOnly ? " • " : ""}
                </>
              )}
              Version {formData?.versionNumber || loadedVersionNumber || "—"} •
              Status:{" "}
              {existingSubmission?.status === "COMPLETED"
                ? "Completed"
                : existingSubmission?.status === "IN_PROGRESS"
                  ? "In Progress"
                  : formData?.submissionStatus === "COMPLETED"
                    ? "Completed"
                    : formData?.submissionStatus === "IN_PROGRESS"
                      ? "In Progress"
                      : submissionId
                        ? "In Progress"
                        : "Not Started"}
            </p>
          </div>
          <Button
            onClick={() => onClose(false)}
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">Loading form...</span>
            </div>
          ) : isArchived ? (
            /* ✅ Archived form - cannot submit */
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-16 h-16 text-gray-400 mb-3" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Form Archived
              </h3>
              <p className="text-gray-500 max-w-md">
                This form has been archived and is no longer accepting
                submissions. Please contact your administrator if you need to
                submit this form.
              </p>
            </div>
          ) : formSchema ? (
            <div className="space-y-3">
              {/* Form Title & Description */}
              <div className="mb-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {formSchema.title}
                </h1>
                {formSchema.description && (
                  <p className="text-gray-600 mt-2">{formSchema.description}</p>
                )}
              </div>

              {/* Form Fields with Layout */}
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
                }}
              >
                {formSchema.fields?.map((field, index) => (
                  <div
                    key={field.field_id || index}
                    className={field.css_class || ""}
                    style={{
                      gridColumn:
                        field.type === "title" ||
                        field.type === "TITLE" ||
                        field.type === "label" ||
                        field.type === "LABEL" ||
                        field.type === "RICH"
                          ? "1 / -1"
                          : `span ${field.column_span || 1}`,
                    }}
                  >
                    {renderField(field)}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-gray-600">Failed to load form schema</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {readOnly ? (
              <span className="flex items-center gap-1 text-blue-600">
                <Eye className="w-4 h-4" />
                Read-only preview
              </span>
            ) : isArchived ? (
              <span className="flex items-center gap-1 text-gray-500">
                <AlertCircle className="w-4 h-4" />
                Form is archived
              </span>
            ) : existingSubmission ? (
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Draft saved
              </span>
            ) : (
              <span>Fill out all required fields</span>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => onClose(false)}
              variant="outline"
              disabled={submitting}
            >
              {readOnly ? "Close" : "Cancel"}
            </Button>
            {!readOnly && (
              <>
                {/* <Button
              onClick={handleSaveDraft}
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-50"
              disabled={submitting || !formSchema || isArchived}
            >
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </Button> */}
                <Button
                  onClick={handleSubmit}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  disabled={submitting || !formSchema || isArchived}
                >
                  {submitting ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Submit Form
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Signature Field Component
function SignatureField({ value, onChange, disabled }) {
  const signatureCanvasRef = useRef(null);

  // Load existing signature when value changes
  useEffect(() => {
    if (value && signatureCanvasRef.current) {
      // Load the signature data into canvas
      signatureCanvasRef.current.fromDataURL(value);
    }
  }, [value]);

  return (
    <div className="border border-slate-300 rounded-sm p-4">
      <SignatureCanvas
        penColor="black"
        canvasProps={{
          width: 500,
          height: 200,
          className: "border border-slate-300 rounded-md w-full",
        }}
        onEnd={() => {
          if (signatureCanvasRef.current) {
            const signatureData = signatureCanvasRef.current.toDataURL();
            onChange(signatureData);
          }
        }}
        ref={signatureCanvasRef}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => signatureCanvasRef.current?.clear()}
        className="mt-2"
        type="button"
        disabled={disabled}
      >
        Clear Signature
      </Button>
    </div>
  );
}

// Location Picker Component
function LocationPickerField({ field, value, onChange, disabled }) {
  const [userLocation, setUserLocation] = useState({
    lat: 28.6139, // Default to Delhi, India
    lng: 77.209,
  });

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  // Get current location on mount
  useEffect(() => {
    if (
      field.meta?.enable_current_location !== false &&
      navigator.geolocation
    ) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newLocation = { lat: latitude, lng: longitude };
          setUserLocation(newLocation);
          if (!value) {
            onChange(newLocation);
          }
        },
        (error) => {
          console.error("Error fetching location:", error);
        },
      );
    }
  }, [field.meta?.enable_current_location, value, onChange]);

  if (!isLoaded) {
    return <p className="text-sm text-slate-500">Loading map...</p>;
  }

  return (
    <div className="border border-slate-300 rounded-sm overflow-hidden">
      <div className="w-full h-64">
        <GoogleMap
          center={value || userLocation}
          zoom={13}
          mapContainerStyle={{ width: "100%", height: "100%" }}
          onClick={(e) => {
            if (!disabled) {
              const latLng = e.latLng.toJSON();
              onChange(latLng);
            }
          }}
        >
          <Marker
            position={value || userLocation}
            draggable={!disabled}
            onDragEnd={(e) => {
              if (!disabled) {
                const latLng = e.latLng.toJSON();
                onChange(latLng);
              }
            }}
          />
        </GoogleMap>
      </div>
      {field.meta?.enable_address_search && (
        <div className="p-2 bg-slate-50 border-t">
          <Input
            type="text"
            placeholder="Search for address..."
            className="text-sm"
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
