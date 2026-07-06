import React, { useState } from "react";
import { Button } from "@/components/ui/button";

function FormsPanel({ forms, taskId }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [filter, setFilter] = useState("all");

  const filteredForms = forms.filter((form) => {
    if (filter === "all") return true;
    return form.status === filter;
  });

  const getFormIcon = (type) => {
    const icons = {
      checklist: "✅",
      survey: "📊",
      approval: "👍",
      feedback: "💬",
      assessment: "📝",
    };
    return icons[type] || "📄";
  };

  const getStatusColor = (status) => {
    const colors = {
      "not-started": "bg-gray-100 text-gray-800",
      "in-progress": "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      overdue: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getFormTypeColor = (type) => {
    const colors = {
      checklist: "bg-green-100 text-green-800",
      survey: "bg-blue-100 text-blue-800",
      approval: "bg-purple-100 text-purple-800",
      feedback: "bg-orange-100 text-orange-800",
      assessment: "bg-indigo-100 text-indigo-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
            <span className="text-white text-lg">📋</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Attached Forms ({filteredForms.length})
            </h2>
            <p className="text-sm text-gray-600">
              Forms, checklists, and interactive documents
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="form-select text-sm"
          >
            <option value="all">All Status</option>
            <option value="OPEN">Open</option>
            <option value="INPROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="OVERDUE">Overdue</option>
          </select>
          <Button
            variant="primary"
            className="h-9 flex items-center gap-2 px-4 w-[200px]"
            onClick={() => setShowAddModal(true)}
          >
            <span className="text-sm">📋</span>
            <span>Add Form</span>
          </Button>
        </div>
      </div>

      {/* Forms Grid */}
      {filteredForms.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredForms.map((form) => (
            <div
              key={form.id}
              className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-lg transition-all duration-300 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-xl flex items-center justify-center text-xl">
                    {getFormIcon(form.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4
                      className="font-semibold text-gray-900 mb-2 truncate group-hover:text-emerald-600 transition-colors"
                      title={form.title}
                    >
                      {form.title}
                    </h4>
                    <div className="flex flex-col-2 gap-1">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium w-fit ${getFormTypeColor(
                          form.type,
                        )}`}
                      >
                        {form.type}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium w-fit ${getStatusColor(
                          form.status,
                        )}`}
                      >
                        {form.status.replace("-", " ")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Bar for in-progress forms */}
              {form.status === "in-progress" && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>65%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full"
                      style={{ width: "65%" }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 h-9 text-sm font-medium flex items-center justify-center gap-1"
                  onClick={() => console.log("View form:", form.id)}
                >
                  <span>👁️</span>
                  <span>View</span>
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 h-9 text-sm font-medium flex items-center justify-center gap-1"
                  onClick={() => console.log("Edit form:", form.id)}
                >
                  <span>✏️</span>
                  <span>Edit</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10 bg-red-50 hover:bg-red-100 text-red-600"
                  onClick={() => console.log("Remove form:", form.id)}
                  title="Remove Form"
                >
                  <span>🗑️</span>
                </Button>
              </div>

              {/* Additional Form Info */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Created: Today</span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Active
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">📋</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No forms attached
          </h3>
          <p className="text-gray-600 mb-3">
            Add forms, checklists, or surveys to collect structured data
          </p>
          <Button
            variant="outline"
            className="h-9"
            onClick={() => setShowAddModal(true)}
          >
            Add First Form
          </Button>
        </div>
      )}

      {/* Add Form Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm bg-opacity-50 flex items-center justify-center z-50 p-4 mt-0 overlay-animate">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full modal-animate-slide-up">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  Add New Form
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8"
                  onClick={() => setShowAddModal(false)}
                >
                  <span className="text-sm">✕</span>
                </Button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Form Type
                  </label>
                  <select className="form-select w-full">
                    <option value="checklist">Checklist</option>
                    <option value="survey">Survey</option>
                    <option value="approval">Approval Form</option>
                    <option value="feedback">Feedback Form</option>
                    <option value="assessment">Assessment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Form Name
                  </label>
                  <input
                    type="text"
                    className="form-input w-full"
                    placeholder="Enter form name..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    className="form-input w-full"
                    rows="3"
                    placeholder="Enter form description..."
                  />
                </div>

                <div className="bg-emerald-50 p-4 rounded-sm">
                  <h4 className="text-sm font-medium text-emerald-800 mb-2">
                    Quick Templates
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="h-9 bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    >
                      Project Checklist
                    </Button>
                    <Button
                      variant="outline"
                      className="h-9 bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    >
                      Quality Review
                    </Button>
                    <Button
                      variant="outline"
                      className="h-9 bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    >
                      Team Feedback
                    </Button>
                    <Button
                      variant="outline"
                      className="h-9 bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    >
                      Custom Form
                    </Button>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="h-9 flex-1"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    className="h-9 flex-1"
                    onClick={() => {
                      console.log("Create form");
                      setShowAddModal(false);
                    }}
                  >
                    Create Form
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FormsPanel;
