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
import { ProcessStepModal } from "./ProcessStepModal";
import { useOrgUsers, useOrgForms } from "@/hooks/useProcessBuilder";
import {
  Plus,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  Layers,
  Clock,
  UserCheck,
  FileText,
  ShieldCheck,
  ListTodo,
  Flag,
  Sparkles,
  Mail,
} from "lucide-react";

export function ProcessBuilderForm({
  isOpen,
  onClose,
  onSubmit,
  processToEdit = null,
  isSubmitting = false,
}) {
  const { data: orgUsers = [] } = useOrgUsers();
  const { data: orgForms = [] } = useOrgForms();

  const [nameOfProcess, setNameOfProcess] = useState("");
  const [descriptionOfProcess, setDescriptionOfProcess] = useState("");
  const [steps, setSteps] = useState([]);
  const [errors, setErrors] = useState({});

  const [isStepModalOpen, setIsStepModalOpen] = useState(false);
  const [editingStepIndex, setEditingStepIndex] = useState(null);
  const [stepToEdit, setStepToEdit] = useState(null);

  useEffect(() => {
    if (processToEdit) {
      setNameOfProcess(processToEdit.name || "");
      setDescriptionOfProcess(processToEdit.description || "");
      setSteps(processToEdit.steps ? [...processToEdit.steps] : []);
    } else {
      setNameOfProcess("");
      setDescriptionOfProcess("");
      setSteps([]);
    }
    setErrors({});
  }, [processToEdit, isOpen]);

  const handleAddStepClick = () => {
    setEditingStepIndex(null);
    setStepToEdit(null);
    setIsStepModalOpen(true);
  };

  const handleEditStepClick = (index) => {
    setEditingStepIndex(index);
    setStepToEdit(steps[index]);
    setIsStepModalOpen(true);
  };

  const handleSaveStep = (stepData) => {
    if (editingStepIndex !== null) {
      const updated = [...steps];
      updated[editingStepIndex] = stepData;
      setSteps(updated);
    } else {
      setSteps([...steps, stepData]);
    }
  };

  const handleDeleteStep = (index) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleMoveStep = (index, direction) => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === steps.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const updated = [...steps];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setSteps(updated);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!nameOfProcess.trim()) {
      newErrors.nameOfProcess = "Name of process is required";
    }
    if (!descriptionOfProcess.trim()) {
      newErrors.descriptionOfProcess = "Description of process is required";
    }
    if (steps.length === 0) {
      newErrors.steps = "Please add at least one step to the process";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload = {
      name: nameOfProcess.trim(),
      description: descriptionOfProcess.trim(),
      steps,
    };

    onSubmit(payload);
  };

  const getUserName = (assignedUser) => {
    if (!assignedUser) return "Unassigned";

    const userIdStr = String(
      typeof assignedUser === "object"
        ? assignedUser?.value || assignedUser?.id || assignedUser?._id || ""
        : assignedUser
    ).trim();

    if (userIdStr) {
      const user = orgUsers.find((u) => {
        if (!u) return false;
        const uId = String(u.id || u._id || u.value || "").trim();
        return uId === userIdStr;
      });

      if (user) {
        const roleStr = Array.isArray(user.role) ? user.role.join(", ") : user.role || "";
        return `${user.name || user.label || "User"}${roleStr ? ` (${roleStr})` : ""}`;
      }
    }

    if (typeof assignedUser === "object" && assignedUser !== null) {
      if (assignedUser.name) {
        const role = Array.isArray(assignedUser.role)
          ? assignedUser.role.join(", ")
          : assignedUser.role || "";
        return `${assignedUser.name}${role ? ` (${role})` : ""}`;
      }
      if (assignedUser.label && assignedUser.label !== "Self") {
        return assignedUser.label;
      }
    }

    return userIdStr ? `User #${userIdStr}` : "Self";
  };

  const getFormTitle = (formId) => {
    if (!formId) return null;
    const form = orgForms.find((f) => String(f.id) === String(formId));
    return form ? form.title : `Form (${formId})`;
  };

  const getTaskTypeBadge = (step) => {
    const type = typeof step === "string" ? step : step?.taskType;
    switch (type) {
      case "Approval":
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 gap-1">
            <ShieldCheck className="w-3 h-3" /> Approval
          </Badge>
        );
      case "Milestone": {
        const isLinked =
          step?.milestoneType === "linked" ||
          (Array.isArray(step?.linkedTasks) && step.linkedTasks.length > 0);
        return (
          <Badge className="bg-amber-50 text-amber-700 border border-amber-200 gap-1">
            <Flag className="w-3 h-3" /> {isLinked ? "Linked Milestone" : "Standalone Milestone"}
          </Badge>
        );
      }
      case "Email":
        return (
          <Badge className="bg-purple-50 text-purple-700 border border-purple-200 gap-1">
            <Mail className="w-3 h-3" /> Email
          </Badge>
        );
      default:
        return (
          <Badge className="bg-blue-50 text-blue-700 border border-blue-200 gap-1">
            <ListTodo className="w-3 h-3" /> Regular
          </Badge>
        );
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col bg-white text-gray-900 border-gray-200 shadow-xl p-0 overflow-hidden rounded-md">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-gray-200 bg-gray-50/80">
            <DialogTitle className="text-xl font-normal text-gray-800 flex items-center gap-2" style={{ color: "#676a6c" }}>
              <Layers className="w-5 h-5 text-indigo-600" />
              {processToEdit ? "Edit Process Builder" : "Create Process Builder"}
            </DialogTitle>
            <p className="text-xs text-blue-600 mt-0.5">
              Define the process flow, add steps, assign users, and attach pre-existing forms.
            </p>
          </DialogHeader>

          <form
            onSubmit={handleFormSubmit}
            className="flex-1 overflow-y-auto px-6 py-4 space-y-5"
          >
            {/* Name of Process */}
            <div className="space-y-1.5">
              <Label
                htmlFor="nameOfProcess"
                className="text-xs font-semibold text-gray-700 uppercase tracking-wider"
              >
                Name of Process <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nameOfProcess"
                placeholder="e.g. Employee Onboarding Workflow, Invoice Approval Process"
                value={nameOfProcess}
                onChange={(e) => setNameOfProcess(e.target.value)}
                className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 text-sm"
              />
              {errors.nameOfProcess && (
                <p className="text-xs text-red-500 mt-1">{errors.nameOfProcess}</p>
              )}
            </div>

            {/* Description of Process */}
            <div className="space-y-1.5">
              <Label
                htmlFor="descriptionOfProcess"
                className="text-xs font-semibold text-gray-700 uppercase tracking-wider"
              >
                Description of Process <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="descriptionOfProcess"
                rows={3}
                placeholder="Describe the purpose and objective of this process builder..."
                value={descriptionOfProcess}
                onChange={(e) => setDescriptionOfProcess(e.target.value)}
                className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 text-sm resize-none"
              />
              {errors.descriptionOfProcess && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.descriptionOfProcess}
                </p>
              )}
            </div>

            {/* Steps of Process Section */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" /> Steps of Process
                  </h3>
                  <p className="text-xs text-gray-500">
                    Add and order the steps executed when this process is started.
                  </p>
                </div>
                {/* add (button) */}
                <Button
                  type="button"
                  onClick={handleAddStepClick}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium gap-1 h-8 px-3 shadow-xs"
                >
                  <Plus className="w-4 h-4" /> Add Step
                </Button>
              </div>

              {errors.steps && (
                <p className="text-xs text-red-500 font-medium">
                  {errors.steps}
                </p>
              )}

              {/* Steps List */}
              {steps.length === 0 ? (
                <div className="border border-dashed border-gray-300 rounded p-6 text-center bg-gray-50/60">
                  <Layers className="w-8 h-8 text-gray-400 mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-gray-700 font-medium">
                    No steps added to this process yet.
                  </p>
                  <p className="text-xs text-gray-500 mt-1 mb-3">
                    Click the <strong>Add Step</strong> button to configure task types, assign users, and set due days.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddStepClick}
                    className="border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50"
                  >
                    <Plus className="w-4 h-4 mr-1.5" /> Add First Step
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {steps.map((step, index) => {
                    const formTitle = getFormTitle(step.formId);
                    return (
                      <div
                        key={step.id || index}
                        className="flex items-start gap-3 p-3 rounded border border-gray-200 bg-gray-50/80 hover:bg-white hover:border-gray-300 transition-all shadow-2xs"
                      >
                        {/* Step Number Circle */}
                        <div className="w-6 h-6 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {index + 1}
                        </div>

                        {/* Step Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-gray-900 text-sm">
                              {step.name}
                            </span>
                            {getTaskTypeBadge(step)}
                            {step.approvalRequired && (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 border-emerald-200 text-emerald-700 text-[10px]"
                              >
                                Approval Required
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap">
                            <span className="flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                              {getUserName(step.assignedUserId)}
                            </span>

                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              Due: +{step.dueDays} {step.dueDays === 1 ? "day" : "days"}
                            </span>

                            {formTitle && (
                              <span className="flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                <FileText className="w-3.5 h-3.5 text-blue-600" />
                                {formTitle}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Step Action Buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveStep(index, "up")}
                            disabled={index === 0}
                            className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-30"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveStep(index, "down")}
                            disabled={index === steps.length - 1}
                            className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-30"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditStepClick(index)}
                            className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                            title="Edit Step"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStep(index)}
                            className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                            title="Delete Step"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <DialogFooter className="border-t border-gray-200 pt-4 px-0 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="border-gray-300 text-gray-700 hover:bg-gray-50 h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium h-9 px-4 shadow-sm"
              >
                {isSubmitting
                  ? "Saving..."
                  : processToEdit
                  ? "Save Process Changes"
                  : "Create Process"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ProcessStepModal
        isOpen={isStepModalOpen}
        onClose={() => setIsStepModalOpen(false)}
        onSave={handleSaveStep}
        stepToEdit={stepToEdit}
        existingSteps={steps}
        stepIndex={
          editingStepIndex !== null ? editingStepIndex : steps.length
        }
      />
    </>
  );
}
