import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Calendar,
  User,
  Tag,
  AlertCircle,
  Paperclip,
  Plus,
  Upload,
  FileText,
  Link2,
} from "lucide-react";
import CustomEditor from "../common/CustomEditor";
import SimpleFileUploader from "../common/SimpleFileUploader";
import FormAttachModal from "./FormAttachModal";
import ConfirmDialog from "../common/ConfirmDialog";
import { useShowToast } from "../../utils/ToastMessage";
import AssigneeSearchSelect from "../common/AssigneeSearchSelect";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTaskStatuses } from "../../hooks/useTaskStatuses";
import { useTaskPriorities } from "../../hooks/useTaskPriorities";
import {
  getPriorityOptions,
  getDefaultPriorityCode,
} from "../../utils/priorityUtils";


// API function to unlink form from subtask
const unlinkFormFromSubtask = async (formId, subtaskId, token) => {
  const response = await fetch(
    `/api/forms/${formId}/unlink-from-subtask/${subtaskId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to unlink form");
  }

  return response.json();
};

// API function to create subtask
const createSubtask = async (parentTaskId, formData, token) => {
  console.log("🚀 createSubtask function called");
  console.log("📝 parentTaskId:", parentTaskId);
  console.log("📝 formData:", formData);
  console.log("🔑 token:", token ? `${token.substring(0, 20)}...` : "NO TOKEN");

  const formDataObj = new FormData();

  // Map form fields to API parameters
  console.log("📋 Mapping form fields to API parameters...");

  formDataObj.append("title", formData.title);
  console.log("✅ Added title:", formData.title);

  formDataObj.append("description", formData.description);
  console.log("✅ Added description:", formData.description);

  // Add assignee - extract value from object if needed
  let assigneeValue =
    typeof formData.assignee === "object"
      ? formData.assignee.value
      : formData.assignee;

  // If assignee is 'self', fetch the current user's ID
  if (assigneeValue === "self") {
    try {
      console.log('🔍 Assignee is "self", fetching current user ID...');
      const userResponse = await fetch("/api/auth/verify", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (userResponse.ok) {
        const responseData = await userResponse.json();
        console.log("📦 Full user response:", responseData);

        // The response has structure: { success: true, data: { _id, id, ... } }
        if (responseData.success && responseData.data) {
          assigneeValue = responseData.data._id || responseData.data.id;
          console.log('✅ Fetched user ID for "self":', assigneeValue);
        } else {
          console.error("❌ Invalid response structure:", responseData);
          throw new Error("Invalid user data response structure");
        }
      } else {
        console.error('❌ Failed to fetch user data for "self"');
        throw new Error("Failed to fetch current user data");
      }
    } catch (error) {
      console.error('❌ Error fetching user for "self":', error);
      throw new Error('Failed to resolve "self" assignee: ' + error.message);
    }
  }

  formDataObj.append("assignedTo", assigneeValue); // 🔹 Backend expects 'assignedTo', not 'assignee'
  console.log(
    "✅ Added assignedTo:",
    formData.assignee,
    "-> value:",
    assigneeValue,
  );

  // const isoDate = new Date(formData.dueDate).toISOString();
  // formDataObj.append('dueDate', isoDate);
  const isoDate = inputDateToLocalIso(formData.dueDate);
  formDataObj.append("dueDate", isoDate);

  console.log("✅ Added dueDate:", formData.dueDate, "-> ISO:", isoDate);

  // Priority is sent as the code value directly (e.g., 'low', 'medium', 'high')
  formDataObj.append("priority", formData.priority);
  console.log("✅ Added priority:", formData.priority);

  // Status is already in uppercase format from the dropdown (OPEN, INPROGRESS, ONHOLD, DONE)
  // No mapping needed, send directly
  formDataObj.append("status", formData.status);
  console.log("✅ Added status:", formData.status, "-> sent as-is");

  // Visibility: Send as-is (Private/Public) - backend expects capitalized format
  formDataObj.append("visibility", formData.visibility);
  console.log("✅ Added visibility:", formData.visibility, "-> sent as-is");

  // Add tags if any
  if (formData.tags && formData.tags.length > 0) {
    console.log("🏷️ Adding tags:", formData.tags);
    formData.tags.forEach((tag) => {
      formDataObj.append("tags", tag);
    });
    console.log("✅ Added tags:", formData.tags.length, "tags");
  } else {
    console.log("🏷️ No tags to add");
  }

  // Add attachments if any - properly handle File objects
  if (formData.attachments && formData.attachments.length > 0) {
    console.log("📎 Adding attachments:", formData.attachments.length);
    formData.attachments.forEach((fileObj, index) => {
      // fileObj can be {id, name, size, file} or {url, name, isExisting}
      if (fileObj.file) {
        // New file - append the actual File object
        formDataObj.append("attachments", fileObj.file);
        console.log(
          `✅ Added new attachment ${index + 1}:`,
          fileObj.name,
          fileObj.size,
          "bytes",
        );
      } else if (fileObj.isExisting && fileObj.url) {
        // Existing file - append URL so backend knows to keep it
        formDataObj.append("existingAttachments", fileObj.url);
        console.log(
          `✅ Keeping existing attachment ${index + 1}:`,
          fileObj.name,
        );
      }
    });
  } else {
    console.log("📎 No attachments to add");
  }

  const apiUrl = `/api/tasks/${parentTaskId}/create-subtask`;
  console.log("🌐 API URL:", apiUrl);
  console.log("🔍 URL Analysis:");
  console.log("🔍 - parentTaskId in URL:", parentTaskId);
  console.log("🔍 - parentTaskId type:", typeof parentTaskId);
  console.log(
    "🔍 - parentTaskId string length:",
    parentTaskId.toString().length,
  );
  console.log(
    "🔍 - Is ObjectId format (24 chars hex)?",
    /^[0-9a-fA-F]{24}$/.test(parentTaskId.toString()),
  );
  console.log("🔍 - Is integer format?", /^\d+$/.test(parentTaskId.toString()));

  try {
    console.log("📡 Making API request...");
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        accept: "application/json",
      },
      body: formDataObj,
    });

    console.log("📡 Response status:", response.status);
    console.log("📡 Response ok:", response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ API Error Response:", errorText);

      // Try to parse as JSON to extract backend message
      let errorMessage = "Unable to create subtask";
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (e) {
        // If not JSON, use status and text
        errorMessage = errorText || `HTTP error! status: ${response.status}`;
      }

      // ✅ FIX: Don't show error toast here - let the caller handle it
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log("✅ API Success Response:", data);
    // ✅ FIX: Don't show success toast here - let the caller handle it to avoid duplicate toasts
    return data;
  } catch (error) {
    console.error("❌ Error creating subtask:", error);
    console.error("❌ Error details:", error.message);
    throw error;
  }
};

// Local YYYY-MM-DD for <input type="date">
const formatDateToInput = (date) => {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// Convert input 'YYYY-MM-DD' → ISO string at local midnight
const inputDateToLocalIso = (inputDate) => {
  if (!inputDate) return null;
  const [y, m, d] = inputDate.split("-").map(Number);
  const localMidnight = new Date(y, m - 1, d);
  return localMidnight.toISOString();
};

function SubtaskForm({
  isOpen,
  onClose,
  onSubmit,
  onUpdateSubmit, // New prop for handling updates
  parentTask,
  editData = null,
  mode = "create", // 'create' or 'edit'
  isOrgUser = false,
  refreshTask,
}) {
  // ✅ Call useShowToast at component level (not inside utility functions)
  const { showSuccessToast, showErrorToast } = useShowToast();
  const queryClient = useQueryClient();
  const { data: taskStatuses = [] } = useTaskStatuses();

  const { data: taskPriorities = [] } = useTaskPriorities();

  const priorityOptions = getPriorityOptions(taskPriorities);

  const [formData, setFormData] = useState({
    title: "",
    assignee: isOrgUser ? null : { value: "self", label: "Self" }, // Object format for AssigneeSearchSelect
    dueDate: parentTask?.dueDate ? formatDateToInput(parentTask.dueDate) : "",
    priority: getDefaultPriorityCode(taskPriorities),
    status: "OPEN",
    visibility: parentTask?.visibility || "Private",
    description: "",
    attachments: [],
    tags: [], // Tags inherited from parent or edited independently
  });
  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isDueDateManuallySet, setIsDueDateManuallySet] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const attachmentsInputRef = useRef(null);

  // Form attachment state
  const [showFormAttachModal, setShowFormAttachModal] = useState(false);
  const [attachedForm, setAttachedForm] = useState(null);
  // Pending form attachment (for create mode - form to attach after subtask is created)
  const [pendingFormAttachment, setPendingFormAttachment] = useState(null);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);

  // ✅ Calculate valid status options based on current status and allowedTransitions (for edit mode)
  const getValidStatusOptions = () => {
    // In create mode, show all active statuses
    if (mode === "create") {
      return taskStatuses
        .filter((s) => s && s.active)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }

    // In edit mode, respect allowedTransitions
    const currentStatusCode = String(editData?.status || formData.status || "")
      .trim()
      .toUpperCase();
    const currentStatusObj = taskStatuses.find(
      (s) => s.code === currentStatusCode,
    );

    // If no current status or status not found, show all active statuses
    if (!currentStatusObj) {
      return taskStatuses.filter((s) => s && s.active);
    }

    // Always include the current status in options
    const validCodes = new Set([currentStatusCode]);

    // Add allowed transitions if defined
    if (Array.isArray(currentStatusObj.allowedTransitions)) {
      currentStatusObj.allowedTransitions.forEach((code) =>
        validCodes.add(code),
      );
    } else {
      // If allowedTransitions not defined, allow all (backward compatibility)
      taskStatuses
        .filter((s) => s && s.active)
        .forEach((s) => validCodes.add(s.code));
    }

    // Return statuses that match valid codes
    return taskStatuses
      .filter((s) => s && s.active && validCodes.has(s.code))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  };

  // Auto-adjust due date based on priority when creating subtask
  useEffect(() => {
    // Only auto-adjust if:
    // 1. We're in create mode
    // 2. User hasn't manually set a date
    // 3. Priority has been changed from default
    if (
      mode === "create" &&
      !isDueDateManuallySet &&
      formData.priority &&
      parentTask?.dueDate
    ) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const parentDueDate = new Date(parentTask.dueDate);
      parentDueDate.setHours(0, 0, 0, 0);

      // Priority → Due Date mapping using dynamic configuration
      const priorityConfig = priorityOptions.find(
        (p) => p.value === formData.priority,
      );
      let daysToAdd = 30; // Default

      if (priorityConfig && Number.isFinite(priorityConfig.daysToDue)) {
        daysToAdd = priorityConfig.daysToDue;
      } else {
        // Fallback defaults if configuration not found
        const fallbackDays = {
          critical: 2,
          urgent: 1,
          high: 7,
          medium: 14,
          low: 30,
        };
        daysToAdd = fallbackDays[String(formData.priority).toLowerCase()] || 30;
      }

      const suggestedDate = new Date(today);
      suggestedDate.setDate(today.getDate() + daysToAdd);

      // Ensure subtask due date doesn't exceed parent due date
      const finalDate =
        suggestedDate > parentDueDate ? parentDueDate : suggestedDate;

      setFormData((prev) => ({
        ...prev,
        dueDate: formatDateToInput(finalDate.toISOString()),
      }));

      console.log("📅 Auto-adjusted due date:", {
        priority: formData.priority,
        daysToAdd,
        suggestedDate: formatDateToInput(suggestedDate.toISOString()),
        parentDueDate: formatDateToInput(parentTask.dueDate),
        finalDate: formatDateToInput(finalDate.toISOString()),
      });
    }
  }, [formData.priority, mode, isDueDateManuallySet, parentTask?.dueDate]);
  // Populate form when editing or reset with parent data
  useEffect(() => {
    if (editData && mode === "edit") {
      console.log("══════════════════════════════════════════════════════");
      console.log("🔧 [EDIT MODE] Starting form population");
      console.log("══════════════════════════════════════════════════════");
      console.log(
        "📦 Full editData received:",
        JSON.stringify(editData, null, 2),
      );
      console.log("---");
      console.log("🔍 Assignee fields:", {
        "editData.assignee": editData.assignee,
        "editData.assigneeId": editData.assigneeId,
        "editData.assigneeName": editData.assigneeName,
        "editData.assignedTo": editData.assignedTo,
        "typeof assignee": typeof editData.assignee,
      });
      console.log("---");
      console.log("📅 Due Date fields:", {
        "editData.dueDate": editData.dueDate,
        "typeof dueDate": typeof editData.dueDate,
        "dueDate isEmpty": !editData.dueDate,
      });
      console.log("---");

      // Convert assignee to object format if it's a string or object
      let assigneeValue;

      console.log("🔧 [EDIT] Populating form with editData:", {
        assignee: editData.assignee,
        assigneeId: editData.assigneeId,
        assignedTo: editData.assignedTo,
        assigneeType: typeof editData.assignee,
      });

      // Priority 1: Check for assigneeId field (from TaskDetail mapping)
      if (editData.assigneeId) {
        // assigneeId is the actual user ID, assigneeName is the display name
        assigneeValue = {
          value: editData.assigneeId,
          label: editData.assigneeName || editData.assignee || "Assigned User",
        };
        console.log("🔧 [EDIT] Priority 1 - Using assigneeId:", assigneeValue);
      }
      // Priority 2: Handle different assignee data formats
      else if (
        typeof editData.assignee === "object" &&
        editData.assignee !== null
      ) {
        console.log(
          "🔧 [EDIT] Priority 2 - assignee is object:",
          editData.assignee,
        );
        // If assignee is already an object with value/label (from react-select)
        if (editData.assignee.value && editData.assignee.label) {
          assigneeValue = editData.assignee;
          console.log("✅ Using existing value/label object:", assigneeValue);
        }
        // If assignee is a populated user object with _id
        else if (editData.assignee._id) {
          const userName =
            `${editData.assignee.firstName || ""} ${editData.assignee.lastName || ""}`.trim() ||
            editData.assignee.email ||
            "Unknown User";
          assigneeValue = {
            value: editData.assignee._id,
            label: userName,
          };
          console.log(
            "✅ Using assignee._id with constructed name:",
            assigneeValue,
          );
        } else {
          assigneeValue = isOrgUser ? null : { value: "self", label: "Self" };
          console.log("⚠️ Fallback to default assignee:", assigneeValue);
        }
      }
      // Priority 3: Check if assignee looks like a MongoDB ObjectId (24 hex chars)
      else if (
        typeof editData.assignee === "string" &&
        /^[0-9a-fA-F]{24}$/.test(editData.assignee)
      ) {
        console.log(
          "🔧 [EDIT] Priority 3 - assignee is ObjectId string:",
          editData.assignee,
        );
        // It's an ID - use assigneeName if available, otherwise placeholder
        assigneeValue = {
          value: editData.assignee,
          label: editData.assigneeName || "Assigned User", // Use assigneeName, NOT the ID
        };
        console.log("✅ Using ObjectId with name:", assigneeValue);
      } else if (
        typeof editData.assignee === "string" &&
        editData.assignee === "self"
      ) {
        assigneeValue = { value: "self", label: "Self" };
        console.log("🔧 [EDIT] Priority 4 - Using self assignee");
      }
      // Priority 5: assignee is a display name string - need assigneeId
      else if (typeof editData.assignee === "string") {
        console.log(
          "🔧 [EDIT] Priority 5 - assignee is string (display name):",
          editData.assignee,
        );
        // This is a display name, not an ID - we need assigneeId or assignedTo
        // If we have a name, it might be the display text but we need the ID
        console.warn(
          "⚠️ [EDIT] assignee is a display name without assigneeId, using self as fallback",
        );
        assigneeValue = isOrgUser ? null : { value: "self", label: "Self" };
      }
      // Priority 6: Check assignedTo field as fallback (backend uses assignedTo, frontend uses assignee)
      else if (editData.assignedTo) {
        console.log(
          "🔧 [EDIT] Priority 6 - Using assignedTo:",
          editData.assignedTo,
        );
        if (
          typeof editData.assignedTo === "object" &&
          editData.assignedTo._id
        ) {
          const userName =
            `${editData.assignedTo.firstName || ""} ${editData.assignedTo.lastName || ""}`.trim() ||
            editData.assignedTo.email ||
            "Unknown User";
          assigneeValue = {
            value: editData.assignedTo._id,
            label: userName,
          };
          console.log(
            "✅ Using assignedTo._id with constructed name:",
            assigneeValue,
          );
        } else if (typeof editData.assignedTo === "string") {
          // If it's an ID string (24 hex chars), don't use it as label
          const isId = /^[0-9a-fA-F]{24}$/.test(editData.assignedTo);
          assigneeValue = {
            value: editData.assignedTo,
            label: isId
              ? editData.assigneeName || "Assigned User"
              : editData.assignedTo,
          };
          console.log(
            "✅ Using assignedTo string with proper label:",
            assigneeValue,
          );
        } else {
          assigneeValue = isOrgUser ? null : { value: "self", label: "Self" };
          console.log("⚠️ Fallback to default assignee");
        }
      } else {
        assigneeValue = isOrgUser ? null : { value: "self", label: "Self" };
        console.log(
          "⚠️ [EDIT] No assignee data found, using default:",
          assigneeValue,
        );
      }

      console.log("🔧 [EDIT] Final assigneeValue:", assigneeValue);

      // Format the due date for the input field (YYYY-MM-DD)
      const formattedDueDate = editData.dueDate
        ? formatDateToInput(editData.dueDate)
        : "";
      console.log("📅 [EDIT] Due Date Formatting:", {
        original: editData.dueDate,
        formatted: formattedDueDate,
        isEmpty: !formattedDueDate,
      });

      // Load existing attachments
      const existingAttachments =
        editData.attachments && editData.attachments.length > 0
          ? editData.attachments.map((att, idx) => {
              // Extract filename from various possible formats
              let fileName = "file";
              let fileUrl = "";

              if (typeof att === "string") {
                // att is a URL string
                fileName = att.split("/").pop() || "file";
                fileUrl = att;
              } else if (typeof att === "object" && att !== null) {
                // att is an object with metadata
                fileName = att.originalName || att.name || "file";
                fileUrl = att.url || "";
              }

              return {
                id: `existing-${idx}-${Date.now()}`,
                name: fileName,
                url: fileUrl,
                isExisting: true,
                size: att?.size || 0,
              };
            })
          : [];
      console.log(
        "📎 [EDIT] Loaded existing attachments:",
        existingAttachments,
      );

      const finalFormData = {
        title: editData.title || "",
        assignee: assigneeValue,
        dueDate: formattedDueDate,
        priority: editData.priority || getDefaultPriorityCode(taskPriorities),
        status: editData.status || "Open",
        visibility: editData.visibility || "Private",
        description: editData.description || "",
        attachments: existingAttachments, // Load existing attachments
        tags: editData.tags || [], // Edit mode - use subtask's own tags
      };

      console.log(
        "📝 [EDIT] Final form data being set:",
        JSON.stringify(finalFormData, null, 2),
      );
      console.log("══════════════════════════════════════════════════════");
      console.log("✅ [EDIT MODE] Form population complete");
      console.log("══════════════════════════════════════════════════════");

      setFormData(finalFormData);
    } else if (mode === "create") {
      setFormData({
        title: "",
        assignee: isOrgUser ? null : { value: "self", label: "Self" },
        dueDate: parentTask?.dueDate
          ? formatDateToInput(parentTask.dueDate)
          : "",
        priority: getDefaultPriorityCode(taskPriorities),
        status: "OPEN",
        visibility: parentTask?.visibility || "Private",
        description: "",
        attachments: [],
        tags: parentTask?.tags || [], // Create mode - inherit parent tags
      });
      // Reset form attachment state for create mode
      setAttachedForm(null);
      setPendingFormAttachment(null);
    }
  }, [editData, mode, parentTask, isOrgUser]);

  // Load attached form details when editing a subtask that has a form attached
  useEffect(() => {
    if (mode !== "edit" || !editData?.attached_form_version_id) {
      // No form attached or not in edit mode
      if (mode === "edit") setAttachedForm(null);
      return;
    }

    const formVersionId =
      typeof editData.attached_form_version_id === "object"
        ? editData.attached_form_version_id._id
        : editData.attached_form_version_id;

    if (!formVersionId) {
      setAttachedForm(null);
      return;
    }

    const token = localStorage.getItem("token");
    console.log(
      "📋 [SubtaskForm] Loading attached form details for version:",
      formVersionId,
    );

    fetch(`/api/forms/versions/${formVersionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data && !data.data.restricted) {
          const version = data.data.version;
          // Use form_template_id (ObjectId) preferred for API calls; fallback to version.form_id
          const formId =
            data.data.form_template_id ||
            version?.form_id ||
            version?.form_template_id;
          // Determine submission count from subtask status field
          const submissionStatus = editData.form_submission_status;
          setAttachedForm({
            form_id: formId,
            version_id: formVersionId,
            form_title:
              data.data.form_title ||
              version?.snapshot_data?.title ||
              "Attached Form",
            version_number: version?.version_number || "N/A",
            submission_count: submissionStatus === "SUBMITTED" ? 1 : 0,
          });
          console.log(
            "✅ [SubtaskForm] Attached form loaded:",
            data.data.form_title,
          );
        } else {
          // Restricted or error - show nothing
          setAttachedForm(null);
        }
      })
      .catch((err) => {
        console.error("❌ [SubtaskForm] Failed to load attached form:", err);
        setAttachedForm(null);
      });
  }, [editData?.attached_form_version_id, mode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("🎯 handleSubmit called");
    console.log("🔍 Mode:", mode);
    console.log("📝 Current formData:", formData);

    const newErrors = validateForm();
    console.log("✅ Validation errors:", newErrors);
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      console.log("❌ Form has validation errors, stopping submission");
      return;
    }

    if (mode === "create") {
      console.log("🚀 Starting subtask creation process...");
      setIsLoading(true);
      try {
        // Get auth token from localStorage or context
        console.log("🔑 Looking for auth token...");
        const authToken = localStorage.getItem("authToken");
        const token = localStorage.getItem("token");
        console.log("🔑 authToken exists:", !!authToken);
        console.log("🔑 token exists:", !!token);

        const finalToken = authToken || token;
        console.log("🔑 Final token selected:", !!finalToken);

        if (!finalToken) {
          console.error("❌ No authentication token found");
          showErrorToast("Authentication token not found. Please login again.");
          return;
        }

        console.log("🔍 Checking parent task...");
        console.log("🔍 parentTask:", parentTask);
        console.log("🔍 parentTask type:", typeof parentTask);
        console.log("🔍 parentTask._id:", parentTask?._id);
        console.log("🔍 parentTask.id:", parentTask?.id);
        console.log(
          "🔍 All parentTask keys:",
          parentTask ? Object.keys(parentTask) : "parentTask is null/undefined",
        );

        // Check if it's a Mongoose document with _doc property
        if (parentTask && parentTask._doc) {
          console.log(
            "🔍 Mongoose document detected, checking _doc:",
            parentTask._doc,
          );
          console.log("🔍 _doc._id:", parentTask._doc._id);
          console.log("🔍 _doc.id:", parentTask._doc.id);
        }

        // Handle both cases: parentTask as string (ID) or object with _id/id property
        let parentTaskId;
        if (typeof parentTask === "string") {
          parentTaskId = parentTask;
          console.log("✅ parentTask is string, using directly:", parentTaskId);
        } else if (parentTask?._doc?._id) {
          // Case: Mongoose document with _doc property
          parentTaskId = parentTask._doc._id;
          console.log("✅ Using parentTask._doc._id (Mongoose):", parentTaskId);
          console.log("🔍 _doc._id type:", typeof parentTask._doc._id);
          console.log(
            "🔍 _doc._id length:",
            parentTask._doc._id.toString().length,
          );
        } else if (parentTask?._doc?.id) {
          // Case: Mongoose document with _doc.id property
          parentTaskId = parentTask._doc.id;
          console.log("✅ Using parentTask._doc.id (Mongoose):", parentTaskId);
          console.log("🔍 _doc.id type:", typeof parentTask._doc.id);
          console.log(
            "🔍 _doc.id length:",
            parentTask._doc.id.toString().length,
          );
        } else if (parentTask?._id) {
          parentTaskId = parentTask._id;
          console.log("✅ Using parentTask._id:", parentTaskId);
          console.log("🔍 _id type:", typeof parentTask._id);
          console.log("🔍 _id length:", parentTask._id.toString().length);
        } else if (parentTask?.id) {
          parentTaskId = parentTask.id;
          console.log("✅ Using parentTask.id:", parentTaskId);
          console.log("🔍 id type:", typeof parentTask.id);
          console.log("🔍 id length:", parentTask.id.toString().length);
        } else if (parentTask && typeof parentTask.toObject === "function") {
          // Case: Mongoose document with toObject() method
          const plainObject = parentTask.toObject();
          console.log("🔍 Converted Mongoose to plain object:", plainObject);
          parentTaskId = plainObject._id || plainObject.id;
          console.log("✅ Using converted object ID:", parentTaskId);
        }

        if (!parentTaskId) {
          console.error("❌ Parent task ID not found with standard methods");
          console.error("❌ Trying manual extraction from parentTask...");

          // Last resort: try to extract from various nested properties
          if (parentTask) {
            const possibleIds = [
              parentTask._id,
              parentTask.id,
              parentTask._doc?._id,
              parentTask._doc?.id,
              parentTask.$__.fullPath,
              // Check if it's stringified in any way
              JSON.stringify(parentTask).match(/\"_id\":\"([^\"]+)\"/)?.[1],
              JSON.stringify(parentTask).match(/\"id\":\"([^\"]+)\"/)?.[1],
            ].filter(Boolean);

            console.error("❌ Possible IDs found:", possibleIds);

            if (possibleIds.length > 0) {
              parentTaskId = possibleIds[0];
              console.log("🔄 Using first found ID:", parentTaskId);
            }
          }

          if (!parentTaskId) {
            console.error("❌ Parent task ID still not found");
            console.error("❌ Full parentTask dump:", parentTask);
            console.error(
              "❌ parentTask JSON:",
              JSON.stringify(parentTask, null, 2),
            );
            showErrorToast(
              "Parent task ID is required to create subtask. Check console for details.",
            );
            return;
          }
        }

        console.log("✅ Final parentTaskId:", parentTaskId);
        console.log("✅ Final parentTaskId type:", typeof parentTaskId);
        console.log(
          "✅ Final parentTaskId length:",
          parentTaskId.toString().length,
        );
        console.log(
          "✅ Is ObjectId format?",
          /^[0-9a-fA-F]{24}$/.test(parentTaskId.toString()),
        );

        // CRITICAL: Check if we need to convert integer ID to ObjectId format
        if (
          typeof parentTaskId === "number" ||
          (typeof parentTaskId === "string" && /^\d+$/.test(parentTaskId))
        ) {
          console.log(
            "⚠️  WARNING: parentTaskId appears to be integer format:",
            parentTaskId,
          );
          console.log(
            '⚠️  Backend expects MongoDB ObjectId format. This will likely cause a "Cast to ObjectId failed" error.',
          );
          console.log(
            "⚠️  You may need to use the real MongoDB _id instead of the mapped integer id.",
          );
        }

        console.log("📡 Calling createSubtask API...");
        const result = await createSubtask(parentTaskId, formData, finalToken);
        console.log("✅ API call completed, result:", result);

        if (result.success) {
          console.log("🎉 Subtask created successfully!");

          // Get the newly created subtask ID
          const newSubtaskId = result.subtask?.id || result.subtask?._id;
          console.log("📌 New subtask ID:", newSubtaskId);

          // If there's a pending form attachment, attach it now
          if (pendingFormAttachment && newSubtaskId) {
            console.log(
              "📎 Attaching pending form to newly created subtask...",
            );
            try {
              const attachResponse = await fetch(
                `/api/forms/${pendingFormAttachment.form_id}/attach-to-subtask`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${finalToken}`,
                  },
                  body: JSON.stringify({
                    subtask_id: newSubtaskId,
                    form_version_id: pendingFormAttachment.version_id || null,
                  }),
                },
              );

              if (attachResponse.ok) {
                const attachResult = await attachResponse.json();
                console.log("✅ Form attached successfully:", attachResult);
                showSuccessToast("Subtask created & form attached");
              } else {
                const attachError = await attachResponse.json();
                console.error("❌ Failed to attach form:", attachError);
                showErrorToast(attachError.message || "Failed to attach form");
              }
            } catch (attachError) {
              console.error("❌ Error attaching form:", attachError);
              showErrorToast(attachError.message || "Failed to attach form");
            }
          } else {
            // ✅ FIX: Show single success toast when no form attachment is pending
            showSuccessToast("Subtask created");
          }

          // Dispatch custom event for AllTasks to refetch and update table immediately
          console.log("📡 Dispatching subtaskCreated event...");
          window.dispatchEvent(
            new CustomEvent("subtaskCreated", {
              detail: { parentTaskId, subtaskId: newSubtaskId },
            }),
          );

          // Invalidate tasks query to update UI instantly
          queryClient.invalidateQueries({ queryKey: ["allTasks"] });


          // Call onSubmit only if it's provided and is a function
          if (onSubmit && typeof onSubmit === "function") {
            console.log("✅ Calling parent onSubmit with subtask data");
            onSubmit(result.subtask); // Pass the created subtask data back
          } else {
            console.log("ℹ️ No onSubmit function provided, skipping callback");
          }

          // Refresh parent task to show new subtask count (if function provided)
          console.log("🔄 Checking refreshTask:", {
            exists: !!refreshTask,
            type: typeof refreshTask,
            isFunction: typeof refreshTask === "function",
          });

          if (typeof refreshTask === "function") {
            console.log(
              "🔄 Refreshing parent task to fetch updated subtasks...",
            );
            try {
              await refreshTask();
              console.log("✅ Task refreshed successfully");
            } catch (error) {
              console.error("❌ Error refreshing task:", error);
            }
          } else {
            console.log(
              "ℹ️ No refreshTask function provided, skipping refresh",
            );
          }

          // Close the form after successful creation and refresh
          console.log("🚪 Closing form automatically");
          handleCancel();
        } else {
          console.error("❌ API returned failure:", result);
          showErrorToast(result.message || "Failed to create subtask");
        }
      } catch (error) {
        console.error("❌ Exception caught in handleSubmit:", error);
        console.error("❌ Error stack:", error.stack);
        showErrorToast(error.message || "Failed to create subtask");
      } finally {
        console.log("🏁 Setting loading to false");
        setIsLoading(false);
      }
    } else if (mode === "edit") {
      console.log(
        "✏️ Edit mode - updating subtask first, then form attachment",
      );
      setIsLoading(true);

      try {
        // Get auth token
        const authToken = localStorage.getItem("authToken");
        const token = localStorage.getItem("token");
        const finalToken = authToken || token;

        if (!finalToken) {
          showErrorToast("Authentication token not found. Please login again.");
          return;
        }

        // Extract parent task ID
        let parentTaskId;
        if (typeof parentTask === "string") {
          parentTaskId = parentTask;
        } else if (parentTask?._doc?._id) {
          parentTaskId = parentTask._doc._id;
        } else if (parentTask?._doc?.id) {
          parentTaskId = parentTask._doc.id;
        } else if (parentTask?._id) {
          parentTaskId = parentTask._id;
        } else if (parentTask?.id) {
          parentTaskId = parentTask.id;
        }

        // Extract subtask ID
        const subtaskId = editData?._id || editData?.id;

        if (!parentTaskId || !subtaskId) {
          console.error("❌ Missing required IDs:", {
            parentTaskId,
            subtaskId,
          });
          showErrorToast("Missing required task IDs");
          return;
        }

        // STEP 1: First update the subtask via API
        console.log("📡 Step 1: Updating subtask via API...");

        // Map status values
        let mappedStatus;
        const statusValue = formData.status?.toLowerCase() || "";
        switch (statusValue) {
          case "open":
            mappedStatus = "OPEN";
            break;
          case "in progress":
          case "inprogress":
          case "in-progress":
            mappedStatus = "INPROGRESS";
            break;
          case "on hold":
          case "onhold":
          case "on-hold":
          case "review":
            mappedStatus = "ONHOLD";
            break;
          case "completed":
          case "done":
            mappedStatus = "DONE";
            break;
          case "cancelled":
          case "canceled":
            mappedStatus = "CANCELLED";
            break;
          default:
            if (
              ["OPEN", "INPROGRESS", "ONHOLD", "DONE", "CANCELLED"].includes(
                formData.status,
              )
            ) {
              mappedStatus = formData.status;
            } else {
              mappedStatus = "OPEN";
            }
        }

        // Prepare FormData for update (supports both JSON fields and file uploads)
        const updateFormData = new FormData();
        updateFormData.append("title", formData.title);
        updateFormData.append("description", formData.description || "");
        updateFormData.append(
          "assignee",
          typeof formData.assignee === "object"
            ? formData.assignee.value
            : formData.assignee,
        );
        updateFormData.append("status", mappedStatus);
        updateFormData.append(
          "priority",
          formData.priority
            ?.toLowerCase()
            .replace(" priority", "")
            .replace(" ", "-"),
        );
        updateFormData.append("dueDate", inputDateToLocalIso(formData.dueDate));
        updateFormData.append("visibility", formData.visibility);
        (formData.tags || []).forEach((tag) =>
          updateFormData.append("tags", tag),
        );

        console.log("📎 [EDIT] Processing attachments for update...");
        // Handle new file uploads
        if (formData.attachments && formData.attachments.length > 0) {
          console.log(
            "📎 [EDIT] Total attachments:",
            formData.attachments.length,
          );
          formData.attachments.forEach((fileObj, index) => {
            if (fileObj.file) {
              // New file - append the actual File object
              updateFormData.append("attachments", fileObj.file);
              console.log(`✅ Added new file ${index + 1}:`, fileObj.name);
            } else if (fileObj.isExisting && fileObj.url) {
              // Existing file - append URL to keep it
              updateFormData.append("existingAttachments", fileObj.url);
              console.log(
                `✅ Keeping existing file ${index + 1}:`,
                fileObj.name,
              );
            }
          });
        }

        console.log("📤 Update FormData prepared");

        const updateResponse = await fetch(
          `/api/tasks/${parentTaskId}/subtasks/${subtaskId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${finalToken}`,
              // Let browser set Content-Type with boundary for FormData
            },
            body: updateFormData,
          },
        );

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          console.error("❌ Subtask update failed:", errorText);
          throw new Error(`Failed to update subtask: ${updateResponse.status}`);
        }

        const updateResult = await updateResponse.json();
        console.log("✅ Subtask updated successfully:", updateResult);

        // STEP 2: Now attach form if there's a pending attachment
        if (pendingFormAttachment) {
          console.log(
            "📎 Step 2: Attaching pending form after subtask update...",
          );
          try {
            const attachResponse = await fetch(
              `/api/forms/${pendingFormAttachment.form_id}/attach-to-subtask`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${finalToken}`,
                },
                body: JSON.stringify({
                  subtask_id: subtaskId,
                  form_version_id: pendingFormAttachment.version_id || null,
                }),
              },
            );

            if (attachResponse.ok) {
              const attachResult = await attachResponse.json();
              console.log("✅ Form attached successfully:", attachResult);
              showSuccessToast("Subtask updated & form attached");
            } else {
              const attachError = await attachResponse.json();
              console.error("❌ Failed to attach form:", attachError);
              showErrorToast(attachError.message || "Failed to attach form");
            }
          } catch (attachError) {
            console.error("❌ Error attaching form:", attachError);
            showErrorToast(attachError.message || "Failed to attach form");
          }
        } else {
          // ✅ FIX: Show single success toast when no form attachment is pending
          showSuccessToast("Subtask updated");
        }

        // Dispatch event for other components to update
        console.log("📡 Dispatching subtaskUpdate event for UI refresh...");
        window.dispatchEvent(
          new CustomEvent("subtaskUpdate", {
            detail: { parentTaskId, subtaskId, formData, alreadyUpdated: true },
          }),
        );

        // Invalidate tasks query to update UI instantly
        queryClient.invalidateQueries({ queryKey: ["allTasks"] });


        // Refresh parent task to fetch updated subtask data
        if (typeof refreshTask === "function") {
          console.log("🔄 Refreshing parent task after subtask edit...");
          try {
            await refreshTask();
            console.log("✅ Task refreshed successfully after subtask edit");
          } catch (refreshError) {
            console.error(
              "❌ Error refreshing task after subtask edit:",
              refreshError,
            );
          }
        }

        // Close the form after successful update
        handleCancel();
      } catch (error) {
        console.error("❌ Error in edit mode:", error);
        showErrorToast(error.message || "Failed to update subtask");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const validateForm = () => {
    console.log("🔍 validateForm called");
    console.log("📝 Validating formData:", formData);

    const newErrors = {};

    // Title validation - only check max length, not required
    if (formData.title && formData.title.length > 60) {
      console.log("❌ Title validation failed: too long");
      newErrors.title = "Sub-task name cannot exceed 60 characters";
    } else {
      console.log("✅ Title validation passed");
    }

    // Assignee validation - handle object format from AssigneeSearchSelect
    if (
      !formData.assignee ||
      (typeof formData.assignee === "object" && !formData.assignee.value)
    ) {
      console.log("❌ Assignee validation failed: required field");
      newErrors.assignee = "Assignee is required";
    } else {
      console.log("✅ Assignee validation passed");
    }

    // Due date validation
    // if (formData.dueDate) {
    //   const today = new Date().toISOString().split('T')[0];
    //   const parentDueDate = parentTask?.dueDate ? new Date(parentTask.dueDate).toISOString().split('T')[0] : null;

    //   if (formData.dueDate < today) {
    //     console.log('❌ Due date validation failed: cannot be in the past');
    //     newErrors.dueDate = 'Due date cannot be in the past';
    //   } else if (parentDueDate && formData.dueDate > parentDueDate) {
    //     console.log('❌ Due date validation failed: cannot be after parent task due date');
    //     newErrors.dueDate = `Due date cannot be after parent task due date (${parentDueDate})`;
    //   } else {
    //     console.log('✅ Due date validation passed');
    //   }
    // } else {
    //   console.log('✅ Due date validation passed (not required)');
    // }

    // ✅ Due date validation (local timezone safe)
    if (formData.dueDate) {
      const [y, m, d] = formData.dueDate.split("-").map(Number);
      const selected = new Date(y, m - 1, d); // local midnight of selected date
      const todayLocal = new Date();
      todayLocal.setHours(0, 0, 0, 0);

      if (selected < todayLocal) {
        console.log("❌ Due date validation failed: cannot be in the past");
        newErrors.dueDate = "Due date cannot be in the past";
      } else if (parentTask?.dueDate) {
        const parentDate = new Date(parentTask.dueDate);
        parentDate.setHours(0, 0, 0, 0);

        if (selected > parentDate) {
          console.log(
            "❌ Due date validation failed: cannot be after parent task due date",
          );
          newErrors.dueDate = `Due date cannot be after parent task due date (${formatDateToInput(parentTask.dueDate)})`;
        } else {
          console.log("✅ Due date validation passed");
        }
      } else {
        console.log("✅ Due date validation passed");
      }
    } else {
      console.log("✅ Due date validation passed (not required)");
    }

    console.log("📋 Final validation errors:", newErrors);
    return newErrors;
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Track if user manually changes the due date
    if (field === "dueDate") {
      setIsDueDateManuallySet(true);
    }

    // Clear error dynamically when user types/selects
    if (errors[field]) {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  const processAttachmentFiles = (files) => {
    const incomingFiles = Array.from(files || []);
    if (incomingFiles.length === 0) return;

    const currentSize = formData.attachments.reduce(
      (sum, f) => sum + (f.size || 0),
      0,
    );
    const incomingSize = incomingFiles.reduce(
      (sum, file) => sum + file.size,
      0,
    );

    if (currentSize + incomingSize > 5 * 1024 * 1024) {
      setErrors({
        ...errors,
        attachments: "File too large! Max 5MB total",
      });
      return;
    }

    const newAttachments = incomingFiles.map((file) => ({
      id: `file-${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      file,
    }));

    setFormData((prev) => ({
      ...prev,
      attachments: [...prev.attachments, ...newAttachments],
    }));
  };

  const handleAttachmentsDragOver = (event) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleAttachmentsDragLeave = (event) => {
    event.preventDefault();
    setIsDragActive(false);
  };

  const handleAttachmentsDrop = (event) => {
    event.preventDefault();
    setIsDragActive(false);
    processAttachmentFiles(event.dataTransfer?.files);
  };
  const handleCancel = () => {
    setFormData({
      title: "",
      assignee: isOrgUser ? null : { value: "self", label: "Self" }, // Object format for AssigneeSearchSelect
      dueDate: parentTask?.dueDate ? formatDateToInput(parentTask.dueDate) : "",
      priority: getDefaultPriorityCode(taskPriorities),
      status: "OPEN",
      visibility: parentTask?.visibility || "Private",
      description: "",
      attachments: [],
    });
    setErrors({});
    setIsLoading(false);
    setPendingFormAttachment(null); // Reset pending form attachment
    setAttachedForm(null); // Reset attached form display
    onClose();
  };
  // Control body scroll when modal opens
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("modal-open");
      return () => {
        document.body.classList.remove("modal-open");
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay">
        <div className="modal-container subtask-form-square max-w-2xl">
          {/* Header */}
          <div className="modal-header" style={{ background: "#4f46e5" }}>
            <div className="modal-title-section">
              <div className="modal-icon">
                <Plus size={16} />
              </div>
              <div>
                <h3>{mode === "edit" ? "Edit Sub-task" : "Add Sub-tasks"}</h3>
                <p
                  className="truncate max-w-[250px] "
                  title={`+ Parent: ${parentTask?.title || "Unknown"}`}
                >
                  + Parent: {parentTask?.title || "Unknown"}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:text-gray-700"
              onClick={onClose}
            >
              <X size={20} />
            </Button>
          </div>

          {/* Form */}
          <div className="modal-body">
            <div className="form-card">
              <form onSubmit={handleSubmit} className="space-y-0">
                {/* Task Title */}
                <div className="form-group">
                  <label className="form-label flex justify-between">
                    <div>
                      <Tag size={16} />
                      Task Title
                    </div>
                    <span className="text-gray-500">
                      {formData.title.length}/60
                    </span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleChange("title", e.target.value)}
                    placeholder="Sub-task title"
                    className={`form-input ${errors.title ? "border-red-500 focus:border-red-500" : ""}`}
                    maxLength={60}
                    autoFocus
                  />
                  {errors.title && (
                    <div className="flex items-center gap-2 text-red-500 text-sm mt-1">
                      <AlertCircle size={16} />
                      <span>{errors.title}</span>
                    </div>
                  )}
                </div>

                {/* Row 1: Assignee & Priority */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      <User size={16} />
                      Assignee <span className="text-red-500">*</span>
                    </label>
                    <AssigneeSearchSelect
                      value={formData.assignee}
                      onChange={(value) => handleChange("assignee", value)}
                      className="react-select-container react-select--small whitespace-nowrap"
                      isDisabled={!isOrgUser}
                      placeholder={
                        isOrgUser ? "Search and select assignee..." : "Self"
                      }
                      required={isOrgUser}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Search by name, email, department, or designation
                    </p>
                    {errors.assignee && (
                      <div className="flex items-center gap-2 text-red-500 text-sm mt-1">
                        <AlertCircle size={16} />
                        <span>{errors.assignee}</span>
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      <AlertCircle size={16} />
                      Priority
                    </label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) =>
                        setFormData({ ...formData, priority: value })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {priorityOptions.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 2: Due Date & Status */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      <Calendar size={16} />
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      min={formatDateToInput(new Date())}
                      max={
                        parentTask?.dueDate
                          ? formatDateToInput(new Date(parentTask.dueDate))
                          : undefined
                      }
                      // min={new Date().toISOString().split('T')[0]}
                      // max={parentTask?.dueDate ? new Date(parentTask.dueDate).toISOString().split('T')[0] : undefined}
                      onChange={(e) => handleChange("dueDate", e.target.value)}
                      className={`form-input ${errors.dueDate ? "border-red-500 focus:border-red-500" : ""}`}
                    />
                    {errors.dueDate && (
                      <div className="flex items-center gap-2 text-red-500 text-sm mt-1">
                        <AlertCircle size={16} />
                        <span>{errors.dueDate}</span>
                      </div>
                    )}
                    {!errors.dueDate && parentTask?.dueDate && (
                      <div className="text-xs text-gray-500 mt-1">
                        Parent task due: {formatDateToInput(parentTask.dueDate)}
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) =>
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {getValidStatusOptions().map((s) => (
                          <SelectItem key={s._id || s.code} value={s.code}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Visibility */}
                <div className="form-group">
                  <label className="form-label">
                    Visibility
                    {!isOrgUser && (
                      <span className="text-xs text-gray-500 ml-2">
                        (Defaults from parent)
                      </span>
                    )}
                  </label>
                  <select
                    value={formData.visibility}
                    onChange={(e) =>
                      setFormData({ ...formData, visibility: e.target.value })
                    }
                    className="form-select"
                    disabled={!isOrgUser}
                  >
                    <option value="Private">Private</option>
                    <option value="Public">Public</option>
                  </select>
                  {!isOrgUser && (
                    <p className="text-xs text-gray-500 mt-1">
                      Only company users can override visibility
                    </p>
                  )}
                </div>

                {/* Tags */}
                <div className="form-group">
                  <label className="form-label">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                    Labels / Tags
                    {mode === "create" &&
                      parentTask?.tags &&
                      parentTask.tags.length > 0 && (
                        <span className="text-xs text-gray-500 ml-2">
                          (Inherited from parent)
                        </span>
                      )}
                  </label>
                  <div className="space-y-2">
                    {/* Tag Input */}
                    <div className="relative">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            const trimmedTag = tagInput.trim();
                            if (
                              trimmedTag &&
                              !formData.tags.includes(trimmedTag)
                            ) {
                              setFormData({
                                ...formData,
                                tags: [...formData.tags, trimmedTag],
                              });
                              setTagInput("");
                            }
                          }
                        }}
                        placeholder="Type tag and press Enter or comma..."
                        className="w-full h-8 min-h-8 max-h-8 box-border px-3 pr-10 py-0 border border-gray-300 rounded-none text-sm leading-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          const trimmedTag = tagInput.trim();
                          if (
                            trimmedTag &&
                            !formData.tags.includes(trimmedTag)
                          ) {
                            setFormData({
                              ...formData,
                              tags: [...formData.tags, trimmedTag],
                            });
                            setTagInput("");
                          }
                        }}
                        variant="primary"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        title="Add tag"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                      </Button>
                    </div>

                    {/* Tags Display */}
                    {formData.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded-none border border-gray-200">
                        {formData.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-none text-xs font-medium bg-indigo-100 text-indigo-800"
                          >
                            {tag}
                            <Button
                              type="button"
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  tags: formData.tags.filter(
                                    (_, i) => i !== index,
                                  ),
                                });
                              }}
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 p-0 hover:text-indigo-900"
                            >
                              ×
                            </Button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <CustomEditor
                    value={formData.description}
                    onChange={(content) =>
                      setFormData({ ...formData, description: content })
                    }
                    placeholder="Add notes or description... (supports rich text)"
                    className="w-full border"
                  />
                  <div className="form-hint">
                    Use Tab to navigate fields, Enter to submit form
                  </div>
                </div>

                {/* Attachments */}
                <div style={{ marginBottom: "20px" }}>
                  <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-1">
                    Attachments
                    <span className="text-xs text-gray-500 ml-2">
                      (Max 5MB total)
                    </span>
                  </label>
                  <div
                    className={`w-full border-2 border-dashed p-4 text-center cursor-pointer transition-colors rounded-none ${isDragActive ? "border-blue-500 bg-blue-50" : "border-blue-300 bg-white"}`}
                    onDragOver={handleAttachmentsDragOver}
                    onDragLeave={handleAttachmentsDragLeave}
                    onDrop={handleAttachmentsDrop}
                    onClick={() => attachmentsInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        attachmentsInputRef.current?.click();
                      }
                    }}
                    data-testid="dropzone-attachments"
                  >
                    <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center bg-blue-100 text-blue-600 rounded-none">
                      +
                    </div>
                    <p className="text-sm font-semibold text-blue-600">
                      Drag & Drop files
                    </p>
                    <p className="text-xs text-gray-500">
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
                    data-testid="input-attachments"
                  />

                  {/* File List */}
                  {formData.attachments && formData.attachments.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {formData.attachments.map((file) => (
                        <div
                          key={file.id}
                          className={`flex items-center justify-between px-3 py-2 rounded-none border ${
                            file.isExisting
                              ? "bg-green-50 border-green-200"
                              : "bg-gray-50 border-gray-200"
                          }`}
                        >
                          <div className="flex items-center space-x-2 flex-1">
                            <svg
                              className={`w-4 h-4 ${file.isExisting ? "text-green-600" : "text-gray-500"}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            <div className="flex-1">
                              <span
                                className={`text-sm ${file.isExisting ? "text-green-700 font-medium" : "text-gray-700"}`}
                              >
                                {file.name}
                              </span>
                              {file.size > 0 && (
                                <span className="text-xs text-gray-500">
                                  {" "}
                                  ({(file.size / 1024).toFixed(2)} KB)
                                </span>
                              )}
                              {file.isExisting && (
                                <span className="ml-2 inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-none">
                                  Existing
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                attachments: prev.attachments.filter(
                                  (f) => f.id !== file.id,
                                ),
                              }));
                            }}
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-700"
                            title={
                              file.isExisting
                                ? "Remove this attachment"
                                : "Remove this file"
                            }
                            data-testid={`remove-file-${file.id}`}
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </Button>
                        </div>
                      ))}
                      <div className="text-xs text-gray-500">
                        Total size:{" "}
                        {formData.attachments.reduce(
                          (sum, f) => sum + (f.size || 0),
                          0,
                        ) > 0
                          ? `${(formData.attachments.reduce((sum, f) => sum + (f.size || 0), 0) / 1024 / 1024).toFixed(2)} MB`
                          : "0 MB"}{" "}
                        / 5MB
                      </div>
                    </div>
                  )}
                </div>

                {/* Form Attachment - Phase I */}
                {/* {mode === 'edit' && ( */}
                <div className="form-group">
                  <label className="form-label">
                    <FileText size={16} />
                    Form Attachment
                    {pendingFormAttachment && (
                      <span className="text-xs text-blue-500 ml-2">
                        {mode === "create"
                          ? "(Will be attached after creation)"
                          : "(Will be attached on save)"}
                      </span>
                    )}
                  </label>
                  {/* Show pending form in create/edit mode */}
                  {pendingFormAttachment ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-none p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4 text-yellow-600" />
                            <span className="font-medium text-sm text-gray-900">
                              {pendingFormAttachment.form_title ||
                                "Selected Form"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">
                            Version:{" "}
                            {pendingFormAttachment.version_number || "Latest"}{" "}
                            (Pending)
                          </p>
                          <p className="text-xs text-yellow-600 mt-1">
                            ⏳{" "}
                            {mode === "create"
                              ? "Form will be attached after subtask is created"
                              : "Form will be attached when you save changes"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          onClick={() => {
                            setPendingFormAttachment(null);
                            showSuccessToast("Form selection removed");
                          }}
                          variant="ghost"
                          className="text-red-600 hover:text-red-800 text-sm font-medium h-auto p-0"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : attachedForm ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-none p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <span className="font-medium text-sm text-gray-900">
                              {attachedForm.form_title || "Attached Form"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">
                            Version: {attachedForm.version_number || "N/A"}{" "}
                            (Locked)
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs">
                            <a
                              href={`/forms/preview/${attachedForm.form_id}?version=${attachedForm.version_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <FileText className="h-3 w-3" />
                              Preview Form
                            </a>
                            {attachedForm.submission_count > 0 && (
                              <span className="text-gray-500">
                                {attachedForm.submission_count} submission
                                {attachedForm.submission_count !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          onClick={() => {
                            if (attachedForm.submission_count > 0) {
                              showErrorToast(
                                "Cannot unlink form - it has already been submitted. Submissions are kept as read-only history.",
                              );
                            } else {
                              setShowUnlinkConfirm(true);
                            }
                          }}
                          variant="ghost"
                          className="text-red-600 hover:text-red-800 text-sm font-medium h-auto p-0"
                          disabled={attachedForm.submission_count > 0}
                        >
                          {attachedForm.submission_count > 0
                            ? "Cannot Unlink"
                            : "Unlink"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => setShowFormAttachModal(true)}
                      variant="outline"
                      className="w-full border-2 border-dashed border-gray-300 rounded-none p-4 hover:border-blue-400 hover:bg-blue-50 flex items-center justify-center gap-2 text-gray-600 hover:text-blue-600 h-auto"
                    >
                      <Link2 size={18} />
                      <span className="font-medium">Attach a Form</span>
                    </Button>
                  )}
                </div>
                {/* )} */}

                {/* Actions */}
                <div className="form-actions flex justify-between">
                  <Button
                    type="button"
                    onClick={handleCancel}
                    variant="outline"
                    className="h-8"
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    className="h-8"
                    disabled={isLoading}
                  >
                    {isLoading
                      ? "Creating..."
                      : mode === "edit"
                        ? "Update Sub-task"
                        : "Create Sub-task"}
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {/* Form Attach Modal */}
          {showFormAttachModal && (
            <FormAttachModal
              open={showFormAttachModal}
              onClose={(refresh, selectedFormData) => {
                setShowFormAttachModal(false);

                // In both create and edit mode, store the form selection for later attachment
                if (selectedFormData) {
                  console.log(
                    "📎 Storing pending form attachment:",
                    selectedFormData,
                  );
                  setPendingFormAttachment(selectedFormData);
                  if (mode === "create") {
                    showSuccessToast(
                      "Form selected - will be attached after subtask is created",
                    );
                  } else {
                    showSuccessToast(
                      "Form selected - will be attached when you save changes",
                    );
                  }
                } else if (refresh && mode === "edit") {
                  // Legacy: In edit mode, the form was attached via API (for backwards compatibility)
                  showSuccessToast("Form attached");
                }
              }}
              taskId={parentTask?._id}
              subtaskId={mode === "edit" ? editData?._id || null : null} // null in create mode
              subtaskName={formData.title}
              pendingMode={true} // Always use pending mode - form will be attached after subtask create/update
            />
          )}
        </div>
      </div>

      {/* Unlink Form Confirmation Dialog - High z-index ensures visibility above modal */}
      <ConfirmDialog
        isOpen={showUnlinkConfirm}
        title="Unlink Form?"
        description="Remove this form attachment? This will unlink the form from this subtask."
        confirmLabel="Unlink"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        onCancel={() => setShowUnlinkConfirm(false)}
        onConfirm={async () => {
          setShowUnlinkConfirm(false);
          try {
            const token = localStorage.getItem("token");
            const subtaskId = editData?._id || editData?.id;
            await unlinkFormFromSubtask(attachedForm.form_id, subtaskId, token);
            setAttachedForm(null);
            showSuccessToast("Form unlinked");
          } catch (error) {
            console.error("Error unlinking form:", error);
            showErrorToast(error.message || "Failed to unlink form");
          }
        }}
      />
    </>
  );
}

export default SubtaskForm;
