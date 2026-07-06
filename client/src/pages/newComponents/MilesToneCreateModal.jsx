import React from "react";

const MilesToneCreateModal = ({ setShowAddForm }) => {
  return (
    <>
      <div className="modal-overlay overlay-animate">
        <div className="modal-container max-w-4xl modal-animate-fade">
          <div className="modal-header">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">
                  Add New Milestone
                </h3>
                <p className="text-white/80 text-sm">
                  Create a milestone to track project progress
                </p>
              </div>
            </div>
            <button
              className="close-button"
              onClick={() => setShowAddForm(false)}
            >
              ×
            </button>
          </div>

          <form className="modal-content bg-gradient-to-br from-gray-50 to-white">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-100 mb-8">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-bold text-gray-900 mb-2">
                    Milestone Information
                  </h4>
                  <p className="text-sm text-gray-600">
                    Define the basic properties and configuration for your
                    milestone
                  </p>
                </div>
              </div>
            </div>

            {/* Main Form Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-3">
                <div className="form-group">
                  <label
                    htmlFor="taskName"
                    className="form-label flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-blue-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                    Milestone Title*
                  </label>
                  <input
                    type="text"
                    id="taskName"
                    placeholder="Enter milestone title (e.g., Project Alpha Launch)"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <label
                      htmlFor="isMilestone"
                      className="flex items-center space-x-3 cursor-pointer"
                    >
                      <div className="relative">
                        <input
                          type="checkbox"
                          id="isMilestone"
                          defaultChecked={true}
                          className="w-5 h-5 rounded border-2 border-amber-300 text-amber-600 focus:ring-amber-500 focus:ring-offset-0"
                        />
                        <svg
                          className="w-3 h-3 text-amber-600 absolute top-0.5 left-0.5 pointer-events-none"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <span className="font-semibold text-amber-800">
                          Milestone Toggle*
                        </span>
                        <p className="text-xs text-amber-700 mt-1">
                          Required to mark this task as a milestone
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label
                    htmlFor="milestoneType"
                    className="form-label flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-purple-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                    Milestone Type
                  </label>
                  <select id="milestoneType" className="form-select">
                    <option value="standalone">🎯 Standalone Milestone</option>
                    <option value="linked">🔗 Linked to Tasks</option>
                  </select>
                </div>

                <div className="form-group">
                  <label
                    htmlFor="dueDate"
                    className="form-label flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-red-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    Due Date*
                  </label>
                  <input type="date" id="dueDate" className="form-input" />
                </div>

                <div className="form-group">
                  <label
                    htmlFor="assignedTo"
                    className="form-label flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    Assigned To
                  </label>
                  <select id="assignedTo" className="form-select">
                    <option value="">Select Assignee</option>
                    <option value="Current User">Current User</option>
                  </select>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-3">
                <div className="form-group">
                  <label
                    htmlFor="linkedTasks"
                    className="form-label flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-indigo-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                      />
                    </svg>
                    Link to Tasks
                  </label>
                  <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-4">
                    <div className="space-y-3">
                      <label className="flex items-center space-x-3 p-3 bg-white rounded-sm border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-200 cursor-pointer group">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-green-500">✅</span>
                          <span className="text-sm font-medium text-gray-900 group-hover:text-indigo-700">
                            UI Design Complete
                          </span>
                        </div>
                      </label>
                      <label className="flex items-center space-x-3 p-3 bg-white rounded-sm border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-200 cursor-pointer group">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-blue-500">⚙️</span>
                          <span className="text-sm font-medium text-gray-900 group-hover:text-indigo-700">
                            Backend API Development
                          </span>
                        </div>
                      </label>
                      <label className="flex items-center space-x-3 p-3 bg-white rounded-sm border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-200 cursor-pointer group">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-purple-500">🧪</span>
                          <span className="text-sm font-medium text-gray-900 group-hover:text-indigo-700">
                            Testing Phase
                          </span>
                        </div>
                      </label>
                      <label className="flex items-center space-x-3 p-3 bg-white rounded-sm border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-200 cursor-pointer group">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-orange-500">🚀</span>
                          <span className="text-sm font-medium text-gray-900 group-hover:text-indigo-700">
                            Deployment
                          </span>
                        </div>
                      </label>
                    </div>
                    <p className="text-xs text-indigo-600 mt-3 flex items-center gap-1 bg-white/50 p-2 rounded-sm">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Select tasks/subtasks to monitor for this milestone
                    </p>
                  </div>
                </div>

                <div className="form-group">
                  <label
                    htmlFor="description"
                    className="form-label flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h7"
                      />
                    </svg>
                    Description
                  </label>
                  <textarea
                    id="description"
                    placeholder="Describe the milestone purpose, criteria, and background..."
                    rows="4"
                    className="form-textarea resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label
                      htmlFor="visibility"
                      className="form-label flex items-center gap-2"
                    >
                      <svg
                        className="w-4 h-4 text-yellow-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                      Visibility
                    </label>
                    <select id="visibility" className="form-select">
                      <option value="private">🔒 Private</option>
                      <option value="public">👥 Public</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label
                      htmlFor="priority"
                      className="form-label flex items-center gap-2"
                    >
                      <svg
                        className="w-4 h-4 text-orange-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Priority
                    </label>
                    <select id="priority" className="form-select">
                      <option value="low">🟢 Low</option>
                      <option value="medium" defaultSelected>
                        🟡 Medium
                      </option>
                      <option value="high">🟠 High</option>
                      <option value="critical">🔴 Critical</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label
                    htmlFor="collaborators"
                    className="form-label flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-teal-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    Collaborators
                  </label>
                  <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-4">
                    <div className="space-y-3">
                      <label className="flex items-center space-x-3 p-3 bg-white rounded-sm border border-gray-200 hover:border-teal-300 hover:bg-teal-50 transition-all duration-200 cursor-pointer group">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                        />
                        <div className="flex items-center gap-2 flex-1">
                          <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-bold">
                            CU
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-900 group-hover:text-teal-700">
                              Current User
                            </span>
                            <p className="text-xs text-gray-500">
                              current@company.com
                            </p>
                          </div>
                        </div>
                      </label>
                    </div>
                    <p className="text-xs text-teal-600 mt-3 flex items-center gap-1 bg-white/50 p-2 rounded-sm">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Optional - for updates & comments visibility
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 mt-10 pt-8 border-t-2 border-gray-100">
              <button
                type="button"
                className="btn btn-secondary px-8 py-3 text-sm font-semibold"
                onClick={() => setShowAddForm(false)}
              >
                <svg
                  className="w-4 h-4 mr-2"
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
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary px-8 py-3 text-sm font-semibold flex items-center gap-2"
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
                Create Milestone
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default MilesToneCreateModal;
