import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Users,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Info,
} from "lucide-react";

const SUGGESTIONS = {
  dueDate: [
    "Awaiting client feedback",
    "Blocked by external dependency",
    "Scope increased",
    "Timeline adjustment needed",
  ],
  status: [
    "Requirements fulfilled",
    "Pending external review",
    "Testing completed",
    "Blocked on blocker task",
  ],
  priority: [
    "Urgent business priority",
    "Client escalated issue",
    "De-prioritized by stakeholder",
    "Critical blocker discovered",
  ],
  assignedTo: [
    "Workload rebalancing",
    "Requires domain specialist",
    "Reassigned per team lead",
    "Covering for absent teammate",
  ],
};

export default function TaskChangeReasonModal({
  isOpen,
  onClose,
  taskTitle = "Task",
  field = "dueDate",
  fieldName = "Due Date",
  currentValue = "",
  requestedValue = "",
  onSubmit,
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setError("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getFieldIcon = () => {
    switch (field) {
      case "dueDate":
        return <Calendar className="w-5 h-5 text-blue-600" />;
      case "status":
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case "priority":
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case "assignedTo":
        return <Users className="w-5 h-5 text-purple-600" />;
      default:
        return <ShieldAlert className="w-5 h-5 text-blue-600" />;
    }
  };

  const suggestions = SUGGESTIONS[field] || [];

  const handleSuggestionClick = (text) => {
    setReason((prev) => (prev ? `${prev.trim()} - ${text}` : text));
    setError("");
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Please provide a reason for the task creator to review.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      await onSubmit(trimmed);
      onClose();
    } catch (err) {
      console.error("Failed to submit change request:", err);
      setError(err?.message || "Failed to submit change request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-w-md sm:max-w-lg p-0 overflow-hidden border border-slate-200 shadow-xl rounded-xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-slate-50 border-b border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white shadow-sm border border-slate-200/80 rounded-xl">
              {getFieldIcon()}
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                Request {fieldName} Change
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                Task: <span className="font-semibold text-slate-700">{taskTitle}</span>
              </DialogDescription>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Policy Notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50/70 border border-blue-200/80 text-xs text-blue-900 leading-relaxed">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>Approval Policy:</strong> Your organization requires the task creator’s approval
              before updating this field. Your reason will be displayed in the creator’s approval review modal.
            </div>
          </div>

          {/* Value Comparison Card */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-lg p-3.5 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Proposed Changes
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="flex-1 min-w-0">
                <span className="block text-[11px] text-slate-500">Current</span>
                <span className="font-semibold text-slate-500 line-through truncate block">
                  {currentValue || "Not set"}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0 text-right">
                <span className="block text-[11px] text-emerald-700 font-medium">Requested</span>
                <span className="font-bold text-emerald-600 truncate block">
                  {requestedValue || "Not set"}
                </span>
              </div>
            </div>
          </div>

          {/* Reason Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="changeReason" className="text-xs font-bold text-slate-800">
                Employee's Reason <span className="text-rose-500">*</span>
              </Label>
              <span className="text-[11px] text-slate-400">
                {reason.length} / 500 characters
              </span>
            </div>

            <Textarea
              id="changeReason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError("");
              }}
              rows={3}
              maxLength={500}
              placeholder={`Provide the reason for changing the ${fieldName.toLowerCase()}...`}
              className={`text-xs resize-none focus:ring-2 focus:ring-blue-500 ${
                error ? "border-rose-400 focus:ring-rose-200" : "border-slate-300"
              }`}
              autoFocus
              disabled={isSubmitting}
            />

            {error && (
              <p className="text-xs text-rose-600 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </p>
            )}

            {/* Quick Suggestions */}
            {suggestions.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] text-slate-500 font-medium block">
                  Quick suggestions:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((text, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleSuggestionClick(text)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-200 transition-colors"
                    >
                      + {text}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs h-9 px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !reason.trim()}
              className="text-xs h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Submitting Request...
                </>
              ) : (
                "Submit for Approval"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
