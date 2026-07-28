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
import {
  Clock,
  FileText,
  UserCheck,
  Zap,
  Flag,
  ShieldCheck,
  ListTodo,
} from "lucide-react";

export function ProcessStepModal({
  isOpen,
  onClose,
  onSave,
  stepToEdit = null,
  stepIndex = 0,
}) {
  const { data: orgUsers = [] } = useOrgUsers();
  const { data: orgForms = [] } = useOrgForms();

  const [taskType, setTaskType] = useState("Regular");
  const [stepName, setStepName] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [dueDays, setDueDays] = useState(3);
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [formId, setFormId] = useState("none");
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (stepToEdit) {
      setTaskType(stepToEdit.taskType || "Regular");
      setStepName(stepToEdit.name || "");
      setAssignedUserId(
        stepToEdit.assignedUserId ? String(stepToEdit.assignedUserId) : ""
      );
      setDueDays(stepToEdit.dueDays ?? 3);
      setApprovalRequired(!!stepToEdit.approvalRequired);
      setFormId(stepToEdit.formId || "none");
    } else {
      setTaskType("Regular");
      setStepName("");
      setAssignedUserId(orgUsers[0] ? String(orgUsers[0].id) : "");
      setDueDays(3);
      setApprovalRequired(false);
      setFormId("none");
    }
    setErrors({});
  }, [stepToEdit, isOpen, orgUsers]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!stepName.trim()) {
      newErrors.stepName = "Name of step is required";
    }
    if (!assignedUserId) {
      newErrors.assignedUserId = "Please select an assigned user";
    }
    if (dueDays < 0 || dueDays === "" || isNaN(dueDays)) {
      newErrors.dueDays = "Please enter a valid number of due days";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const stepData = {
      id: stepToEdit?.id || `step_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      taskType,
      name: stepName.trim(),
      assignedUserId: Number(assignedUserId),
      dueDays: Number(dueDays),
      approvalRequired: Boolean(approvalRequired),
      formId: formId === "none" ? null : formId,
    };

    onSave(stepData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[560px] bg-white text-gray-900 border-gray-200 shadow-xl p-0 overflow-hidden rounded-md">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-gray-200 bg-gray-50/80">
          <DialogTitle className="text-xl font-normal text-gray-800 flex items-center gap-2" style={{ color: "#676a6c" }}>
            {stepToEdit ? (
              <>
                <ListTodo className="w-5 h-5 text-indigo-600" /> Edit Step #{stepIndex + 1}
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 text-indigo-600" /> Add Step #{stepIndex + 1} to Process
              </>
            )}
          </DialogTitle>
          <p className="text-xs text-blue-600 mt-0.5">
            Configure step details, assign users, set due days offset, and attach forms.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Task Type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center justify-between">
              <span>Task Type</span>
              <span className="text-[11px] text-gray-400 font-normal lowercase">
                (regular, milestone, approval)
              </span>
            </Label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                {
                  id: "Regular",
                  label: "Regular",
                  icon: ListTodo,
                  desc: "Standard action",
                  color: "border-blue-200 bg-blue-50/70 text-blue-700",
                },
                {
                  id: "Milestone",
                  label: "Milestone",
                  icon: Flag,
                  desc: "Key checkpoint",
                  color: "border-amber-200 bg-amber-50/70 text-amber-700",
                },
                {
                  id: "Approval",
                  label: "Approval",
                  icon: ShieldCheck,
                  desc: "Requires sign-off",
                  color: "border-emerald-200 bg-emerald-50/70 text-emerald-700",
                },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = taskType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTaskType(item.id);
                      if (item.id === "Approval") {
                        setApprovalRequired(true);
                      }
                    }}
                    className={`flex flex-col items-center justify-center p-2.5 rounded border text-left transition-all ${
                      isSelected
                        ? `${item.color} ring-2 ring-indigo-500 font-semibold shadow-2xs`
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="w-4 h-4 mb-1" />
                    <span className="text-xs">{item.label}</span>
                    <span className="text-[10px] text-gray-500">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name of Step */}
          <div className="space-y-1.5">
            <Label htmlFor="stepName" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Name of Step <span className="text-red-500">*</span>
            </Label>
            <Input
              id="stepName"
              placeholder="e.g. Document Verification, Manager Review"
              value={stepName}
              onChange={(e) => setStepName(e.target.value)}
              className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 text-sm"
            />
            {errors.stepName && (
              <p className="text-xs text-red-500 mt-1">{errors.stepName}</p>
            )}
          </div>

          {/* Assigned User */}
          <div className="space-y-1.5">
            <Label htmlFor="assignedUser" className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-indigo-600" /> Assigned User (Section){" "}
              <span className="text-red-500">*</span>
            </Label>
            <Select
              value={assignedUserId}
              onValueChange={(val) => setAssignedUserId(val)}
            >
              <SelectTrigger className="bg-white border-gray-300 text-gray-900 focus:ring-blue-500 text-xs">
                <SelectValue placeholder="Select user from organization" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 text-gray-900">
                {orgUsers.map((user) => (
                  <SelectItem key={user.id} value={String(user.id)} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{user.name}</span>
                      <span className="text-gray-500">({user.role})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.assignedUserId && (
              <p className="text-xs text-red-500 mt-1">{errors.assignedUserId}</p>
            )}
            <p className="text-[11px] text-gray-500">
              List of existing users in your organization.
            </p>
          </div>

          {/* Due Days & Approval Switch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Due Days */}
            <div className="space-y-1.5">
              <Label htmlFor="dueDays" className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" /> Due Days <span className="text-red-500">*</span>
              </Label>
              <Input
                id="dueDays"
                type="number"
                min="0"
                max="365"
                value={dueDays}
                onChange={(e) => setDueDays(e.target.value)}
                className="bg-white border-gray-300 text-gray-900 focus:ring-blue-500 text-xs"
              />
              {errors.dueDays && (
                <p className="text-xs text-red-500 mt-1">{errors.dueDays}</p>
              )}
              <p className="text-[11px] text-gray-500">
                Days offset when process launched from that date.
              </p>
            </div>

            {/* Approval Required */}
            <div className="space-y-1 flex flex-col justify-between p-2.5 rounded border border-gray-200 bg-gray-50/60">
              <div className="flex items-center justify-between">
                <Label htmlFor="approvalRequired" className="text-xs font-semibold text-gray-700 cursor-pointer">
                  Approval Required
                </Label>
                <Switch
                  id="approvalRequired"
                  checked={approvalRequired}
                  onCheckedChange={setApprovalRequired}
                  className="data-[state=checked]:bg-indigo-600"
                />
              </div>
              <p className="text-[11px] text-gray-500">
                Requires formal sign-off (true or false).
              </p>
            </div>
          </div>

          {/* Form (Pre-existing Form) */}
          <div className="space-y-1.5 pt-1">
            <Label htmlFor="formId" className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600" /> Form (Pre-existing Form)
              </span>
              <Badge variant="outline" className="text-[10px] border-gray-200 text-gray-500 bg-white">
                Optional
              </Badge>
            </Label>
            <Select value={formId} onValueChange={(val) => setFormId(val)}>
              <SelectTrigger className="bg-white border-gray-300 text-gray-900 focus:ring-blue-500 text-xs">
                <SelectValue placeholder="Select pre-existing form (optional)" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 text-gray-900">
                <SelectItem value="none" className="text-xs text-gray-400">
                  -- None (No Form Attached) --
                </SelectItem>
                {orgForms.map((form) => (
                  <SelectItem key={form.id} value={form.id} className="text-xs">
                    <div className="flex items-center justify-between w-full gap-3">
                      <span>{form.title}</span>
                      <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                        {form.category}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-gray-500">
              List of existing forms of that organization (optional).
            </p>
          </div>

          <DialogFooter className="border-t border-gray-200 pt-4 px-0 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-gray-300 text-gray-700 hover:bg-gray-50 h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium h-8 px-4 text-xs shadow-xs"
            >
              Save Step
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
