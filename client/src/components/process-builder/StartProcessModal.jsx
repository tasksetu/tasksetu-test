import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useOrgUsers, useOrgForms } from "@/hooks/useProcessBuilder";
import { ProcessStepModal } from "./ProcessStepModal";
import {
  Play,
  Layers,
  Clock,
  UserCheck,
  FileText,
  Pencil,
  Trash2,
  Mail,
  ShieldCheck,
  Target,
  Sparkles,
  Link2,
  CheckCircle2,
  Info,
} from "lucide-react";

export function StartProcessModal({
  isOpen,
  onClose,
  process,
  onConfirmLaunch,
  isStarting = false,
}) {
  const { data: orgUsers = [] } = useOrgUsers();
  const { data: orgForms = [] } = useOrgForms();
  const [customName, setCustomName] = useState("");
  const [notes, setNotes] = useState("");
  const [stepsToRun, setStepsToRun] = useState([]);
  const [editingStepIndex, setEditingStepIndex] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [modifiedStepIndices, setModifiedStepIndices] = useState(new Set());
  const [removedCount, setRemovedCount] = useState(0);

  useEffect(() => {
    if (isOpen && process) {
      setCustomName("");
      setNotes("");
      const initialSteps = Array.isArray(process.steps)
        ? JSON.parse(JSON.stringify(process.steps))
        : [];
      setStepsToRun(initialSteps);
      setEditingStepIndex(null);
      setIsEditModalOpen(false);
      setModifiedStepIndices(new Set());
      setRemovedCount(0);
    }
  }, [isOpen, process]);

  if (!process) return null;

  const handleLaunch = (e) => {
    e.preventDefault();
    onConfirmLaunch({
      processId: process.id || process._id,
      customName: customName.trim() || process.name,
      notes: notes.trim(),
      steps: stepsToRun,
    });
  };

  const getUserName = (userId) => {
    if (!userId) return "Unassigned";
    const val = typeof userId === "object" ? userId.value || userId.id || userId._id : userId;
    const user = orgUsers.find((u) => String(u.id || u._id) === String(val));
    return user ? user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() : `User #${val}`;
  };

  const getFormTitle = (formId) => {
    if (!formId || formId === "none") return null;
    const form = orgForms.find((f) => String(f.id || f._id) === String(formId));
    return form ? form.title : null;
  };

  const getApproverNames = (approvers) => {
    if (!Array.isArray(approvers) || approvers.length === 0) return null;
    const names = approvers.map((app) => {
      const val = typeof app === "object" ? app.value || app.id || app._id : app;
      if (val === "self") return "Current User";
      const u = orgUsers.find((user) => String(user.id || user._id) === String(val));
      return u ? u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim() : `User #${val}`;
    });
    return names.join(", ");
  };

  const handleOpenEditStep = (idx) => {
    setEditingStepIndex(idx);
    setIsEditModalOpen(true);
  };

  const handleSaveEditedStep = (updatedStepData) => {
    if (editingStepIndex === null) return;
    setStepsToRun((prev) => {
      const next = [...prev];
      next[editingStepIndex] = {
        ...next[editingStepIndex],
        ...updatedStepData,
      };
      return next;
    });
    setModifiedStepIndices((prev) => new Set(prev).add(editingStepIndex));
    setIsEditModalOpen(false);
    setEditingStepIndex(null);
  };

  const handleRemoveStep = (idxToRemove) => {
    if (stepsToRun.length <= 1) return;
    setStepsToRun((prev) => prev.filter((_, idx) => idx !== idxToRemove));
    setRemovedCount((prev) => prev + 1);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px] max-h-[88vh] flex flex-col bg-white text-gray-900 border-gray-200 shadow-xl p-0 overflow-hidden rounded-lg">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-gray-200 bg-gray-50/90">
            <DialogTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <Play className="w-5 h-5 fill-emerald-600 text-emerald-600" /> Start Process Instance
            </DialogTitle>
            <p className="text-xs text-blue-600 mt-0.5">
              Review and customize instance settings or step parameters before launching.
            </p>
          </DialogHeader>

          <form onSubmit={handleLaunch} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Template Info Card */}
            <div className="p-3.5 rounded-lg border border-indigo-100 bg-indigo-50/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-indigo-700 uppercase font-bold tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Process Template
                </span>
                <Badge variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50 text-[10px]">
                  {stepsToRun.length} Steps Configured
                </Badge>
              </div>
              <h4 className="text-sm font-bold text-gray-900">{process.name}</h4>
              {process.description && (
                <p className="text-xs text-gray-600 line-clamp-2">{process.description}</p>
              )}
            </div>

            {/* Instance Name Input */}
            <div className="space-y-1.5">
              <Label htmlFor="customName" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Instance Name / Title
              </Label>
              <Input
                id="customName"
                placeholder={process.name}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="bg-white border-gray-300 text-gray-900 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
              />
              <p className="text-[11px] text-gray-500">
                Give this active run a unique identifier or leave blank to use default template title.
              </p>
            </div>

            {/* Steps Sequence Preview with Edit & Delete Buttons */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-600" /> Sequence of Executed Steps
                </Label>
                <div className="flex items-center gap-1.5">
                  {modifiedStepIndices.size > 0 && (
                    <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px]">
                      {modifiedStepIndices.size} modified
                    </Badge>
                  )}
                  {removedCount > 0 && (
                    <Badge className="bg-red-100 text-red-800 border border-red-200 text-[10px]">
                      {removedCount} removed
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {stepsToRun.map((step, idx) => {
                  const formTitle = getFormTitle(step.formId);
                  const isModified = modifiedStepIndices.has(idx);
                  const typeLower = (step.taskType || "regular").toLowerCase();
                  const approverNames = getApproverNames(step.approvers || step.approverIds);

                  return (
                    <div
                      key={step.id || idx}
                      className={`p-3 rounded-lg border transition-all ${
                        isModified
                          ? "border-amber-300 bg-amber-50/30"
                          : "border-gray-200 bg-white hover:border-gray-300 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div className="w-5 h-5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </div>

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900 text-xs truncate">
                                {step.name || step.title || `Step #${idx + 1}`}
                              </span>

                              <Badge
                                variant="outline"
                                className={`text-[9px] px-1.5 py-0 ${
                                  typeLower === "approval"
                                    ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                                    : typeLower === "milestone"
                                    ? "border-amber-200 text-amber-700 bg-amber-50"
                                    : typeLower === "email"
                                    ? "border-purple-200 text-purple-700 bg-purple-50"
                                    : "border-blue-200 text-blue-700 bg-blue-50"
                                }`}
                              >
                                {step.taskType || "Regular"}
                              </Badge>

                              {isModified && (
                                <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-800 bg-amber-100">
                                  Edited
                                </Badge>
                              )}
                            </div>

                            {/* Step Description Preview */}
                            {step.description && (
                              <p className="text-[11px] text-gray-500 line-clamp-1">
                                {step.description.replace(/<[^>]*>/g, "")}
                              </p>
                            )}

                            {/* Metadata Badges */}
                            <div className="flex items-center gap-3 text-[11px] text-gray-500 flex-wrap pt-0.5">
                              <span className="flex items-center gap-1 font-medium text-gray-700">
                                <UserCheck className="w-3 h-3 text-indigo-600" />
                                {getUserName(step.assignedUserId)}
                              </span>

                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600" />
                                Due in +{step.dueDays ?? 3} days
                              </span>

                              {step.priority && (
                                <span className="capitalize text-gray-600">
                                  Priority: <strong>{step.priority}</strong>
                                </span>
                              )}

                              {formTitle && (
                                <span className="flex items-center gap-1 text-blue-700 font-medium">
                                  <FileText className="w-3 h-3" />
                                  {formTitle}
                                </span>
                              )}

                              {/* Type Specific Preview */}
                              {typeLower === "email" && step.emailConfig && (
                                <span className="flex items-center gap-1 text-purple-700 font-medium">
                                  <Mail className="w-3 h-3" />
                                  {step.emailConfig.recipients?.length || 0} Recipient(s)
                                </span>
                              )}

                              {typeLower === "approval" && approverNames && (
                                <span className="flex items-center gap-1 text-emerald-700 font-medium">
                                  <ShieldCheck className="w-3 h-3" />
                                  Approvers: {approverNames}
                                </span>
                              )}

                              {typeLower === "milestone" && (
                                <span className="flex items-center gap-1 text-amber-700 font-medium">
                                  <Target className="w-3 h-3" />
                                  Milestone ({step.milestoneType || "standalone"})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons: Edit Step & Delete Step */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditStep(idx)}
                            className="h-7 px-2 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 gap-1 font-medium"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit Step
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveStep(idx)}
                            disabled={stepsToRun.length <= 1}
                            title={
                              stepsToRun.length <= 1
                                ? "At least one step is required to launch a process"
                                : "Remove step for this launch"
                            }
                            className="h-7 w-7 p-0 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Launch Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Launch Notes (Optional)
              </Label>
              <Textarea
                id="notes"
                rows={2}
                placeholder="Add contextual details or instructions for assigned team members..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:ring-emerald-500 text-sm resize-none"
              />
            </div>

            <DialogFooter className="border-t border-gray-200 pt-4 px-0 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isStarting}
                className="border-gray-300 text-gray-700 hover:bg-gray-50 h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isStarting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium h-8 px-4 text-xs gap-1.5 shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                {isStarting ? "Launching..." : "Confirm & Launch Process"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Step Modal for Final Launch Tweaks */}
      {editingStepIndex !== null && (
        <ProcessStepModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingStepIndex(null);
          }}
          stepToEdit={stepsToRun[editingStepIndex]}
          stepIndex={editingStepIndex}
          existingSteps={stepsToRun}
          onSave={handleSaveEditedStep}
        />
      )}
    </>
  );
}

