import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FileText, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useShowToast } from "../../utils/ToastMessage";

/**
 * Form Attach Modal (Phase I)
 * Attaches a published form version to a subtask
 * - Shows only PUBLISHED forms
 * - Displays form metadata (version, preview link, last used, submission count)
 * - Version locking: locks specific version to subtask
 * - One form per subtask enforcement
 * - Permission-based attach (Owner, Company Admin only)
 * - pendingMode: If true, don't call API, just return selected form data
 */
const FormAttachModal = ({
  open,
  onClose,
  taskId,
  subtaskId,
  subtaskName,
  pendingMode = false,
}) => {
  const { showSuccessToast, showErrorToast } = useShowToast();
  const queryClient = useQueryClient();
  const token = localStorage.getItem("token");

  const [selectedFormId, setSelectedFormId] = useState(null);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [existingForm, setExistingForm] = useState(null);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [versionRestricted, setVersionRestricted] = useState(false);

  // Fetch published forms
  const { data: formsData, isLoading: formsLoading } = useQuery({
    queryKey: ["publishedForms"],
    queryFn: async () => {
      const response = await fetch("/api/forms?status=PUBLISHED", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch published forms");
      }

      return response.json();
    },
    enabled: open,
  });

  // Check if subtask already has a form attached
  const { data: subtaskData } = useQuery({
    queryKey: ["subtask", subtaskId],
    queryFn: async () => {
      const response = await fetch(`/api/tasks/${subtaskId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch subtask details");
      }

      return response.json();
    },
    enabled: open && !!subtaskId,
    onSuccess: (data) => {
      // Check if subtask has attached forms
      const task = data?.data?.task;
      if (task?.attachedForms && task.attachedForms.length > 0) {
        const activeForm = task.attachedForms.find(
          (f) => f.status === "ACTIVE",
        );
        if (activeForm) {
          setExistingForm(activeForm);
        }
      }
    },
  });

  // Fetch versions when form is selected
  const { data: versionsData, isLoading: versionsLoading } = useQuery({
    queryKey: ["formVersions", selectedFormId],
    queryFn: async () => {
      const response = await fetch(`/api/forms/${selectedFormId}/versions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch form versions");
      }

      return response.json();
    },
    enabled: !!selectedFormId,
  });

  // Auto-select latest version when versions are loaded
  useEffect(() => {
    const restricted = versionsData?.data?.restricted;
    setVersionRestricted(Boolean(restricted));

    // If restricted, still allow attachment with form ID (no version lock needed)
    // User can attach form without specific version
    if (restricted) {
      return;
    }

    const versions = versionsData?.data?.versions || [];
    if (versions.length > 0 && !selectedVersionId) {
      const latestVersion = versions.reduce((latest, current) => {
        return current.version_number > latest.version_number
          ? current
          : latest;
      });
      setSelectedVersionId(latestVersion._id);
    }
  }, [versionsData, selectedVersionId]);

  // Attach form mutation
  const attachMutation = useMutation({
    mutationFn: async (attachData) => {
      const response = await fetch(
        `/api/forms/${selectedFormId}/attach-to-subtask`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(attachData),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to attach form");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(["task", taskId]);
      queryClient.invalidateQueries(["subtasks", taskId]);
      queryClient.invalidateQueries(["subtask", subtaskId]);

      showSuccessToast(
        `Form "${data.data?.form?.name || "Form"}" attached successfully`,
      );
      handleClose(true);
    },
    onError: (error) => {
      showErrorToast(error.message || "Failed to attach form");
    },
  });

  // Unlink existing form mutation
  const unlinkMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/forms/${existingForm.form_version_id}/unlink-from-subtask/${subtaskId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to unlink existing form");
      }

      return response.json();
    },
    onSuccess: () => {
      // After unlinking, proceed with attaching new form
      setExistingForm(null);
      setShowReplaceConfirm(false);
      handleAttach();
    },
    onError: (error) => {
      showErrorToast(error.message || "Failed to unlink existing form");
    },
  });

  const handleAttach = () => {
    if (!selectedFormId) {
      showErrorToast("Please select a form");
      return;
    }

    // In pending mode (create subtask), just return the form data without API call
    if (pendingMode) {
      const selectedForm = forms.find(
        (f) => f._id === selectedFormId || f.form_id === selectedFormId,
      );
      const selectedVersion = versions.find((v) => v._id === selectedVersionId);

      const formData = {
        form_id: selectedFormId,
        version_id: selectedVersionId || null,
        form_title: selectedForm?.title || "Selected Form",
        version_number: selectedVersion?.version_number || "Latest",
      };

      console.log("📎 Pending mode - returning form data:", formData);
      handleClose(true, formData); // Pass form data back
      return;
    }

    // Normal mode - make API call
    const attachData = {
      subtask_id: subtaskId,
      form_version_id: selectedVersionId || null, // null means use latest version
    };

    attachMutation.mutate(attachData);
  };

  const handleClose = (refresh = false, formData = null) => {
    setSelectedFormId(null);
    setSelectedVersionId(null);
    onClose?.(refresh, formData);
  };

  const forms = formsData?.data?.forms || [];
  const versions = versionsData?.data?.versions || [];

  return (
    <Dialog open={open} onOpenChange={() => handleClose(false)}>
      <DialogContent className="sm:max-w-[550px] bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            {pendingMode ? "Select Form to Attach" : "Attach Form to Subtask"}
          </DialogTitle>
          <DialogDescription>
            {pendingMode ? (
              <span className="text-sm text-yellow-600">
                ⏳ Form will be attached after subtask is created
              </span>
            ) : (
              subtaskName && (
                <span className="text-sm text-gray-600">
                  Attaching form to:{" "}
                  <span className="font-medium">{subtaskName}</span>
                </span>
              )
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {/* Form Selection */}
          <div className="space-y-2">
            <Label htmlFor="form-select">Select Form</Label>
            {formsLoading ? (
              <div className="text-sm text-gray-500">Loading forms...</div>
            ) : forms.length === 0 ? (
              <div className="p-3 border rounded-sm bg-yellow-50 border-yellow-200 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-800">
                  No published forms available. Please publish a form first.
                </div>
              </div>
            ) : (
              <Select
                value={selectedFormId}
                onValueChange={(value) => {
                  setSelectedFormId(value);
                  setSelectedVersionId(null); // Reset version when form changes
                }}
              >
                <SelectTrigger id="form-select">
                  <SelectValue placeholder="Choose a form..." />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="max-h-[200px] overflow-y-auto"
                >
                  {forms.map((form) => (
                    <SelectItem key={form._id} value={form._id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{form.title}</span>
                        {form.description && (
                          <span className="text-xs text-gray-500 truncate max-w-[300px]">
                            {form.description}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Version Display - Show restricted message or version details */}
          {selectedFormId &&
            (versionRestricted ? (
              <div className="p-3 border rounded-sm bg-yellow-50 border-yellow-200 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">Restricted Form</p>
                  <p>
                    You don't have access to view versions of this form. The
                    latest available version will be used automatically.
                  </p>
                </div>
              </div>
            ) : selectedVersionId ? (
              <div className="space-y-2">
                <Label>Selected Version (Latest)</Label>
                {versionsLoading ? (
                  <div className="text-sm text-gray-500">
                    Loading version...
                  </div>
                ) : (
                  <div className="p-3 border rounded-sm bg-blue-50 border-blue-200">
                    {(() => {
                      const selectedVersion = versions.find(
                        (v) => v._id === selectedVersionId,
                      );
                      return selectedVersion ? (
                        <div className="flex flex-col space-y-1">
                          <span className="font-medium text-blue-900">
                            v{selectedVersion.version_number || "1.0"}
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                              Latest Version - Auto Selected
                            </span>
                          </span>
                          {selectedVersion.release_notes && (
                            <span className="text-xs text-blue-700">
                              {selectedVersion.release_notes.slice(0, 80)}
                              {selectedVersion.release_notes.length > 80
                                ? "..."
                                : ""}
                            </span>
                          )}
                          <span className="text-xs text-blue-600">
                            Published:{" "}
                            {new Date(
                              selectedVersion.published_at,
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">
                          Loading version details...
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>
            ) : null)}

          {/* Form Preview & Metadata - Phase I */}
          {selectedVersionId && (
            <div className="space-y-2 p-4 border rounded-sm bg-gray-50">
              <div className="text-sm font-medium text-gray-900 mb-2">
                Form Details
              </div>
              <div className="text-xs text-gray-600 space-y-1">
                <p>
                  <span className="font-medium">Version Lock:</span> This
                  specific version will be locked to the subtask
                </p>
                <p>
                  <span className="font-medium">Note:</span> Future template
                  edits won't affect this instance
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={attachMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAttach}
            disabled={attachMutation.isPending || !selectedFormId}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {attachMutation.isPending
              ? "Attaching..."
              : pendingMode
                ? "Select Form"
                : "Attach Form"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FormAttachModal;
