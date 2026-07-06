import React, { useState, useEffect } from "react";
import {
  FileText,
  Plus,
  Edit,
  Eye,
  Trash2,
  Loader,
  AlertCircle,
  Clock,
  CheckCircle,
} from "lucide-react";
import FormSubmissionModal from "../../components/forms/FormSubmissionModal";

/**
 * AttachedFormsTab - Tab to display all user's form submissions for a task
 *
 * Features:
 * - Shows all attached forms with user's submissions
 * - Allow creating new submissions
 * - Allow viewing/editing existing submissions
 * - Support for both task and subtask forms
 */
export default function AttachedFormsTab({ task, taskId, onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [formsWithSubmissions, setFormsWithSubmissions] = useState([]);
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedForm, setSelectedForm] = useState(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [viewOnly, setViewOnly] = useState(false);
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (task && taskId) {
      loadFormsAndSubmissions();
    }
  }, [task, taskId]);

  const loadFormsAndSubmissions = async () => {
    try {
      setLoading(true);
      const allForms = [];

      // Check if main task has attached form
      if (task.attached_form_version_id) {
        const formVersionId =
          typeof task.attached_form_version_id === "object"
            ? task.attached_form_version_id._id
            : task.attached_form_version_id;

        // Fetch form version details
        const versionResponse = await fetch(
          `/api/forms/versions/${formVersionId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        // If user is not authorized to view this form version, add a restricted placeholder
        if (versionResponse.status === 403) {
          allForms.push({
            taskId: taskId,
            taskTitle: task.title,
            isSubtask: false,
            formVersionId: formVersionId,
            formTitle: "Restricted Form (owner only)",
            formDescription: "",
            versionNumber: "N/A",
            publishedAt: null,
            submissions: [],
            restricted: true,
          });
        } else if (versionResponse.ok) {
          const versionData = await versionResponse.json();
          const formVersion = versionData.data?.version || versionData.data;

          // Fetch user's submissions for this form
          const params = new URLSearchParams({
            form_version_id: formVersionId,
            task_id: taskId,
          });

          const submissionsResponse = await fetch(
            `/api/forms/submissions/my-submissions?${params}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );

          let submissions = [];
          if (submissionsResponse.ok) {
            const submissionsData = await submissionsResponse.json();
            submissions = submissionsData.data?.submissions || [];
          }

          allForms.push({
            taskId: taskId,
            taskTitle: task.title,
            isSubtask: false,
            formVersionId: formVersionId,
            formTitle: formVersion.snapshot_data?.title || "Untitled Form",
            formDescription: formVersion.snapshot_data?.description || "",
            versionNumber: formVersion.version_number || "N/A",
            publishedAt: formVersion.published_at,
            submissions: submissions,
          });
        }
      }

      // Check subtasks for attached forms
      if (task.subtasks && task.subtasks.length > 0) {
        for (const subtask of task.subtasks) {
          if (subtask.attached_form_version_id) {
            const formVersionId =
              typeof subtask.attached_form_version_id === "object"
                ? subtask.attached_form_version_id._id
                : subtask.attached_form_version_id;

            const versionResponse = await fetch(
              `/api/forms/versions/${formVersionId}`,
              {
                headers: { Authorization: `Bearer ${token}` },
              },
            );

            if (versionResponse.status === 403) {
              allForms.push({
                taskId: subtask._id,
                taskTitle: subtask.title,
                isSubtask: true,
                formVersionId: formVersionId,
                formTitle: "Restricted Form (owner only)",
                formDescription: "",
                versionNumber: "N/A",
                publishedAt: null,
                submissions: [],
                restricted: true,
              });
            } else if (versionResponse.ok) {
              const versionData = await versionResponse.json();
              const formVersion = versionData.data?.version || versionData.data;

              const params = new URLSearchParams({
                form_version_id: formVersionId,
                subtask_id: subtask._id,
              });

              const submissionsResponse = await fetch(
                `/api/forms/submissions/my-submissions?${params}`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                },
              );

              let submissions = [];
              if (submissionsResponse.ok) {
                const submissionsData = await submissionsResponse.json();
                submissions = submissionsData.data?.submissions || [];
              }

              allForms.push({
                taskId: subtask._id,
                taskTitle: subtask.title,
                isSubtask: true,
                formVersionId: formVersionId,
                formTitle: formVersion.snapshot_data?.title || "Untitled Form",
                formDescription: formVersion.snapshot_data?.description || "",
                versionNumber: formVersion.version_number || "N/A",
                publishedAt: formVersion.published_at,
                submissions: submissions,
              });
            }
          }
        }
      }

      setFormsWithSubmissions(allForms);
    } catch (error) {
      console.error("Error loading forms and submissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewSubmission = (form) => {
    setSelectedForm(form);
    setSelectedSubmissionId(null); // No submission ID = new submission
    setShowFormModal(true);
  };

  const handleEditSubmission = (form, submissionId) => {
    setSelectedForm(form);
    setSelectedSubmissionId(submissionId); // With submission ID = edit mode
    setViewOnly(false); // ✅ Edit mode
    setShowFormModal(true);
  };

  const handleViewSubmission = (form, submissionId) => {
    setSelectedForm(form);
    setSelectedSubmissionId(submissionId);
    setViewOnly(true); // ✅ Open in read-only mode
    setShowFormModal(true);
  };

  const handleCloseModal = (submitted) => {
    setShowFormModal(false);
    setSelectedForm(null);
    setSelectedSubmissionId(null);
    setViewOnly(false);

    if (submitted) {
      loadFormsAndSubmissions(); // Refresh the list
      if (onRefresh) onRefresh();
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      COMPLETED: {
        icon: CheckCircle,
        label: "Submitted",
        color: "bg-green-100 text-green-800",
      },
      IN_PROGRESS: {
        icon: Clock,
        label: "Draft",
        color: "bg-yellow-100 text-yellow-800",
      },
      PENDING: {
        icon: Clock,
        label: "Pending",
        color: "bg-blue-100 text-blue-800",
      },
    };

    const config = statusMap[status] || {
      icon: AlertCircle,
      label: status,
      color: "bg-gray-100 text-gray-800",
    };
    const Icon = config.icon;

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
      >
        <Icon size={12} />
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-6 h-6 animate-spin text-blue-600 mr-2" />
        <span className="text-gray-600">Loading forms...</span>
      </div>
    );
  }

  if (formsWithSubmissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="w-12 h-12 text-gray-400 mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No Forms Attached
        </h3>
        <p className="text-gray-600">
          This task doesn't have any forms attached yet.
        </p>
      </div>
    );
  }

  return (
    <div className="attached-forms-tab ">
      {formsWithSubmissions.map((form, formIndex) => (
        <div
          key={formIndex}
          className="border rounded-md overflow-hidden bg-white shadow-sm mb-3"
        >
          {/* Form Header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    {form.formTitle}
                  </h3>
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                    v{form.versionNumber}
                  </span>
                </div>
                {form.formDescription && (
                  <p className="text-sm text-gray-600 mt-1">
                    {form.formDescription}
                  </p>
                )}
                {form.isSubtask && (
                  <p className="text-xs text-gray-500 mt-2">
                    <span className="font-medium">Subtask:</span>{" "}
                    {form.taskTitle}
                  </p>
                )}
              </div>
              {/* Only allow new submissions when the form/version is accessible */}
              {!form.restricted ? (
                <button
                  onClick={() => handleCreateNewSubmission(form)}
                  className="flex items-center gap-2 px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Plus size={16} />
                  New Submission
                </button>
              ) : (
                <div className="px-4">
                  <span className="text-sm text-gray-600">Restricted</span>
                </div>
              )}
            </div>
          </div>

          {/* Submissions List */}
          <div className="p-4">
            {form.restricted ? (
              <div className="text-center py-8 bg-gray-50 rounded-sm">
                <p className="text-gray-500">
                  This form is restricted — only the owner or permitted users
                  can view it.
                </p>
              </div>
            ) : form.submissions.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-sm">
                <p className="text-gray-500">
                  You haven't submitted this form yet.
                </p>
                <button
                  onClick={() => handleCreateNewSubmission(form)}
                  className="mt-3 text-blue-600 hover:text-blue-700 font-medium"
                >
                  Create your first submission →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Your Submissions ({form.submissions.length})
                </h4>
                {form.submissions.map((submission, subIndex) => (
                  <div
                    key={submission._id}
                    className="flex items-center justify-between p-4 border rounded-sm hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          Submission #{form.submissions.length - subIndex}
                        </span>
                        {getStatusBadge(submission.status)}
                      </div>
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>
                          <span className="font-medium">Submitted:</span>{" "}
                          {formatDate(submission.submitted_at)}
                        </div>
                        {submission.updated_at &&
                          submission.updated_at !== submission.submitted_at && (
                            <div>
                              <span className="font-medium">Last Updated:</span>{" "}
                              {formatDate(submission.updated_at)}
                            </div>
                          )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleViewSubmission(form, submission._id)
                        }
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded border"
                        title="View submission"
                      >
                        <Eye size={14} />
                        View
                      </button>
                      <button
                        onClick={() =>
                          handleEditSubmission(form, submission._id)
                        }
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 rounded border border-blue-200"
                        title="Edit submission"
                      >
                        <Edit size={14} />
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Form Submission Modal */}
      {showFormModal && selectedForm && (
        <FormSubmissionModal
          open={showFormModal}
          onClose={handleCloseModal}
          formData={{
            formVersionId: selectedForm.formVersionId,
            taskId: selectedForm.taskId,
            isSubtask: selectedForm.isSubtask,
            formTitle: selectedForm.formTitle,
            versionNumber: selectedForm.versionNumber,
            submissionStatus: viewOnly
              ? selectedForm.submissions?.find(
                  (s) => s._id === selectedSubmissionId,
                )?.status || "NOT_STARTED"
              : undefined,
          }}
          taskId={selectedForm.isSubtask ? null : selectedForm.taskId}
          subtaskId={selectedForm.isSubtask ? selectedForm.taskId : null}
          submissionId={selectedSubmissionId} // ✅ Pass submission ID for edit mode
          readOnly={viewOnly} // ✅ Read-only mode for View button
          onSubmitSuccess={() => {
            console.log("Form submitted successfully");
            handleCloseModal(true);
          }}
        />
      )}
    </div>
  );
}
