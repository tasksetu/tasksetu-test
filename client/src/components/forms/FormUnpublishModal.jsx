import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, XCircle, AlertCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useShowToast } from "../../utils/ToastMessage";

/**
 * FormUnpublishModal - Modal for unpublishing forms with validation
 *
 * Handles unpublish operation (PUBLISHED → DRAFT) with:
 * - Reason input (required for audit trail)
 * - Active dependency blocking
 * - Force unpublish option (Owner/Admin only)
 * - Comprehensive warnings and confirmation
 */
export default function FormUnpublishModal({
  open,
  onClose,
  formId,
  formTitle,
  formStatus,
}) {
  const { showSuccessToast, showErrorToast, showWarningToast } = useShowToast();
  const queryClient = useQueryClient();
  const token = localStorage.getItem("token");

  const [reason, setReason] = useState("");
  const [force, setForce] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [blockingDetails, setBlockingDetails] = useState(null);

  // Unpublish mutation
  const unpublishMutation = useMutation({
    mutationFn: async ({ formId, reason, force }) => {
      const response = await fetch(`/api/forms/${formId}/unpublish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason, force }),
      });

      const data = await response.json();

      // Handle blocking response (409)
      if (response.status === 409) {
        setBlockingDetails(data);
        throw new Error(
          data.message || "Cannot unpublish form due to active dependencies",
        );
      }

      if (!response.ok) {
        throw new Error(data.message || "Failed to unpublish form");
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(["forms"]);
      queryClient.invalidateQueries(["form", formId]);

      const message = data.forced
        ? `⚠️ Form force-unpublished! Status: DRAFT. Warning: ${data.data.active_usage_count} active dependencies remain.`
        : "Form unpublished successfully. Status changed to DRAFT.";

      if (data.warnings?.length > 0) {
        showWarningToast(message);
      } else {
        showSuccessToast(message);
      }

      handleClose(true);
    },
    onError: (error) => {
      // If blocking details are set, don't show error toast (modal will show blocking UI)
      if (!blockingDetails) {
        showErrorToast(error.message || "Failed to unpublish form");
      }
    },
  });

  const handleUnpublish = () => {
    // Validation
    if (!reason.trim()) {
      showErrorToast(
        "Please provide a reason for unpublishing (required for audit trail)",
      );
      return;
    }

    // Force unpublish requires confirmation
    if (force && confirmText !== "FORCE UNPUBLISH") {
      showErrorToast('Please type "FORCE UNPUBLISH" to confirm');
      return;
    }

    unpublishMutation.mutate({ formId, reason, force });
  };

  const handleClose = (published) => {
    setReason("");
    setForce(false);
    setConfirmText("");
    setBlockingDetails(null);
    onClose(published);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 border-50 border-red-500">
      <div className="w-full max-w-2xl rounded-sm bg-white p-4 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-orange-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Unpublish Form
              </h2>
              <p className="text-sm text-gray-600 mt-1">{formTitle}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleClose(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <XCircle className="h-5 w-5" />
          </Button>
        </div>

        {/* Blocking Dependencies Warning */}
        {blockingDetails && (
          <div className="mb-3 rounded-sm border-2 border-red-500 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900">
                  Cannot Unpublish - Active Dependencies Found
                </h3>
                <p className="text-sm text-red-700 mt-2">
                  {blockingDetails.message}
                </p>

                {/* Dependency Details */}
                <div className="mt-4 space-y-2">
                  {blockingDetails.details?.active_usage_count > 0 && (
                    <div className="bg-white rounded p-3 border border-red-200">
                      <p className="font-medium text-sm text-red-900">
                        Active Attachments:{" "}
                        {blockingDetails.details.active_usage_count}
                      </p>
                      {blockingDetails.details.dependencies?.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-gray-700">
                          {blockingDetails.details.dependencies.map(
                            (dep, idx) => (
                              <li key={idx} className="flex items-center gap-2">
                                <span className="text-gray-400">•</span>
                                <span>
                                  {dep.type === "TASK" ? "Task" : "Subtask"}:{" "}
                                  {dep.task_title || dep.subtask_title}
                                  <span className="text-gray-500 ml-2">
                                    ({dep.task_status || dep.subtask_status})
                                  </span>
                                </span>
                              </li>
                            ),
                          )}
                        </ul>
                      )}
                    </div>
                  )}

                  {blockingDetails.details?.pending_submissions_count > 0 && (
                    <div className="bg-white rounded p-3 border border-red-200">
                      <p className="font-medium text-sm text-red-900">
                        Pending Submissions:{" "}
                        {blockingDetails.details.pending_submissions_count}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Wait for submissions to complete before unpublishing
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 text-sm text-red-800">
                  <p className="font-medium mb-2">Recommended Actions:</p>
                  <ul className="space-y-1 ml-4">
                    {blockingDetails.actions?.map((action, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-red-400">→</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Force Option */}
                <div className="mt-4 pt-4 border-t border-red-200">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={force}
                      onChange={(e) => setForce(e.target.checked)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-red-900">
                        Force Unpublish (Requires Owner/Admin)
                      </span>
                      <p className="text-xs text-red-700 mt-1">
                        ⚠️ WARNING: This will unpublish the form even with
                        active dependencies. Users may experience issues with
                        linked tasks. This action is heavily audited.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Warning Message */}
        {!blockingDetails && (
          <div className="mb-3 rounded-sm border border-orange-300 bg-orange-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900">
                  Important: Unpublishing will change form status to DRAFT
                </h3>
                <ul className="mt-2 space-y-1 text-sm text-orange-800">
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400">•</span>
                    <span>
                      Form will no longer be attachable to new tasks/subtasks
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400">•</span>
                    <span>
                      External submission URL will be disabled (if enabled)
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400">•</span>
                    <span>New form submissions will be blocked</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400">•</span>
                    <span>This action will be logged in the audit trail</span>
                  </li>
                </ul>
                <p className="mt-3 text-sm text-orange-900 font-medium">
                  💡 Consider using Archive instead if you want to preserve the
                  form for historical purposes while preventing new attachments.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Reason Input */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason for Unpublishing <span className="text-red-500">*</span>
          </label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why you are unpublishing this form (required for audit trail)..."
            className="min-h-[100px]"
            maxLength={500}
          />
          <p className="mt-1 text-xs text-gray-500">
            {reason.length}/500 characters
          </p>
        </div>

        {/* Force Unpublish Confirmation */}
        {force && (
          <div className="mb-3 rounded-sm border-2 border-red-500 bg-red-50 p-4">
            <label className="block text-sm font-medium text-red-900 mb-2">
              Type "FORCE UNPUBLISH" to confirm{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="FORCE UNPUBLISH"
              className="w-full h-9 px-3 border border-red-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
            <p className="mt-2 text-xs text-red-700">
              ⚠️ You are about to force-unpublish a form with active
              dependencies. This may cause issues for users.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            className="h-9"
            onClick={() => handleClose(false)}
            disabled={unpublishMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUnpublish}
            disabled={
              unpublishMutation.isPending ||
              !reason.trim() ||
              (force && confirmText !== "FORCE UNPUBLISH")
            }
            className={`h-9 ${force ? "bg-red-600 hover:bg-red-700" : "bg-orange-600 hover:bg-orange-700"}`}
          >
            {unpublishMutation.isPending
              ? "Unpublishing..."
              : force
                ? "Force Unpublish"
                : "Unpublish Form"}
          </Button>
        </div>
      </div>
    </div>
  );
}
