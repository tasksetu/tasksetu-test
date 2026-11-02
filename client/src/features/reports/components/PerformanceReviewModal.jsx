import React, { useState } from "react";
import {
  X,
  Award,
  AlertTriangle,
  FileText,
  Plus,
  Trash2,
  Calendar,
  CheckCircle,
} from "lucide-react";
import { useCreatePerformanceReview } from "../hooks/usePerformanceReports";

export const PerformanceReviewModal = ({ isOpen, onClose, employees = [] }) => {
  const [reviewType, setReviewType] = useState("REVIEW");
  const [employeeId, setEmployeeId] = useState("");
  const [periodType, setPeriodType] = useState("monthly");
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [positiveAchievements, setPositiveAchievements] = useState("");
  const [workloadAndBlockerContext, setWorkloadAndBlockerContext] = useState("");
  const [managerComments, setManagerComments] = useState("");
  const [privateManagerNotes, setPrivateManagerNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  // Recognition details
  const [badge, setBadge] = useState("Star Performer");
  const [recognitionCategory, setRecognitionCategory] = useState("On-Time Excellence");
  const [citation, setCitation] = useState("");

  // Notice details
  const [severity, setSeverity] = useState("moderate");
  const [violationType, setViolationType] = useState("Repeated Overdue Deliverables");
  const [correctiveActionPlan, setCorrectiveActionPlan] = useState("");

  // Improvement objectives
  const [objectives, setObjectives] = useState([
    { objective: "", targetDate: "" },
  ]);

  const createReviewMutation = useCreatePerformanceReview();

  if (!isOpen) return null;

  const handleAddObjective = () => {
    setObjectives([...objectives, { objective: "", targetDate: "" }]);
  };

  const handleRemoveObjective = (index) => {
    setObjectives(objectives.filter((_, i) => i !== index));
  };

  const handleObjectiveChange = (index, field, value) => {
    const updated = [...objectives];
    updated[index][field] = value;
    setObjectives(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employeeId) {
      alert("Please select an employee.");
      return;
    }

    const payload = {
      reviewType,
      employeeId,
      period: {
        startDate,
        endDate,
        periodType,
      },
      positiveAchievements,
      workloadAndBlockerContext,
      managerComments,
      privateManagerNotes,
      followUpDate: followUpDate || null,
      improvementObjectives: objectives.filter((o) => o.objective.trim() !== ""),
      recognitionDetails:
        reviewType === "RECOGNITION"
          ? { badge, category: recognitionCategory, citation }
          : undefined,
      noticeDetails:
        reviewType === "NOTICE"
          ? { severity, violationType, correctiveActionPlan }
          : undefined,
    };

    try {
      await createReviewMutation.mutateAsync(payload);
      onClose();
    } catch (err) {
      alert(err.message || "Failed to create performance document.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-sm shadow-xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Document Performance Record
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Create an evidence-based performance review, recognition award, or formal notice.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Type Selector Tabs */}
        <div className="px-6 pt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setReviewType("REVIEW")}
            className={`py-2 px-3 text-xs font-semibold rounded-sm border flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
              reviewType === "REVIEW"
                ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <FileText size={14} /> Performance Review
          </button>
          <button
            type="button"
            onClick={() => setReviewType("RECOGNITION")}
            className={`py-2 px-3 text-xs font-semibold rounded-sm border flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
              reviewType === "RECOGNITION"
                ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <Award size={14} /> Recognition Award
          </button>
          <button
            type="button"
            onClick={() => setReviewType("NOTICE")}
            className={`py-2 px-3 text-xs font-semibold rounded-sm border flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
              reviewType === "NOTICE"
                ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <AlertTriangle size={14} /> Performance Notice
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4 max-h-[72vh] overflow-y-auto">
          {/* Employee Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Employee <span className="text-rose-500">*</span>
              </label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
                className="w-full text-xs border border-gray-300 rounded-sm px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select Employee...</option>
                {employees.map((emp) => {
                  const empId = emp.id || emp._id;
                  const empName = emp.name || (emp.firstName ? `${emp.firstName} ${emp.lastName || ""}`.trim() : emp.email);
                  return (
                    <option key={empId} value={empId}>
                      {empName} ({emp.department || "General"})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Period Type
              </label>
              <select
                value={periodType}
                onChange={(e) => setPeriodType(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded-sm px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          {/* Period Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Period Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full text-xs border border-gray-300 rounded-sm px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Period End Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full text-xs border border-gray-300 rounded-sm px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* RECOGNITION SPECIFIC FIELDS */}
          {reviewType === "RECOGNITION" && (
            <div className="p-3 bg-amber-50/60 rounded-sm border border-amber-200/80 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-amber-900 mb-1">
                    Award Badge
                  </label>
                  <input
                    type="text"
                    value={badge}
                    onChange={(e) => setBadge(e.target.value)}
                    placeholder="e.g. Star Performer, Sprint Champion"
                    className="w-full text-xs border border-amber-300 rounded-sm px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-amber-900 mb-1">
                    Category
                  </label>
                  <select
                    value={recognitionCategory}
                    onChange={(e) => setRecognitionCategory(e.target.value)}
                    className="w-full text-xs border border-amber-300 rounded-sm px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="On-Time Excellence">On-Time Excellence</option>
                    <option value="Consistent Delivery">Consistent Delivery</option>
                    <option value="Quality & Innovation">Quality & Innovation</option>
                    <option value="Team Collaboration">Team Collaboration</option>
                    <option value="Fast Improvement">Fast Improvement</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-amber-900 mb-1">
                  Award Citation
                </label>
                <textarea
                  value={citation}
                  onChange={(e) => setCitation(e.target.value)}
                  rows={2}
                  placeholder="Official citation celebrating this employee's outstanding achievements..."
                  className="w-full text-xs border border-amber-300 rounded-sm px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>
          )}

          {/* NOTICE SPECIFIC FIELDS */}
          {reviewType === "NOTICE" && (
            <div className="p-3 bg-rose-50/60 rounded-sm border border-rose-200/80 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-rose-900 mb-1">
                    Severity Level
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="w-full text-xs border border-rose-300 rounded-sm px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="low">Low - Informal Coaching</option>
                    <option value="moderate">Moderate - Performance Advisory</option>
                    <option value="formal">Formal - Written Notice</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-rose-900 mb-1">
                    Focus Area / Violation
                  </label>
                  <input
                    type="text"
                    value={violationType}
                    onChange={(e) => setViolationType(e.target.value)}
                    placeholder="e.g. Unexplained Overdue Tasks"
                    className="w-full text-xs border border-rose-300 rounded-sm px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-rose-900 mb-1">
                  Corrective Action Plan
                </label>
                <textarea
                  value={correctiveActionPlan}
                  onChange={(e) => setCorrectiveActionPlan(e.target.value)}
                  rows={2}
                  placeholder="Concrete steps required to bring performance back on track..."
                  className="w-full text-xs border border-rose-300 rounded-sm px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>
            </div>
          )}

          {/* Achievements */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Positive Achievements & Strengths
            </label>
            <textarea
              value={positiveAchievements}
              onChange={(e) => setPositiveAchievements(e.target.value)}
              rows={2}
              placeholder="Highlight on-time deliverables, quality, initiative, and key contributions..."
              className="w-full text-xs border border-gray-300 rounded-sm px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Workload and Blocker Context */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Workload & External Dependency Context
            </label>
            <textarea
              value={workloadAndBlockerContext}
              onChange={(e) => setWorkloadAndBlockerContext(e.target.value)}
              rows={2}
              placeholder="Note any external bottlenecks, high workload spikes, or dependencies that influenced delivery..."
              className="w-full text-xs border border-gray-300 rounded-sm px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Improvement Objectives */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-700">
                Actionable Improvement Objectives
              </label>
              <button
                type="button"
                onClick={handleAddObjective}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} /> Add Objective
              </button>
            </div>
            <div className="space-y-2">
              {objectives.map((obj, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={obj.objective}
                    onChange={(e) => handleObjectiveChange(i, "objective", e.target.value)}
                    placeholder={`Objective #${i + 1}...`}
                    className="flex-1 text-xs border border-gray-300 rounded-sm px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="date"
                    value={obj.targetDate}
                    onChange={(e) => handleObjectiveChange(i, "targetDate", e.target.value)}
                    className="w-36 text-xs border border-gray-300 rounded-sm px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {objectives.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveObjective(i)}
                      className="p-1 text-gray-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Manager Comments */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Manager Comments (Visible to Employee)
            </label>
            <textarea
              value={managerComments}
              onChange={(e) => setManagerComments(e.target.value)}
              rows={2}
              placeholder="Overall review feedback and guidance for the employee..."
              className="w-full text-xs border border-gray-300 rounded-sm px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Private Manager Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Private Manager Notes (Only visible to managers & admins)
            </label>
            <textarea
              value={privateManagerNotes}
              onChange={(e) => setPrivateManagerNotes(e.target.value)}
              rows={1}
              placeholder="Internal notes for review records, compensation, or coaching history..."
              className="w-full text-xs border border-gray-300 rounded-sm px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Follow-up Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Follow-Up Review Date
            </label>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-full sm:w-1/2 text-xs border border-gray-300 rounded-sm px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-sm hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createReviewMutation.isPending}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-sm hover:bg-blue-700 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {createReviewMutation.isPending ? "Documenting..." : "Submit Performance Record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PerformanceReviewModal;
