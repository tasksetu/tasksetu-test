import React from "react";
import TaskEditModal from "./TaskEditModal";
import StatusConfirmationModal from "./StatusConfirmationModal";
import CustomConfirmationModal from "./CustomConfirmationModal";
import CalendarDatePicker from "./CalendarDatePicker";
import ApprovalTaskCreator from "./ApprovalTaskCreator";
import TaskThreadModal from "./TaskThreadModal";
import SmartTaskParser from "./SmartTaskParser";
import MilestoneCreator from "../MilestoneCreator";
import CreateTask from "./CreateTask";

const TaskModals = React.memo(function TaskModals({
  // Create Task Drawer
  showCreateTaskDrawer,
  setShowCreateTaskDrawer,
  selectedDateForTask,
  handleTaskCreated,
  // Approval Task Modal
  showApprovalTaskModal,
  setShowApprovalTaskModal,
  handleCreateApprovalTask,
  // Milestone Modal
  showMilestoneModal,
  setShowMilestoneModal,
  handleCreateMilestone,
  // Calendar Modal
  showCalendarModal,
  setShowCalendarModal,
  handleCalendarDateSelect,
  // Edit Modal
  showEditTaskModal,
  setShowEditTaskModal,
  editingTask,
  handleTaskUpdated,
  // Status Confirmation
  showStatusConfirmation,
  setShowStatusConfirmation,
  executeStatusChange,
  apiTasks,
  // Custom Confirmation
  confirmModal,
  setConfirmModal,
  // Smart Parser & Thread
  showSmartParser,
  setShowSmartParser,
  showThreadModal,
  setShowThreadModal,
  selectedTaskForThread,
  setSelectedTaskForThread,
  handleSmartTaskCreated,
  // Task Details
  showTaskDetails,
  setShowTaskDetails,
  selectedTask,
}) {
  return (
    <>
      {/* Create Task Drawer */}
      {showCreateTaskDrawer && (
        <div
          className="fixed inset-0 z-50 overflow-hidden"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowCreateTaskDrawer(false)}
          ></div>
          <div
            className="absolute right-0 top-0 h-full bg-white flex flex-col shadow-xl"
            style={{ width: "min(90vw, 600px)", maxHeight: "100vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-blue-600 text-white">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">
                  Create New Task
                  {selectedDateForTask &&
                    ` for ${new Date(selectedDateForTask)
                      .toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                      .replace(",", "")}`}
                </h2>
                <button
                  onClick={() => setShowCreateTaskDrawer(false)}
                  className="text-white hover:text-gray-200 p-1"
                >
                  <svg
                    className="w-6 h-6"
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
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CreateTask
                onSubmit={handleTaskCreated}
                onClose={() => setShowCreateTaskDrawer(false)}
                preFilledDate={selectedDateForTask}
                drawer={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Approval Task Modal */}
      {showApprovalTaskModal && (
        <div className="fixed inset-0 z-50 overflow-hidden overlay-animate mt-0">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowApprovalTaskModal(false)}
          ></div>
          <div
            className="absolute right-0 top-0 h-full bg-white/95 flex flex-col modal-animate-slide-right"
            style={{ width: "min(90vw, 900px)" }}
          >
            <div className="drawer-header">
              <h2 className="text-2xl font-bold text-white">
                Create Approval Task
              </h2>
              <button
                onClick={() => setShowApprovalTaskModal(false)}
                className="close-btn"
              >
                <svg
                  className="w-6 h-6"
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
              </button>
            </div>
            <div className="drawer-content">
              <ApprovalTaskCreator
                onSubmit={handleCreateApprovalTask}
                onCancel={() => setShowApprovalTaskModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Milestone Modal */}
      {showMilestoneModal && (
        <div className="fixed inset-0 z-50 overflow-hidden overlay-animate mt-0">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowMilestoneModal(false)}
          ></div>
          <div
            className="absolute right-0 top-0 h-full bg-white/95 flex flex-col modal-animate-slide-right"
            style={{ width: "min(90vw, 900px)" }}
          >
            <div className="drawer-header">
              <h2 className="text-2xl font-bold text-white">
                Create Milestone
              </h2>
              <button
                onClick={() => setShowMilestoneModal(false)}
                className="close-btn"
              >
                <svg
                  className="w-6 h-6"
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
              </button>
            </div>
            <div className="drawer-content">
              <MilestoneCreator
                onSubmit={handleCreateMilestone}
                onCancel={() => setShowMilestoneModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Calendar Modal */}
      {showCalendarModal && (
        <div
          className="fixed inset-0 z-50 overflow-hidden overlay-animate mt-0"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowCalendarModal(false)}
          ></div>
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div
              className="bg-white rounded-sm shadow-xl border border-gray-200 p-4 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold text-gray-900">
                  Select Date for Task
                </h2>
                <button
                  onClick={() => setShowCalendarModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-6 h-6"
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
                </button>
              </div>
              <CalendarDatePicker
                selectedDate={null}
                onDateSelect={handleCalendarDateSelect}
                onClose={() => setShowCalendarModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {showEditTaskModal && editingTask && (
        <div className="fixed inset-0 z-50 overflow-hidden overlay-animate mt-0">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowEditTaskModal(false)}
          ></div>
          <div
            className="absolute right-0 top-0 h-full bg-white/95 flex flex-col modal-animate-slide-right"
            style={{ width: "min(90vw, 900px)" }}
          >
            <div className="drawer-header">
              <h2 className="text-2xl font-bold text-white">Edit Task</h2>
              <button
                onClick={() => setShowEditTaskModal(false)}
                className="close-btn"
              >
                <svg
                  className="w-6 h-6"
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
              </button>
            </div>
            <div className="drawer-content">
              <TaskEditModal
                task={editingTask}
                onSave={handleTaskUpdated}
                onClose={() => setShowEditTaskModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      {showTaskDetails && selectedTask && (
        <div className="fixed inset-0 z-50 overflow-hidden overlay-animate mt-0">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowTaskDetails(false)}
          ></div>
          <div
            className="absolute right-0 top-0 h-full bg-white/95 flex flex-col modal-animate-slide-right"
            style={{ width: "min(90vw, 900px)" }}
          >
            <div className="drawer-header">
              <h2 className="text-2xl font-bold text-white">Task Details</h2>
              <button
                onClick={() => setShowTaskDetails(false)}
                className="close-btn"
              >
                <svg
                  className="w-6 h-6"
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
              </button>
            </div>
            <div className="drawer-content">
              <div className="p-4">
                <h3 className="text-lg font-semibold mb-3">Task Details</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Title
                    </label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedTask.title}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Status
                    </label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedTask.status}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Assignee
                    </label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedTask.assignee}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Due Date
                    </label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedTask.dueDate || "No due date"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Confirmation Modal */}
      {showStatusConfirmation && (
        <StatusConfirmationModal
          isOpen={!!showStatusConfirmation}
          taskTitle={showStatusConfirmation.taskTitle}
          statusLabel={showStatusConfirmation.statusLabel}
          onConfirm={(reason) => {
            const task = apiTasks.find(
              (t) =>
                t._id === showStatusConfirmation.taskId ||
                t.id === showStatusConfirmation.taskId,
            );
            if (task)
              executeStatusChange(
                task,
                showStatusConfirmation.newStatusCode,
                reason,
              );
            setShowStatusConfirmation(null);
          }}
          onCancel={() => setShowStatusConfirmation(null)}
        />
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <CustomConfirmationModal
          isOpen={confirmModal.isOpen}
          type={confirmModal.type}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() =>
            setConfirmModal({
              isOpen: false,
              type: "",
              title: "",
              message: "",
              onConfirm: null,
              data: null,
            })
          }
        />
      )}

      {/* Smart Task Parser */}
      {showSmartParser && (
        <div className="fixed inset-0 z-50 overflow-hidden overlay-animate mt-0">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowSmartParser(false)}
          ></div>
          <div
            className="absolute right-0 top-0 h-full bg-white/95 flex flex-col modal-animate-slide-right"
            style={{ width: "min(90vw, 600px)" }}
          >
            <div className="drawer-header">
              <h2 className="text-2xl font-bold text-white">
                Smart Task Parser
              </h2>
              <button
                onClick={() => setShowSmartParser(false)}
                className="close-btn"
              >
                <svg
                  className="w-6 h-6"
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
              </button>
            </div>
            <div className="drawer-content">
              <SmartTaskParser
                onTaskCreated={handleSmartTaskCreated}
                onClose={() => setShowSmartParser(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Task Thread Modal */}
      {showThreadModal && selectedTaskForThread && (
        <TaskThreadModal
          isOpen={showThreadModal}
          onClose={() => {
            setShowThreadModal(false);
            setSelectedTaskForThread(null);
          }}
          task={selectedTaskForThread}
        />
      )}
    </>
  );
});

export default TaskModals;
