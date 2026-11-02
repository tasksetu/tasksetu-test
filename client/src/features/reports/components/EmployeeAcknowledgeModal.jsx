import React, { useState } from "react";
import {
  X,
  Award,
  AlertTriangle,
  FileText,
  CheckCircle,
  MessageSquare,
  Calendar,
  User,
} from "lucide-react";
import { useAcknowledgePerformanceReview } from "../hooks/usePerformanceReports";

export const EmployeeAcknowledgeModal = ({ isOpen, onClose, review }) => {
  const [employeeResponse, setEmployeeResponse] = useState("");
  const acknowledgeMutation = useAcknowledgePerformanceReview();

  if (!isOpen || !review) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await acknowledgeMutation.mutateAsync({
        reviewId: review._id,
        employeeResponse,
      });
      onClose();
    } catch (err) {
      alert(err.message || "Failed to submit acknowledgement.");
    }
  };

  const isRecognition = review.reviewType === "RECOGNITION";
  const isNotice = review.reviewType === "NOTICE";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                isRecognition
                  ? "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                  : isNotice
                  ? "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                  : "bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
              }`}
            >
              {isRecognition ? (
                <Award className="w-5 h-5" />
              ) : isNotice ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {isRecognition
                  ? "Acknowledge Recognition Award"
                  : isNotice
                  ? "Acknowledge Performance Notice"
                  : "Acknowledge Performance Review"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Issued by{" "}
                {review.reviewer?.name ||
                  review.reviewer?.email ||
                  "Manager"}{" "}
                on {new Date(review.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Period Banner */}
          <div className="flex items-center gap-2 text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-md text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="font-semibold">Review Period:</span>
            <span>
              {new Date(review.period?.startDate).toLocaleDateString()} to{" "}
              {new Date(review.period?.endDate).toLocaleDateString()} (
              {review.period?.periodType || "custom"})
            </span>
          </div>

          {/* Recognition Specifics */}
          {isRecognition && review.recognitionDetails && (
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                  {review.recognitionDetails.badge || "Star Performer"}
                </span>
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  Category: {review.recognitionDetails.category || "Excellence"}
                </span>
              </div>
              {review.recognitionDetails.citation && (
                <p className="text-sm text-slate-700 dark:text-slate-200 italic">
                  "{review.recognitionDetails.citation}"
                </p>
              )}
            </div>
          )}

          {/* Notice Specifics */}
          {isNotice && review.noticeDetails && (
            <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
                  {review.noticeDetails.severity || "Moderate"} Severity
                </span>
                <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                  {review.noticeDetails.violationType}
                </span>
              </div>
              {review.noticeDetails.correctiveActionPlan && (
                <div className="text-xs text-slate-700 dark:text-slate-300 mt-2">
                  <span className="font-semibold text-rose-800 dark:text-rose-300">
                    Corrective Action Plan:
                  </span>
                  <p className="mt-1 bg-white/60 dark:bg-slate-900/50 p-2 rounded border border-rose-200 dark:border-rose-900/30">
                    {review.noticeDetails.correctiveActionPlan}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Positive Achievements */}
          {review.positiveAchievements && (
            <div>
              <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> Positive Achievements & Strengths
              </h4>
              <p className="text-sm text-slate-700 dark:text-slate-300 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded border border-emerald-100 dark:border-emerald-900/30 whitespace-pre-wrap">
                {review.positiveAchievements}
              </p>
            </div>
          )}

          {/* Manager Comments */}
          {review.managerComments && (
            <div>
              <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Manager Feedback
              </h4>
              <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3 rounded border border-slate-200 dark:border-slate-700/60 whitespace-pre-wrap">
                {review.managerComments}
              </p>
            </div>
          )}

          {/* Workload & Blocker Context */}
          {review.workloadAndBlockerContext && (
            <div>
              <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Workload & Blocker Context
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded border border-slate-200 dark:border-slate-700/60 whitespace-pre-wrap">
                {review.workloadAndBlockerContext}
              </p>
            </div>
          )}

          {/* Improvement Objectives */}
          {review.improvementObjectives && review.improvementObjectives.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">
                Agreed Improvement Objectives
              </h4>
              <div className="space-y-2">
                {review.improvementObjectives.map((obj, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between p-2.5 rounded bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 text-xs"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {i + 1}. {obj.objective}
                    </span>
                    {obj.targetDate && (
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold ml-2 whitespace-nowrap">
                        Target: {new Date(obj.targetDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Already Acknowledged Check */}
          {review.employeeAcknowledged ? (
            <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-sm font-semibold mb-1">
                <CheckCircle className="w-4 h-4" /> Already Acknowledged
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                Acknowledged on {new Date(review.employeeAcknowledgedAt).toLocaleString()}
              </p>
              {review.employeeResponse && (
                <div className="mt-2 text-xs bg-white dark:bg-slate-900 p-2.5 rounded border border-emerald-200 dark:border-emerald-800/60">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Your Response:
                  </span>
                  <p className="mt-1 text-slate-600 dark:text-slate-400">
                    {review.employeeResponse}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Acknowledgement Submission Form */
            <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Your Response / Explanation / Comments (Optional)
                </label>
                <textarea
                  rows={3}
                  value={employeeResponse}
                  onChange={(e) => setEmployeeResponse(e.target.value)}
                  placeholder="Provide any feedback, clarifications, or commitments regarding this review..."
                  className="w-full text-xs p-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm">
                  By clicking acknowledge, your response will be appended to the official review record.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={acknowledgeMutation.isLoading}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {acknowledgeMutation.isLoading
                      ? "Submitting..."
                      : "Submit Acknowledgement"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeAcknowledgeModal;
