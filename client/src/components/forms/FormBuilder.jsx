import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  Suspense,
  lazy,
  useMemo,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import {
  Plus,
  Save,
  Eye,
  Share2,
  Settings,
  Trash2,
  GripVertical,
  FileText,
  Undo2,
  Redo2,
  ShieldCheck,
  Trash,
  File,
  Rocket,
  PencilIcon,
  PenSquareIcon,
  Delete,
  TrashIcon,
  AlertCircle,
  Tag,
  X,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { FormFieldTypes } from "@/components/forms/FormFieldTypes";
const FormPreview = lazy(() =>
  import("@/components/forms/FormPreview").then((m) => ({
    default: m.FormPreview,
  })),
);
const FormSettings = lazy(() =>
  import("@/components/forms/FormSettings").then((m) => ({
    default: m.FormSettings,
  })),
);
const FormPublishModal = lazy(
  () => import("@/components/forms/FormPublishModal"),
);

import ConfirmDialog from "../common/ConfirmDialog";
import CommonLoader from "../common/CommonLoader";
import { useShowToast } from "../../utils/ToastMessage";
import Pagination from "@/components/common/Pagination";
import { useAuth } from "@/features/shared/hooks/useAuth";

/** Scroll so `element` is centered inside `container` only — does not scroll the page. */
function scrollElementWithinContainer(
  container,
  element,
  { behavior = "smooth" } = {},
) {
  const cRect = container.getBoundingClientRect();
  const eRect = element.getBoundingClientRect();
  const relativeTop = container.scrollTop + (eRect.top - cRect.top);
  const elHeight = element.offsetHeight;
  const targetTop = relativeTop - container.clientHeight / 2 + elHeight / 2;
  const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
  const nextTop = Math.max(0, Math.min(targetTop, maxTop));
  container.scrollTo({ top: nextTop, behavior });
}

export default function FormBuilder() {
  const { showSuccessToast, showErrorToast } = useShowToast();
  const token = localStorage.getItem("token");
  const { user: currentUser } = useAuth();
  const MAX_HISTORY = 50;
  // helper to snapshot (already defined)
  const snapshot = (obj) =>
    typeof structuredClone === "function"
      ? structuredClone(obj)
      : JSON.parse(JSON.stringify(obj));

  // --- New: load form (draft) into builder for editing ---
  const loadFormIntoBuilder = async (formId) => {
    try {
      const res = await fetch(`/api/forms/${formId}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to fetch form");
      }
      const payload = await res.json();
      const remote = payload?.data;
      if (!remote) throw new Error("Invalid form data");

      // Map server form to client form shape
      const mappedFields = (remote.fields || []).map((f, idx) => {
        // f may have field_id (ObjectId) or _id
        const id =
          (f.field_id && String(f.field_id)) ||
          (f._id && String(f._id)) ||
          `field_${Date.now()}_${idx}`;

        // client expects options as array of strings in many places,
        // backend stores options as array of {label, value}
        let options = [];
        if (Array.isArray(f.options)) {
          options = f.options.map((o) =>
            typeof o === "string" ? o : (o.label ?? o.value ?? ""),
          );
        }

        return {
          id,
          field_code: f.field_code || id,
          type: f.type,
          label: f.label || "",
          placeholder: f.placeholder || "",
          description: f.description || "",
          isRequired: f.isRequired ?? f.required ?? false,
          required: f.isRequired ?? f.required ?? false,
          read_only: f.read_only ?? false,
          hasOption: f.hasOption ?? options.length > 0,
          options,
          order: typeof f.order === "number" ? f.order : idx,
          validation: f.validation || {},
          meta: f.meta || {},
          visibility_condition: Array.isArray(f.visibility_condition)
            ? f.visibility_condition
            : [],
          enable_condition: Array.isArray(f.enable_condition)
            ? f.enable_condition
            : [],
          tooltip: f.tooltip || "",
          help_text: f.help_text || "",
          default_value: f.default_value ?? null,
          column_span: f.column_span ?? 1,
        };
      });

      const mappedForm = {
        form_id: remote.form_id,
        title: remote.title || "",
        description: remote.description || "",
        fields: mappedFields,
        tags: remote.tags || [],
        category_id: remote.category_id || null,
        owner_user_id:
          remote.owner_user_id?._id || remote.owner_user_id || null,
        settings: {
          allowAnonymous:
            remote.settings?.allowAnonymous ??
            remote.settings?.allow_anonymous ??
            true,
          submitMessage:
            remote.settings?.submitMessage ??
            remote.settings?.submitMessage ??
            "Thank you for your submission!",
          layout: remote.settings?.layout ?? "1-column",
          maxSubmissions: remote.settings?.maxSubmissions ?? null,
          redirectUrl: remote.settings?.redirectUrl ?? null,
          restrictPublishToOwner: remote.restrictPublishToOwner ?? false,
        },
      };

      // Load into builder and initialize history so undo/redo works naturally
      const snap = snapshot(mappedForm);
      setForm(snap);
      setLayout(mappedForm.settings?.layout || "1-column"); // ✅ Sync layout state with loaded form settings
      setSelectedField(null);
      setShowPreview(false);
      setShowSettings(false);
      setHistory([snap]);
      setCurrentStep(0);

      showSuccessToast("Draft loaded");
    } catch (err) {
      console.error("Failed to load form:", err);
      showErrorToast(err.message || "Unable to load form");
    }
  };
  // --- end new ---

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    title: "",
    description: "",
    fields: [],
    tags: [],
    category_id: null,
    owner_user_id: null,
    settings: {
      allowAnonymous: true,
      submitMessage: "Thank you for your submission!",
      layout: "1-column",
      maxSubmissions: null,
      redirectUrl: null,
      restrictPublishToOwner: false,
    },
  });

  const formFieldsScrollContainerRef = useRef(null);
  const scrollNewFieldIntoViewRef = useRef(null);

  // Tag input state
  const [tagInput, setTagInput] = useState("");
  const [layout, setLayout] = useState("1-column");
  const [history, setHistory] = useState([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [selectedField, setSelectedField] = useState(null);
  const selectedFieldData = useMemo(
    () => form.fields.find((f) => f.id === selectedField),
    [form.fields, selectedField],
  );
  const [showPreview, setShowPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [fieldTypesDialogOpen, setFieldTypesDialogOpen] = useState(false);
  const [draggedField, setDraggedField] = useState(null);
  const [confirmFieldDelete, setConfirmFieldDelete] = useState({
    isOpen: false,
    fieldId: null,
    label: "",
  });
  const [confirmFormDelete, setConfirmFormDelete] = useState({
    isOpen: false,
    formId: null,
    title: "",
  });
  const [fieldPropertiesDialogOpen, setFieldPropertiesDialogOpen] =
    useState(false);
  const [tempFieldData, setTempFieldData] = useState(null);

  useEffect(() => {
    if (fieldPropertiesDialogOpen && selectedFieldData) {
      setTempFieldData(JSON.parse(JSON.stringify(selectedFieldData)));
    } else if (!fieldPropertiesDialogOpen) {
      setTempFieldData(null);
    }
  }, [fieldPropertiesDialogOpen, selectedFieldData]);

  // Form publish modal state
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [formToPublish, setFormToPublish] = useState(null);

  // Fetch forms with pagination
  const [formsPage, setFormsPage] = useState(1);
  const FORMS_LIMIT = 5; // number of form cards per page

  const {
    data: formsData,
    isLoading,
    isError: isFormsError,
    error: formsError,
  } = useQuery({
    queryKey: ["forms", formsPage],
    queryFn: async () => {
      const res = await fetch(
        `/api/forms?page=${formsPage}&limit=${FORMS_LIMIT}&search=DRAFT`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to fetch forms");
      }
      const data = await res.json();
      return data; // { success:true, data: { forms, pagination } }
    },
    keepPreviousData: true,
    staleTime: 1000 * 60 * 2,
  });

  const forms = formsData?.data?.forms || [];
  const formsPagination = formsData?.data?.pagination || {
    total: forms.length,
    page: formsPage,
    limit: FORMS_LIMIT,
    pages: 1,
    hasMore: false,
  };

  // Check for edit query parameter and load form
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const editFormId = urlParams.get("edit");

    if (editFormId && token) {
      console.log("🔍 Edit mode detected, loading form:", editFormId);
      loadFormIntoBuilder(editFormId).catch((err) => {
        console.error("Failed to load form for editing:", err);
        showErrorToast(err.message || "Unable to load form");
      });
    }
  }, []); // Run only once on mount

  // Fetch forms with pagination
  const handleDragStart = (e, field) => {
    setDraggedField(field.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", field.id);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetField) => {
    e.preventDefault();
    const sourceFieldId = draggedField;
    const targetFieldId = targetField.id;

    if (sourceFieldId === targetFieldId) {
      setDraggedField(null);
      return;
    }

    const sourceIndex = form.fields.findIndex((f) => f.id === sourceFieldId);
    const targetIndex = form.fields.findIndex((f) => f.id === targetFieldId);

    if (sourceIndex === -1 || targetIndex === -1) {
      setDraggedField(null);
      return;
    }

    const newFields = [...form.fields];
    const [removed] = newFields.splice(sourceIndex, 1);
    newFields.splice(targetIndex, 0, removed);

    setForm((prev) => ({ ...prev, fields: newFields }));
    setDraggedField(null);
  };
  const updateForm = (newForm) => {
    const newHistory = history.slice(0, currentStep + 1);
    const snap = snapshot(newForm);
    const nextHistory = [...newHistory, snap].slice(-MAX_HISTORY);
    const nextStep = Math.min(nextHistory.length - 1, MAX_HISTORY - 1);

    setHistory(nextHistory);
    setCurrentStep(nextStep);
    setForm(snap);
  };
  const handleUndo = () => {
    if (currentStep > 0) {
      const nextStep = currentStep - 1;
      setCurrentStep(nextStep);
      setForm(history[nextStep]);
    }
  };
  const handleRedo = () => {
    if (currentStep < history.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      setForm(history[nextStep]);
    }
  };

  // Create form mutation
  const createFormMutation = useMutation({
    mutationFn: async ({ formData, status }) => {
      const isFormId = formData.form_id ? true : false;
      // Convert client-side fields -> server expected shape
      const payloadFields = (formData.fields || []).map((field, index) => {
        const options =
          Array.isArray(field.options) && field.options.length
            ? field.options.map((o) =>
                typeof o === "string"
                  ? {
                      label: o,
                      value: String(o)
                        .trim()
                        .replace(/\s+/g, "_")
                        .toLowerCase(),
                    }
                  : {
                      label: o.label ?? String(o),
                      value:
                        o.value ??
                        String(o.label ?? o)
                          .trim()
                          .replace(/\s+/g, "_")
                          .toLowerCase(),
                    },
              )
            : [];

        return {
          field_code: field.field_code || `field_${Date.now()}_${index}`, // ✅ Include field_code
          label: field.label ?? "",
          type: field.type,
          placeholder: field.placeholder ?? "",
          description: field.description ?? "",
          hasOption: options.length > 0,
          options,
          isRequired: field.required ?? field.isRequired ?? false,
          order: index,
          validation: field.validation || {},
          meta: field.meta || {},
          visibility_condition: field.visibility_condition || [], // ✅ Include conditional logic
          enable_condition: field.enable_condition || [], // ✅ Include conditional logic
          default_value: field.default_value || null, // ✅ Include default value
          column_span: field.column_span || 1, // ✅ Include layout
          read_only: field.read_only || false, // ✅ Include read-only flag
        };
      });

      // Build the base payload (common for both)
      const payload = {
        ...(isFormId ? { form_id: formData.form_id } : { form_id: undefined }),
        title: formData.title,
        description: formData.description,
        fields: payloadFields,
        settings: {
          allowAnonymous: formData.settings.allowAnonymous,
          submitMessage: formData.settings.submitMessage,
          layout: formData.settings.layout || "1-column",
          maxSubmissions: formData.settings.maxSubmissions || null,
          redirectUrl: formData.settings.redirectUrl || null,
        },
        restrictPublishToOwner:
          formData.settings.restrictPublishToOwner || false,
        tags: formData.tags || [],
        category_id: formData.category_id || null,
        visibility: "PRIVATE",
        scope: "INTERNAL",
      };

      // <RecurringTaskIcon size={size} className="flex-shrink-0" /> Differentiate between Create vs Update (Edit Draft)

      const endpoint = isFormId
        ? `/api/forms/draft` // update existing draft
        : `/api/forms/add-form/${status}`; // create new form

      const method = "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to save form");
      }

      return response.json();
    },

    onSuccess: (data) => {
      queryClient.invalidateQueries(["forms"]);
      showSuccessToast("Form saved");
      setForm({
        title: "",
        description: "",
        fields: [],
        tags: [],
        category_id: null,
        owner_user_id: null,
        settings: {
          allowAnonymous: true,
          submitMessage: "Thank you for your submission!",
          layout: "1-column",
          maxSubmissions: null,
          redirectUrl: null,
          restrictPublishToOwner: false,
        },
      });
      setTagInput("");
    },

    onError: (error) => {
      showErrorToast(error.message || "Unable to save form");
    },
  });

  // Delete form mutation
  const deleteFormMutation = useMutation({
    mutationFn: async (id) => {
      const response = await fetch(`/api/forms/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to delete form");
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["forms"]);
      closeConfirmFormDelete();

      showSuccessToast("Form deleted");
    },
    onError: (error) => {
      showErrorToast(error.message || "Unable to delete form");
    },
  });

  // Publish form mutation
  const publishFormMutation = useMutation({
    mutationFn: async (id) => {
      const response = await fetch(`/api/forms/${id}/publish`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to publish form");
      return response.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries(["forms"]);
      toast({
        title: "Success",
        description: "Form published successfully!",
        duration: 5000,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to publish form",
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  const addField = (fieldType) => {
    const id =
      (crypto?.randomUUID && crypto.randomUUID()) || `field_${Date.now()}`;

    // Generate field_code for conditional logic
    const field_code = `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const baseField = {
      id,
      field_code,
      type: fieldType,
      label: `${displayTypeLabel(fieldType)}`,
      placeholder: "",
      isRequired: false,
      read_only: false,
      order: form.fields.length,
      column_span: 1,
      validation: {},
      visibility_condition: [],
      enable_condition: [],
      meta: {},
    };

    // Add type-specific properties
    const typeSpecificProps = {};

    // Selection fields need options
    if (["dropdown", "multiselect", "radio", "checkbox"].includes(fieldType)) {
      typeSpecificProps.hasOption = true;
      typeSpecificProps.options = [
        { label: "Option 1", value: "option_1" },
        { label: "Option 2", value: "option_2" },
      ];
    }

    // File upload defaults
    if (fieldType === "file_upload") {
      typeSpecificProps.meta = {
        fileTypes: [".pdf", ".doc", ".docx", ".jpg", ".png"],
        maxSizeMB: 5,
        maxFiles: 1,
        allowed_mime_types: ["application/pdf", "image/jpeg", "image/png"],
      };
    }

    // Signature defaults
    if (fieldType === "signature") {
      typeSpecificProps.meta = {
        signature_type: "draw", // or 'type'
      };
    }

    // Location picker defaults
    if (fieldType === "location_picker") {
      typeSpecificProps.meta = {
        enable_current_location: true,
        enable_address_search: true,
      };
    }

    // Rating defaults
    if (fieldType === "rating") {
      typeSpecificProps.meta = {
        rating_scale: 5,
        rating_icon: "star",
      };
    }

    // Phone defaults
    if (fieldType === "phone") {
      typeSpecificProps.meta = {
        country_code: "+91",
      };
    }

    // Rich text defaults
    if (fieldType === "rich_text") {
      typeSpecificProps.meta = {
        allow_formatting: true,
      };
    }

    // Textarea defaults
    if (fieldType === "textarea") {
      typeSpecificProps.meta = {
        show_character_count: false,
      };
    }

    // Dropdown/multiselect defaults
    if (fieldType === "dropdown" || fieldType === "multiselect") {
      typeSpecificProps.meta = {
        searchable: false,
      };
    }

    // Lookup defaults
    if (fieldType === "lookup") {
      typeSpecificProps.meta = {
        lookup_endpoint: "/api/lookup",
        lookup_display_field: "name",
        lookup_value_field: "id",
      };
    }

    // Number/decimal defaults
    if (fieldType === "number") {
      typeSpecificProps.validation = {
        min: 0,
        max: null, // No upper limit
        step: 1,
      };
    }

    if (fieldType === "decimal") {
      typeSpecificProps.validation = {
        min: 0,
        max: null, // No upper limit
        step: 0.01,
        precision: 2,
      };
    }

    const newField = {
      ...baseField,
      ...typeSpecificProps,
    };

    updateForm({
      ...form,
      fields: [...form.fields, newField],
    });
    setSelectedField(newField.id);
    scrollNewFieldIntoViewRef.current = newField.id;
  };

  const handleAddFieldFromDialog = (fieldType) => {
    addField(fieldType);
  };

  const handleDone = (selectedTypes) => {
    const newFields = selectedTypes.map((fieldType) => {
      const id =
        (crypto?.randomUUID && crypto.randomUUID()) ||
        `field_${Date.now()}_${Math.random()}`;
      const field_code = `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const baseField = {
        id,
        field_code,
        type: fieldType,
        label: `${displayTypeLabel(fieldType)}`,
        placeholder: "",
        isRequired: false,
        read_only: false,
        order: form.fields.length,
        column_span: 1,
        validation: {},
        visibility_condition: [],
        enable_condition: [],
        meta: {},
      };

      const typeSpecificProps = {};

      if (
        ["dropdown", "multiselect", "radio", "checkbox"].includes(fieldType)
      ) {
        typeSpecificProps.hasOption = true;
        typeSpecificProps.options = [
          { label: "Option 1", value: "option_1" },
          { label: "Option 2", value: "option_2" },
        ];
      }

      if (fieldType === "file_upload") {
        typeSpecificProps.meta = {
          fileTypes: [".pdf", ".doc", ".docx", ".jpg", ".png"],
          maxSizeMB: 5,
          maxFiles: 1,
          allowed_mime_types: ["application/pdf", "image/jpeg", "image/png"],
        };
      }

      if (fieldType === "signature") {
        typeSpecificProps.meta = {
          signature_type: "draw",
        };
      }

      if (fieldType === "rating") {
        typeSpecificProps.meta = {
          rating_scale: 5,
          rating_icon: "star",
        };
      }

      if (fieldType === "phone") {
        typeSpecificProps.meta = {
          country_code: "+91",
        };
      }

      if (fieldType === "rich_text") {
        typeSpecificProps.meta = {
          allow_formatting: true,
        };
      }

      if (fieldType === "textarea") {
        typeSpecificProps.meta = {
          show_character_count: false,
        };
      }

      if (fieldType === "dropdown" || fieldType === "multiselect") {
        typeSpecificProps.meta = {
          searchable: false,
        };
      }

      if (fieldType === "number") {
        typeSpecificProps.validation = {
          min: 0,
          max: null,
          step: 1,
        };
      }

      if (fieldType === "decimal") {
        typeSpecificProps.validation = {
          min: 0,
          max: null,
          step: 0.01,
          precision: 2,
        };
      }

      return { ...baseField, ...typeSpecificProps };
    });

    // Update form with all new fields at once with proper ordering
    updateForm({
      ...form,
      fields: [...form.fields, ...newFields],
    });

    setFieldTypesDialogOpen(false);
  };

  const handleCancel = () => {
    setFieldTypesDialogOpen(false);
  };

  useLayoutEffect(() => {
    const id = scrollNewFieldIntoViewRef.current;
    if (!id) return;
    const container = formFieldsScrollContainerRef.current;
    scrollNewFieldIntoViewRef.current = null;
    if (!container) return;
    const el = Array.from(container.querySelectorAll("[data-field-id]")).find(
      (node) => node.getAttribute("data-field-id") === id,
    );
    if (el) {
      scrollElementWithinContainer(container, el, { behavior: "smooth" });
    }
  }, [form.fields]);

  const validateForm = () => {
    const errors = [];
    const warnings = [];

    // Check for missing field labels
    form.fields.forEach((field, index) => {
      if (!field.label || field.label.trim() === "") {
        errors.push(`Field ${index + 1} is missing a label.`);
      }
    });

    // Check for duplicate field IDs
    const fieldIds = form.fields.map((field) => field.id);
    const duplicateIds = fieldIds.filter(
      (id, index) => fieldIds.indexOf(id) !== index,
    );
    if (duplicateIds.length > 0) {
      errors.push("Duplicate field IDs found: " + duplicateIds.join(", "));
    }

    // Check for duplicate field_codes (required for conditional logic)
    const fieldCodes = form.fields
      .filter((f) => f.field_code)
      .map((f) => f.field_code);
    const duplicateCodes = fieldCodes.filter(
      (code, index) => fieldCodes.indexOf(code) !== index,
    );
    if (duplicateCodes.length > 0) {
      errors.push("Duplicate field codes found: " + duplicateCodes.join(", "));
    }

    // Check for required fields without default values
    form.fields.forEach((field, index) => {
      if (field.isRequired || field.required) {
        if (
          ["dropdown", "multiselect", "radio", "checkbox"].includes(field.type)
        ) {
          if (!field.options || field.options.length === 0) {
            errors.push(
              `Required field "${field.label}" (${field.type}) has no options.`,
            );
          }
        }
      }
    });

    // Validate conditional logic references
    form.fields.forEach((field, index) => {
      if (field.visibility_condition?.length > 0) {
        field.visibility_condition.forEach((condition) => {
          const referencedField = form.fields.find(
            (f) => f.field_code === condition.field_code,
          );
          if (!referencedField) {
            errors.push(
              `Field "${field.label}" has invalid visibility condition referencing non-existent field: ${condition.field_code}`,
            );
          }
        });
      }

      if (field.enable_condition?.length > 0) {
        field.enable_condition.forEach((condition) => {
          const referencedField = form.fields.find(
            (f) => f.field_code === condition.field_code,
          );
          if (!referencedField) {
            errors.push(
              `Field "${field.label}" has invalid enable condition referencing non-existent field: ${condition.field_code}`,
            );
          }
        });
      }
    });

    // Validate lookup fields have endpoint
    form.fields.forEach((field, index) => {
      if (field.type === "lookup") {
        if (!field.meta?.lookup_endpoint) {
          errors.push(
            `Lookup field "${field.label}" is missing lookup endpoint configuration.`,
          );
        }
      }
    });

    // Warn about unconditional required fields (always mandatory, no visibility condition)
    const unconditionalRequired = form.fields.filter(
      (field) =>
        (field.isRequired || field.required) &&
        (!field.visibility_condition ||
          field.visibility_condition.length === 0),
    );
    if (unconditionalRequired.length > 0) {
      const fieldNames = unconditionalRequired
        .map((f) => f.label || "Unnamed")
        .join(", ");
      warnings.push(
        `Unconditional required fields (always mandatory): ${fieldNames}`,
      );
    }

    return { errors, warnings };
  };

  const updateField = (fieldId, updates) => {
    updateForm({
      ...form,
      fields: form.fields.map((field) =>
        field.id === fieldId ? { ...field, ...updates } : field,
      ),
    });
  };

  const removeField = (fieldId) => {
    updateForm({
      ...form,
      fields: form.fields.filter((field) => field.id !== fieldId),
    });
    setSelectedField(null);
  };

  const openConfirmFieldDelete = (field) => {
    setConfirmFieldDelete({
      isOpen: true,
      fieldId: field.id,
      label: field.label || "Untitled field",
    });
  };
  const openConfirmFormDelete = (form) => {
    console.log("title", form);

    setConfirmFormDelete({
      isOpen: true,
      formId: form.form_id,
      title:
        `<span class='font-semibold mt-2'> Form Code :</span> ${form.form_code} <br/> <span class='font-semibold mt-2'> Form Title :</span>  ${form.title}` ||
        "Untitled form",
    });
  };

  const closeConfirmFieldDelete = () => {
    setConfirmFieldDelete({ isOpen: false, fieldId: null, label: "" });
  };
  const closeConfirmFormDelete = () => {
    setConfirmFormDelete({ isOpen: false, formId: null, title: "" });
  };

  const confirmRemoveField = () => {
    if (confirmFieldDelete.fieldId) {
      removeField(confirmFieldDelete.fieldId);
    }
    closeConfirmFieldDelete();
  };

  const moveField = (fieldId, direction) => {
    const fieldIndex = form.fields.findIndex((f) => f.id === fieldId);
    if (fieldIndex === -1) return;
    const newIndex = direction === "up" ? fieldIndex - 1 : fieldIndex + 1;
    if (newIndex < 0 || newIndex >= form.fields.length) return;

    const newFields = [...form.fields];
    [newFields[fieldIndex], newFields[newIndex]] = [
      newFields[newIndex],
      newFields[fieldIndex],
    ];

    updateForm({ ...form, fields: newFields });
  };

  const addGroup = (groupLabel) => {
    const newGroup = {
      groupLabel,
      fields: [],
    };
    setForm((prev) => ({
      ...prev,
      fields: [...prev.fields, newGroup],
    }));
  };

  const addFieldToGroup = (groupLabel, fieldType) => {
    const newField = {
      id: `field_${Date.now()}`,
      type: fieldType,
      placeholder: `Enter ${fieldType} value`,
      required: false,
    };

    setForm((prev) => ({
      ...prev,
      fields: prev.fields.map((group) =>
        group.groupLabel === groupLabel
          ? { ...group, fields: [...group.fields, newField] }
          : group,
      ),
    }));
  };
  const validateFormBeforeSave = () => {
    if (!form.title.trim()) {
      showErrorToast("Form title is required");
      return false;
    }

    if (form.fields.length === 0) {
      showErrorToast("Form must have at least one field");
      return false;
    }

    const { errors } = validateForm();
    if (errors.length > 0) {
      showErrorToast(errors.join("\n"));
      return false;
    }

    return true;
  };

  const handleSaveDraft = () => {
    if (!validateFormBeforeSave()) return;
    createFormMutation.mutate({ formData: form, status: "draft" });
  };

  // const handleSave = () => {
  //   if (!validateFormBeforeSave()) return;
  //   createFormMutation.mutate({ formData: form, status: "archived" });
  // };

  const handleSaveAndPublish = async () => {
    if (!validateFormBeforeSave()) return;

    // First save as draft, then open publish modal
    try {
      const result = await createFormMutation.mutateAsync({
        formData: form,
        status: "draft",
      });

      if (result.success && result.data) {
        console.log("📝 Form saved, data received:", result.data);
        console.log("📝 Using form_id:", result.data.form_id);

        // Set the form ID and open publish modal
        setFormToPublish({
          form_id: result.data.form_id,
          title: form.title,
          description: form.description,
        });
        setIsPublishModalOpen(true);
      }
    } catch (error) {
      console.error("❌ Save error:", error);
      showErrorToast("Unable to save form before publishing");
    }
  };

  const confirmRemoveForm = () => {
    if (confirmFormDelete.isOpen) {
      deleteFormMutation.mutate(confirmFormDelete.formId);
    }
  };

  const copyShareLink = (accessLink) => {
    const shareUrl = `${window.location.origin}/public/forms/${accessLink}`;
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: "Success",
      description: "Share link copied to clipboard!",
      duration: 5000,
    });
  };
  const displayTypeLabel = (type) => {
    const map = {
      // Text
      text: "Single-line Text",
      textarea: "Multi-line Text",
      rich_text: "Rich Text Editor",

      // Numbers
      number: "Number (Integer)",
      decimal: "Decimal Number",

      // Selections
      dropdown: "Dropdown (Single)",
      multiselect: "Dropdown (Multi)",
      radio: "Radio Buttons",
      checkbox: "Checkboxes",

      // Date/Time
      date: "Date",
      datetime: "Date & Time",

      // Contact
      email: "Email",
      phone: "Phone Number",
      url: "URL/Website",

      // Files
      file_upload: "File Upload",
      signature: "Signature",

      // Special
      rating: "Rating",
      toggle: "Toggle Switch",
      location_picker: "Location Picker",
      lookup: "Lookup/Reference",

      // Display
      title: "Section Title",
      label: "Read-only Label",
      qr_code: "QR/Barcode",
    };
    return (
      map[type] ||
      String(type)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (m) => m.toUpperCase())
    );
  };

  return (
    <div className="form-builder-page p-4 bg-slate-50 min-h-screen [&_.card]:!rounded-sm [&_input:not([type='checkbox']):not([type='radio'])]:!rounded-sm [&_select]:!rounded-sm [&_textarea]:!rounded-sm [&_.form-input]:!rounded-sm [&_.form-select]:!rounded-sm [&_.form-textarea]:!rounded-sm [&_button:not(.rounded-full)]:!rounded-sm [&_table]:!rounded-sm [&_.bg-white.border]:!rounded-sm [&_.rounded-sm]:!rounded-sm [&_.rounded-md]:!rounded-sm [&_.rounded-lg]:!rounded-sm [&_.rounded-xl]:!rounded-sm [&_.rounded-2xl]:!rounded-sm [&_.rounded]:!rounded-sm [&_input]:h-8 [&_input]:min-h-8 [&_input]:max-h-8 [&_input]:py-0 [&_input]:box-border [&_input]:leading-none">
      {/* Enhanced Header */}
      <div className=" bg-white p-4 mb-3 rounded-sm border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-normal m-0" style={{ color: "#676a6c" }}>Form Builders</h1>
          <p className="mt-0 text-sm text-blue-600">
            Create and customize dynamic forms with drag-and-drop simplicity
          </p>
        </div>
        <div className="">
          <div className="flex items-center justify-center space-x-3 mt-1">
            <Button
              size="sm"
              onClick={handleSaveDraft}
              disabled={createFormMutation.isPending}
              className="h-8 rounded-sm bg-gray-600 hover:bg-gray-700 text-white"
            >
              <File className="h-4 w-4 mr-0" />
              Draft Form
            </Button>
            {/* <Button
              onClick={handleSave}
              disabled={createFormMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Form
            </Button> */}
            <Button
              size="sm"
              onClick={handleSaveAndPublish}
              disabled={createFormMutation.isPending}
              className="h-8 rounded-sm bg-green-600 hover:bg-green-700 text-white"
            >
              <Rocket className="h-4 w-4 mr-0" />
              Save & Publish
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-sm"
              title="Undo"
              onClick={handleUndo}
              disabled={currentStep <= 0}
            >
              <Undo2 className="h-4 w-4 mr-0" /> Undo
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-sm"
              title="Redo"
              onClick={handleRedo}
              disabled={currentStep >= history.length - 1}
            >
              <Redo2 className="h-4 w-4 mr-0" /> Redo
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-none"
              title="Validation Check"
              onClick={() => {
                const { errors, warnings } = validateForm();
                if (errors.length > 0) {
                  toast({
                    title: "Validation Errors",
                    description: errors.join("\n"),
                    variant: "destructive",
                  });
                } else if (warnings.length > 0) {
                  toast({
                    title: "Validation Passed with Warnings",
                    description: warnings.join("\n"),
                    variant: "default",
                  });
                } else {
                  toast({
                    title: "Validation Successful",
                    description: "No issues found in the form.",
                    variant: "success",
                  });
                }
              }}
            >
              <ShieldCheck className="mr-0 h-4 w-4" />
              Validate
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-sm"
              onClick={() => setShowPreview(true)}
            >
              <Eye className="mr-0 h-4 w-4" />
              Preview
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 mb-3">
        {/* Form Builder */}
        <div className="space-y-3">
          {/* Form Details */}
          <Card className="border-slate-200 shadow-sm bg-white rounded-sm">
            <CardHeader className="pb-4 border-b border-slate-200">
              <CardTitle className="text-lg font-semibold text-slate-900 flex items-center">
                <Settings className="h-5 w-5 mr-2 text-blue-600" />
                Form Details
              </CardTitle>
              <p className="text-sm text-slate-900">
                Configure your form's basic information and settings
              </p>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Form Title *
                </label>
                <Input
                  placeholder="Enter a descriptive title for your form"
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <Textarea
                  placeholder="Provide a brief description of what this form is for (optional)"
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  rows={3}
                  className="border-slate-300 focus:border-blue-500 focus:ring-blue-500 rounded-sm"
                />
              </div>

              {/* Category and Tags Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Category Input */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Category
                  </label>
                  <Input
                    placeholder="Enter category name"
                    value={form.category_id || ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        category_id: e.target.value,
                      }))
                    }
                    className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Type a category name for your form
                  </p>
                </div>

                {/* Tags Input */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tags
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a tag and press Enter"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && tagInput.trim()) {
                          e.preventDefault();
                          const newTag = tagInput.trim().toLowerCase();
                          if (!form.tags.includes(newTag)) {
                            setForm((prev) => ({
                              ...prev,
                              tags: [...prev.tags, newTag],
                            }));
                          }
                          setTagInput("");
                        }
                      }}
                      className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (tagInput.trim()) {
                          const newTag = tagInput.trim().toLowerCase();
                          if (!form.tags.includes(newTag)) {
                            setForm((prev) => ({
                              ...prev,
                              tags: [...prev.tags, newTag],
                            }));
                          }
                          setTagInput("");
                        }
                      }}
                      className="px-3 rounded-sm h-8"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {/* Display Tags */}
                  {form.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {form.tags.map((tag, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="bg-green-100 text-green-800 hover:bg-green-200 flex items-center gap-1"
                        >
                          {tag}
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                tags: prev.tags.filter((_, i) => i !== index),
                              }))
                            }
                            className="hover:text-red-600 h-4 w-4 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Form Fields */}
          <Card className="border-slate-200 shadow-sm bg-white rounded-sm">
            <CardHeader className=" pb-4 border-b border-slate-200">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-900 flex items-center flex-wrap gap-x-2">
                    <Plus className="h-5 w-5 mr-2 text-green-600" />
                    Form Fields
                    <span className="ml-0 sm:ml-2 text-sm font-normal text-slate-500">
                      ({form.fields.length} fields)
                    </span>
                  </CardTitle>
                  <p className="text-sm text-slate-600 mt-1">
                    Drag and drop fields to reorder, click to configure
                    properties
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => setFieldTypesDialogOpen(true)}
                  className="h-8 shrink-0  bg-green-600 hover:bg-green-700 text-white rounded-sm"
                >
                  <Plus className="h-4 w-4 mr-0" />
                  Add form field
                </Button>
              </div>
            </CardHeader>
            <CardContent
              ref={formFieldsScrollContainerRef}
              className="p-4 max-h-[400px] overflow-y-auto" // Fixed height and scrollable area
            >
              <div className="space-y-2">
                {form.fields.map((field, index) => (
                  <div
                    key={field.id}
                    data-field-id={field.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, field)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, field)}
                    className={`group border rounded-sm p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                      selectedField === field.id
                        ? "border-blue-500 ring-2 ring-blue-500 bg-blue-50/10"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    } ${draggedField === field.id ? "opacity-50" : ""}`}
                    onClick={() => {
                      setSelectedField(field.id);
                      setFieldPropertiesDialogOpen(true);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-1 rounded-sm hover:bg-slate-100 cursor-grab">
                          <GripVertical className="h-4 w-4 text-slate-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-extrabold font-md text-slate-600">
                              {index + 1}
                            </span>
                            <span className="font-medium text-slate-900">
                              {field.label}
                            </span>
                            {field.required && (
                              <span className="text-red-500 text-xs">*</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <span
                              className={`text-sm capitalize px-2 py-1 rounded-sm transition-colors ${
                                selectedField === field.id
                                  ? "bg-blue-500 text-white "
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {displayTypeLabel(field.type)}
                            </span>
                            {field.placeholder && (
                              <span className="text-xs text-slate-400 italic">
                                "{field.placeholder}"
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveField(field.id, "up");
                          }}
                          disabled={index === 0}
                          className="h-8 w-8 p-0 hover:bg-slate-100"
                        >
                          ↑
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveField(field.id, "down");
                          }}
                          disabled={index === form.fields.length - 1}
                          className="h-8 w-8 p-0 hover:bg-slate-100"
                        >
                          ↓
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            openConfirmFieldDelete(field); // use modal instead of immediate delete
                          }}
                          className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {form.fields.length === 0 && (
                  <div className="text-center max-h-[400px] py-12 border-2 border-dashed border-slate-300 rounded-sm">
                    <div className="flex flex-col items-center space-y-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 rounded-sm border-slate-200 bg-slate-100 hover:bg-slate-200"
                        onClick={() => setFieldTypesDialogOpen(true)}
                        aria-label="Add form field"
                      >
                        <Plus className="h-6 w-6 text-slate-600" />
                      </Button>
                      <div>
                        <h3 className="text-lg font-medium text-slate-900">
                          No fields added yet
                        </h3>
                        <p className="text-slate-500 mt-1">
                          Click &quot;Add form field&quot; above or use the plus
                          button here to pick a field type
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          {/* Actions */}
          <div className="bg-white p-4 rounded-sm border border-slate-200 shadow-sm">
            <div className="flex justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Form Actions
                </h3>
                <p className="text-sm text-slate-600">
                  Save your form or configure advanced settings
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowSettings(true)}
                  className="border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
                {/* <Button
                  onClick={handleSave}
                  disabled={
                    createFormMutation.isPending ||
                    !form.title.trim() ||
                    form.fields.length === 0
                  }
                  className="bg-green-600 hover:bg-green-700 text-white disabled:bg-slate-300 "
                >
                  <Save className="h-4 w-4 mr-2" />
                  {createFormMutation.isPending ? "Saving..." : "Save Form"}
                </Button> */}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={fieldTypesDialogOpen}
        onOpenChange={setFieldTypesDialogOpen}
      >
        <DialogContent className="max-w-md w-[min(100vw-2rem,28rem)] max-h-[min(90vh,720px)] overflow-hidden p-0 gap-0 sm:max-w-lg flex flex-col rounded-sm sm:rounded-sm [&>button]:rounded-sm">
          <div className="p-1 overflow-y-auto min-h-0 rounded-sm">
            <FormFieldTypes
              inDialog
              onAddField={handleAddFieldFromDialog}
              existingFields={form.fields}
              onDone={handleDone}
              onCancel={handleCancel}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={fieldPropertiesDialogOpen}
        onOpenChange={setFieldPropertiesDialogOpen}
      >
        <DialogContent className="max-w-2xl w-[min(100vw-2rem,48rem)] max-h-[min(90vh,720px)] overflow-hidden p-0 gap-0 sm:max-w-2xl flex flex-col rounded-sm sm:rounded-sm [&>button]:rounded-sm">
          <div className="p-4 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center">
                <Settings className="h-5 w-5 mr-2 text-blue-600" />
                Field Properties
              </h2>
              <p className="text-sm text-slate-600">
                Configure the selected field's behavior and appearance
              </p>
            </div>
          </div>
          <div className="p-4 overflow-y-auto flex-1">
            {tempFieldData === null ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-300 rounded-sm">
                <div className="flex flex-col items-center space-y-3">
                  <div className="p-3 bg-slate-100 rounded-sm">
                    <AlertCircle className="h-6 w-6 text-red-400" />
                  </div>
                  <div className="text-sm text-slate-600">
                    No field selected
                  </div>
                </div>
              </div>
            ) : (
              <FieldProperties
                field={tempFieldData}
                form={form}
                onUpdate={(updates) => setTempFieldData((prev) => ({ ...prev, ...updates }))}
              />
            )}
          </div>
          <div className="p-4 border-t border-slate-200 flex justify-end space-x-2 bg-slate-50">
            <Button
              variant="outline"
              onClick={() => setFieldPropertiesDialogOpen(false)}
              className="rounded-sm h-8 text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (tempFieldData) {
                  updateField(selectedField, tempFieldData);
                }
                setFieldPropertiesDialogOpen(false);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-sm h-8"
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {showPreview && (
        <Suspense
          fallback={
            <div className="p-4">
              <CommonLoader />
            </div>
          }
        >
          <FormPreview
            form={form}
            layout={layout}
            onClose={() => setShowPreview(false)}
          />
        </Suspense>
      )}

      {showSettings && (
        <Suspense
          fallback={
            <div className="p-4">
              <CommonLoader />
            </div>
          }
        >
          <FormSettings
            settings={form.settings}
            layout={layout}
            setLayout={setLayout}
            onUpdate={(newSettings) =>
              setForm((prev) => ({ ...prev, settings: newSettings }))
            }
            onClose={() => setShowSettings(false)}
            isOwner={
              !form.form_id ||
              !form.owner_user_id ||
              (currentUser &&
                (currentUser._id || currentUser.id)?.toString() ===
                  form.owner_user_id?.toString())
            }
          />
        </Suspense>
      )}
      <ConfirmDialog
        isOpen={confirmFieldDelete.isOpen}
        title="Delete this field?"
        description={confirmFieldDelete.label}
        confirmLabel="Delete"
        onCancel={closeConfirmFieldDelete}
        onConfirm={confirmRemoveField}
        confirmVariant="destructive"
      />
      <ConfirmDialog
        isOpen={confirmFormDelete.isOpen}
        title="Delete this form?"
        description={confirmFormDelete.title}
        confirmLabel="Delete"
        onCancel={closeConfirmFormDelete}
        onConfirm={confirmRemoveForm}
        confirmVariant="destructive"
      />

      {/* Form Publish Modal */}
      {formToPublish && (
        <FormPublishModal
          open={isPublishModalOpen}
          onClose={(refresh) => {
            setIsPublishModalOpen(false);
            setFormToPublish(null);
            if (refresh) {
              queryClient.invalidateQueries(["forms"]);
              // Clear the builder form after successful publish
              setForm({
                title: "",
                description: "",
                fields: [],
                tags: [],
                category_id: null,
                owner_user_id: null,
                settings: {
                  allowAnonymous: true,
                  submitMessage: "Thank you for your submission!",
                  layout: "1-column",
                  maxSubmissions: null,
                  redirectUrl: null,
                  restrictPublishToOwner: false,
                },
              });
              setTagInput("");
            }
          }}
          formId={formToPublish.form_id}
          draftSchema={form}
        />
      )}
    </div>
  );
}

function FieldProperties({ field, onUpdate, form }) {
  if (!field) return null;

  // Confirm delete for condition
  const [confirmCondDelete, setConfirmCondDelete] = useState({
    isOpen: false,
    index: null,
    description: "",
  });
  const openConfirmConditionDelete = (index) => {
    const c = field.conditions?.[index];
    const otherFieldLabel =
      form?.fields?.find((f) => f.id === c?.field)?.label || "Selected field";
    const opText =
      c?.operator === "equals"
        ? "equals"
        : c?.operator === "not_equals"
          ? "does not equal"
          : c?.operator === "contains"
            ? "contains"
            : c?.operator || "";
    const desc = c
      ? `${otherFieldLabel} ${opText} "${c.value ?? ""}"`
      : "Delete condition?";
    setConfirmCondDelete({ isOpen: true, index, description: desc });
  };

  const closeConfirmConditionDelete = () =>
    setConfirmCondDelete({ isOpen: false, index: null, description: "" });

  const confirmRemoveCondition = () => {
    if (confirmCondDelete.index !== null) {
      handleRemoveCondition(confirmCondDelete.index);
    }
    closeConfirmConditionDelete();
  };
  const handleAddCondition = () => {
    const newCondition = { field: "", operator: "equals", value: "" };
    onUpdate({ conditions: [...(field.conditions || []), newCondition] });
  };

  const handleUpdateCondition = (index, updates) => {
    const updatedConditions = [...field.conditions];
    updatedConditions[index] = { ...updatedConditions[index], ...updates };
    onUpdate({ conditions: updatedConditions });
  };

  const handleRemoveCondition = (index) => {
    const updatedConditions = field.conditions.filter((_, i) => i !== index);
    onUpdate({ conditions: updatedConditions });
  };

  // Options editor for dropdown / multiselect / radio / checkbox
  const isSelect = ["dropdown", "multiselect", "radio", "checkbox"].includes(
    field.type,
  );
  const handleAddOption = () => {
    const next = [
      ...(field.options || []),
      `Option ${field.options?.length ? field.options.length + 1 : 1}`,
    ];
    onUpdate({ options: next });
  };
  const handleUpdateOption = (idx, value) => {
    const next = [...(field.options || [])];
    next[idx] = value;
    onUpdate({ options: next });
  };
  const handleRemoveOption = (idx) => {
    const next = (field.options || []).filter((_, i) => i !== idx);
    onUpdate({ options: next });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3  gap-3 mb-3">
        {/* Label Field */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Field Label
          </label>
          <Input
            type="text"
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="border px-2 py-0 h-8 min-h-8 max-h-8 box-border border-gray-300 focus:border-blue-500 focus:ring-blue-500 outline-none rounded-sm w-full leading-none"
            placeholder="Enter field label"
          />
        </div>

        {/* Placeholder Field */}
        {[
          "text",
          "textarea",
          "email",
          "url",
          "phone",
          "number",
          "decimal",
          "rich_text",
        ].includes(field.type) ? (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Placeholder
            </label>
            <Input
              type="text"
              value={field.placeholder}
              onChange={(e) => onUpdate({ placeholder: e.target.value })}
              className="border px-2 py-0 h-8 min-h-8 max-h-8 box-border border-gray-300 focus:border-blue-500 focus:ring-blue-500 outline-none rounded-sm w-full leading-none"
              placeholder="Enter placeholder text"
            />
          </div>
        ) : null}

        {/* Required Toggle - hidden for display-only fields (Section Title, Read-only Label) */}
        {!["title", "label"].includes(field.type) && (
          <div className="flex flex-col items-end">
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Required
            </label>
            <Button
              variant="ghost"
              onClick={() => onUpdate({ required: !field.required })}
              className={`w-12 h-6 flex items-center justify-start rounded-full p-1 transition-colors ${
                field.required ? "bg-blue-500" : "bg-gray-300"
              }`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${
                  field.required ? "translate-x-6" : "translate-x-0"
                }`}
              ></div>
            </Button>
          </div>
        )}
      </div>
      <div className={`grid gap-3 ${isSelect ? "grid-cols-2" : "grid-cols-1"}`}>
        {/* Conditional Logic Section */}
        <div
          className={`p-4 border border-slate-200 rounded-sm ${isSelect ? "bg-gray-50" : "bg-white"}`}
        >
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Conditional Logic
          </label>
          <div className="space-y-3">
            {field.conditions?.map((condition, index) => (
              <div key={index} className="flex items-center space-x-3">
                {/* Select Field */}
                <Select
                  value={condition.field}
                  onValueChange={(value) =>
                    handleUpdateCondition(index, { field: value })
                  }
                >
                  <SelectTrigger className="border border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-sm h-8 min-h-8 py-0">
                    <SelectValue placeholder="Select Field" />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm">
                    {(form?.fields || [])
                      .filter((f) => f.id !== field.id)
                      .map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                {/* Select Operator */}
                <Select
                  value={condition.operator}
                  onValueChange={(value) =>
                    handleUpdateCondition(index, { operator: value })
                  }
                >
                  <SelectTrigger className="border border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-sm h-8 min-h-8 py-0">
                    <SelectValue placeholder="Select Operator" />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm">
                    <SelectItem value="equals">Equals</SelectItem>
                    <SelectItem value="not_equals">Not Equals</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                  </SelectContent>
                </Select>

                {/* Input Value */}
                <Input
                  type="text"
                  value={condition.value}
                  onChange={(e) =>
                    handleUpdateCondition(index, { value: e.target.value })
                  }
                  placeholder="Value"
                  className="border-slate-300 focus:border-blue-500 focus:ring-blue-500 rounded-sm h-8 min-h-8 max-h-8 py-0 box-border leading-none"
                />

                {/* Remove Condition */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openConfirmConditionDelete(index)}
                  className="text-red-500 hover:text-red-700 h-8 w-8 rounded-sm"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            ))}

            {/* Add Condition Button */}
            <Button
              onClick={handleAddCondition}
              className={`mt-2 ${
                isSelect
                  ? "bg-blue-500 text-white w-full"
                  : "bg-blue-500 text-white"
              }`}
            >
              Add Condition
            </Button>
          </div>
        </div>

        {/* Options Section (only when isSelect true) */}
        {isSelect && (
          <div className="p-4 border border-slate-200 rounded-sm bg-white">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Options
            </label>
            <div className="space-y-2">
              {(field.options || []).map((opt, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <Input
                    value={opt}
                    onChange={(e) => handleUpdateOption(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => handleRemoveOption(idx)}
                    className="p-2 text-red-500 hover:text-red-700 h-8 w-8 rounded-sm"
                    title="Remove option"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div>
                <Button
                  onClick={handleAddOption}
                  className="mt-2 bg-blue-500 text-white"
                >
                  Add Option
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirm delete condition dialog */}
      <ConfirmDialog
        isOpen={confirmCondDelete.isOpen}
        title="Delete this condition?"
        description={confirmCondDelete.description}
        confirmLabel="Delete"
        onCancel={closeConfirmConditionDelete}
        onConfirm={confirmRemoveCondition}
        confirmVariant="destructive"
      />
    </div>
  );
}
