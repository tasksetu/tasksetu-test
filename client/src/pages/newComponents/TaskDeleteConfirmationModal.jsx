import React, { useState } from "react";
import { useShowToast } from "@/utils/ToastMessage";
import { Button } from "@/components/ui/button";

export default function TaskDeleteConfirmationModal({
  task,
  options,
  onConfirm,
  onCancel,
  currentUser,
}) {
  const { showSuccessToast, showErrorToast } = useShowToast();
  const [deleteOptions, setDeleteOptions] = useState({
    deleteSubtasks: false,
    deleteAttachments: false,
    deleteLinkedItems: false,
    confirmed: false,
    ...options,
  });
  const [showSpinner, setShowSpinner] = useState(false);

  const handleConfirm = async () => {
    if (!deleteOptions.confirmed) {
      showErrorToast("Confirm that you understand this action is irreversible");
      return;
    }

    setShowSpinner(true);

    // Simulate async deletion with spinner
    setTimeout(() => {
      onConfirm(deleteOptions);
      setShowSpinner(false);
    }, 1000);
  };

  const handleOptionChange = (option, value) => {
    setDeleteOptions((prev) => ({
      ...prev,
      [option]: value,
    }));
  };

  // Enhanced checks for different scenarios
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const hasAttachments = task.attachments && task.attachments.length > 0;
  const hasLinkedItems = task.linkedItems && task.linkedItems.length > 0;
  const hasForms = task.forms && task.forms.length > 0;
  const isSubtask = task.parentTaskId;
  const isReferencedInDependencies =
    task.dependencies && task.dependencies.length > 0;
  const createdByAnotherUser = task.creatorId !== currentUser.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overlay-animate">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md modal-animate-slide-right">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Delete Task
              </h3>
              <p className="text-sm text-gray-600">
                This action cannot be undone
              </p>
            </div>
          </div>

          <div className="mb-3">
            <p className="text-gray-900 mb-2">
              Are you sure you want to delete{" "}
              {isSubtask ? "this sub-task" : "this task"}:
            </p>
            <p className="font-medium text-gray-900 bg-gray-50 p-3 rounded-sm border-l-4 border-red-500">
              "{task.title}"
            </p>
            {isSubtask && (
              <p className="text-sm text-gray-600 mt-2">
                This is a sub-task of another task.
              </p>
            )}
          </div>

          {/* Warning Messages */}
          <div className="mb-3 space-y-3">
            {hasSubtasks && (
              <div className="bg-orange-50 border border-orange-200 rounded-sm p-3">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-orange-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-orange-800">
                      This task has {task.subtasks.length} sub-task
                      {task.subtasks.length !== 1 ? "s" : ""}
                    </h4>
                    <p className="text-sm text-orange-700 mt-1">
                      Deleting it will delete all sub-tasks permanently.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {(hasAttachments || hasForms) && (
              <div className="bg-blue-50 border border-blue-200 rounded-sm p-3">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-blue-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-blue-800">
                      Files and Forms Attached
                    </h4>
                    <p className="text-sm text-blue-700 mt-1">
                      All linked forms and files will also be deleted.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isReferencedInDependencies && (
              <div className="bg-purple-50 border border-purple-200 rounded-sm p-3">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-purple-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-purple-800">
                      Task Dependencies Found
                    </h4>
                    <p className="text-sm text-purple-700 mt-1">
                      This task is referenced by other tasks. Deleting it may
                      affect task relationships.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {createdByAnotherUser && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-sm p-3">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-yellow-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-yellow-800">
                      Task Created by Another User
                    </h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      This task was created by {task.createdBy}. You can delete
                      it because you are{" "}
                      {task.assigneeId === currentUser.id
                        ? "assigned to it"
                        : "an administrator"}
                      .
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Deletion Options */}
          {(hasSubtasks || hasAttachments || hasLinkedItems || hasForms) && (
            <div className="mb-3 space-y-3">
              <p className="text-sm font-medium text-gray-700">
                Deletion Options:
              </p>

              {hasSubtasks && (
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={deleteOptions.deleteSubtasks}
                    onChange={(e) =>
                      handleOptionChange("deleteSubtasks", e.target.checked)
                    }
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="ml-3 text-sm text-gray-700">
                    Also delete all {task.subtasks.length} sub-task
                    {task.subtasks.length !== 1 ? "s" : ""}
                  </span>
                </label>
              )}

              {(hasAttachments || hasForms) && (
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={deleteOptions.deleteAttachments}
                    onChange={(e) =>
                      handleOptionChange("deleteAttachments", e.target.checked)
                    }
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="ml-3 text-sm text-gray-700">
                    Also delete attached files and forms
                  </span>
                </label>
              )}

              {hasLinkedItems && (
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={deleteOptions.deleteLinkedItems}
                    onChange={(e) =>
                      handleOptionChange("deleteLinkedItems", e.target.checked)
                    }
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="ml-3 text-sm text-gray-700">
                    Also delete {task.linkedItems.length} linked item
                    {task.linkedItems.length !== 1 ? "s" : ""}
                  </span>
                </label>
              )}
            </div>
          )}

          {/* Confirmation Requirement */}
          <div className="mb-3">
            <label className="flex items-start">
              <input
                type="checkbox"
                checked={deleteOptions.confirmed}
                onChange={(e) =>
                  handleOptionChange("confirmed", e.target.checked)
                }
                className="rounded border-gray-300 text-red-600 focus:ring-red-500 mt-0.5"
                required
              />
              <span className="ml-3 text-sm text-gray-900 font-medium">
                I understand this action is{" "}
                <span className="text-red-600">irreversible</span> and will
                permanently delete this {isSubtask ? "sub-task" : "task"} and
                all selected related data.
              </span>
            </label>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={onCancel}
              disabled={showSpinner}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!deleteOptions.confirmed || showSpinner}
              variant="danger"
              className="flex-1 flex items-center justify-center"
            >
              {showSpinner ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Deleting...
                </>
              ) : (
                `Delete ${isSubtask ? "Sub-task" : "Task"}`
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
