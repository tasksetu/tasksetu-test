import React, { useState, useEffect, useMemo } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useOrgUsers, useOrgForms } from "@/hooks/useProcessBuilder";
import { useAuth } from "@/features/shared/hooks/useAuth";
import {
  Clock,
  FileText,
  UserCheck,
  Zap,
  Flag,
  ShieldCheck,
  ListTodo,
  Mail,
  Target,
  X,
} from "lucide-react";

import ProcessStandardStepForm from "./forms/ProcessStandardStepForm";
import ProcessEmailStepForm from "./forms/ProcessEmailStepForm";
import ProcessMilestoneStepForm from "./forms/ProcessMilestoneStepForm";
import ProcessApprovalStepForm from "./forms/ProcessApprovalStepForm";

export function ProcessStepModal({
  isOpen,
  onClose,
  onSave,
  stepToEdit = null,
  stepIndex = 0,
  existingSteps = [],
}) {
  const { user: currentUser } = useAuth();
  const { data: orgUsers = [] } = useOrgUsers();
  const { data: orgForms = [] } = useOrgForms();

  const previousSteps = useMemo(() => {
    if (!Array.isArray(existingSteps) || existingSteps.length === 0) return [];
    return existingSteps
      .slice(0, stepIndex)
      .filter((st) => st && (st.id || st._id) !== (stepToEdit?.id || stepToEdit?._id));
  }, [existingSteps, stepIndex, stepToEdit]);

  const detectTaskType = (step) => {
    if (!step) return "regular";
    let typeLower = (step.subtaskType || step.taskType || "regular").toLowerCase();
    if (step.isApprovalTask || step.approvalRequired || typeLower === "approval") return "approval";
    if (step.isMilestone || typeLower === "milestone") return "milestone";
    if (step.emailConfig || step.emailSubject || typeLower === "email") return "email";
    return typeLower;
  };

  const [taskType, setTaskType] = useState(() => detectTaskType(stepToEdit));
  const [stepName, setStepName] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [dueDays, setDueDays] = useState(3);
  const [priority, setPriority] = useState("Medium");
  const [status, setStatus] = useState("Open");
  const [visibility, setVisibility] = useState("Private");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");

  const [approvalRequired, setApprovalRequired] = useState(false);
  const [formId, setFormId] = useState("none");
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen) return;

    const initialType = detectTaskType(stepToEdit);
    setTaskType(initialType);

    if (stepToEdit) {
      setStepName(stepToEdit.name || stepToEdit.title || "");
      setAssignedUserId(
        stepToEdit.assignedUserId ? String(stepToEdit.assignedUserId) : ""
      );
      setDueDays(stepToEdit.dueDays ?? 3);
      setPriority(stepToEdit.priority || "Medium");
      setStatus(stepToEdit.status || "Open");
      setVisibility(stepToEdit.visibility || "Private");
      setDescription(stepToEdit.description || "");
      setTags(Array.isArray(stepToEdit.tags) ? stepToEdit.tags : []);
      setApprovalRequired(!!stepToEdit.approvalRequired);
      setFormId(stepToEdit.formId || "none");
    } else {
      setStepName("");
      setAssignedUserId(orgUsers[0] ? String(orgUsers[0].id) : "");
      setDueDays(3);
      setPriority("Medium");
      setStatus("Open");
      setVisibility("Private");
      setDescription("");
      setTags([]);
      setApprovalRequired(false);
      setFormId("none");
    }
    setTagInput("");
    setErrors({});
  }, [stepToEdit, isOpen]);

  const handleAddTag = (e) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().replace(/^#/, "");
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleStandardSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!stepName.trim()) {
      newErrors.stepName = "Sub-task title is required";
    }
    if (!assignedUserId) {
      newErrors.assignedUserId = "Please select an assignee";
    }
    if (dueDays < 0 || dueDays === "" || isNaN(dueDays)) {
      newErrors.dueDays = "Please enter valid due days";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const stepData = {
      id: stepToEdit?.id || `step_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      taskType: "Regular",
      name: stepName.trim(),
      assignedUserId: Number(assignedUserId) || assignedUserId,
      dueDays: Number(dueDays),
      priority,
      status,
      visibility,
      description: description.trim(),
      tags,
      approvalRequired: Boolean(approvalRequired),
      formId: formId === "none" ? null : formId,
    };

    onSave(stepData);
    onClose();
  };

  const handleSpecialSubtaskSubmit = (type, data) => {
    const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
    const stepTitle = data.title || data.name || stepName || "Untitled Subtask Step";
    const assigneeVal = data.assignedTo || data.assignee || assignedUserId || (orgUsers[0] ? orgUsers[0].id : "");

    const stepData = {
      id: stepToEdit?.id || `step_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      taskType: capitalizedType,
      name: String(stepTitle).trim(),
      assignedUserId: typeof assigneeVal === "object" ? assigneeVal.value || assigneeVal.id : assigneeVal,
      dueDays: Number(dueDays || 3),
      priority: data.priority || priority || "Medium",
      status: data.status || status || "Open",
      visibility: data.visibility || visibility || "Private",
      description: data.description || description || "",
      tags: data.tags || tags || [],
      approvalRequired: type === "approval" || Boolean(data.approvalRequired),
      formId: data.attachedFormId || data.formId || (formId === "none" ? null : formId),
      emailConfig: data.emailConfig || null,
      emailSubject: data.emailConfig?.subject || data.emailSubject || "",
      emailBody: data.emailConfig?.body || data.emailBody || "",
      emailAutoComplete: Boolean(data.emailConfig?.autoComplete || data.emailAutoComplete),
      approvalInstructions: data.approvalContext || data.context || data.approvalInstructions || "",
      milestoneNotes: data.milestoneType || data.milestoneNotes || "",
    };

    onSave(stepData);
    onClose();
  };

  const parentTaskMock = useMemo(() => {
    return {
      _id: `parent_${stepIndex + 1}`,
      id: `parent_${stepIndex + 1}`,
      title: `Process Step #${stepIndex + 1}`,
    };
  }, [stepIndex]);

  const formattedEditData = useMemo(() => {
    if (!stepToEdit) return null;
    return {
      ...stepToEdit,
      _id: stepToEdit.id,
      title: stepToEdit.name || stepToEdit.title || "",
      assignedTo: stepToEdit.assignedUserId || "",
      dueDate: stepToEdit.dueDays ? new Date(Date.now() + stepToEdit.dueDays * 86400000).toISOString() : "",
      priority: stepToEdit.priority || "medium",
      description: stepToEdit.description || "",
      approvalContext: stepToEdit.approvalInstructions || "",
      milestoneType: stepToEdit.milestoneNotes || "",
    };
  }, [stepToEdit]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[650px] max-h-[92vh] flex flex-col bg-white text-gray-900 border-gray-200 shadow-2xl p-0 overflow-hidden rounded-lg">
        {/* Header matching TaskSetu Subtask Drawer */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-gray-200 bg-gray-50/90">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-indigo-600" />
              {stepToEdit ? `Edit Step #${stepIndex + 1}` : "Add Step"}
            </DialogTitle>
          </div>
          <p className="text-xs text-blue-600 font-medium mt-0.5">
            + Process Step :- Step #{stepIndex + 1}
          </p>

          {/* Subtask Type Selector Tabs - Only show when creating a NEW step */}
          {!stepToEdit ? (
            <div className="flex items-center gap-1 mt-3 p-1 bg-gray-200/70 rounded-lg border border-gray-200">
              {[
                { id: "regular", label: "Regular task", icon: ListTodo },
                { id: "email", label: "Email task", icon: Mail },
                { id: "milestone", label: "Milestone task", icon: Target },
                { id: "approval", label: "Approval task", icon: ShieldCheck },
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = taskType === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTaskType(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-semibold rounded-md transition-all ${
                      isSelected
                        ? "bg-white text-indigo-700 shadow-xs border border-gray-200"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-indigo-600" : "text-gray-500"}`} />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-xs px-2.5 py-0.5 font-semibold ${
                  taskType === "approval"
                    ? "border-emerald-300 text-emerald-800 bg-emerald-50"
                    : taskType === "milestone"
                    ? "border-amber-300 text-amber-800 bg-amber-50"
                    : taskType === "email"
                    ? "border-purple-300 text-purple-800 bg-purple-50"
                    : "border-blue-300 text-blue-800 bg-blue-50"
                }`}
              >
                {taskType === "approval"
                  ? "Approval Task Edit"
                  : taskType === "milestone"
                  ? "Milestone Task Edit"
                  : taskType === "email"
                  ? "Email Task Edit"
                  : "Regular Task Edit"}
              </Badge>
            </div>
          )}
        </DialogHeader>

        {/* Tab content rendering */}
        {taskType === "email" ? (
          <ProcessEmailStepForm
            key={stepToEdit?.id || `step_${stepIndex}_email`}
            stepToEdit={stepToEdit}
            onClose={onClose}
            previousSteps={previousSteps}
            onSubmit={(data) => {
              onSave(data);
              onClose();
            }}
          />
        ) : taskType === "milestone" ? (
          <ProcessMilestoneStepForm
            key={stepToEdit?.id || `step_${stepIndex}_milestone`}
            stepToEdit={stepToEdit}
            onClose={onClose}
            previousSteps={previousSteps}
            onSubmit={(data) => {
              onSave(data);
              onClose();
            }}
          />
        ) : taskType === "approval" ? (
          <ProcessApprovalStepForm
            key={stepToEdit?.id || `step_${stepIndex}_approval`}
            stepToEdit={stepToEdit}
            onClose={onClose}
            previousSteps={previousSteps}
            onSubmit={(data) => {
              onSave(data);
              onClose();
            }}
          />
        ) : (
          <ProcessStandardStepForm
            key={stepToEdit?.id || `step_${stepIndex}_regular`}
            stepToEdit={stepToEdit}
            onClose={onClose}
            previousSteps={previousSteps}
            onSubmit={(data) => {
              onSave(data);
              onClose();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
