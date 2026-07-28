import React, { useState } from "react";
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
import {
  Play,
  Layers,
  Clock,
  UserCheck,
  FileText,
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

  if (!process) return null;

  const handleLaunch = (e) => {
    e.preventDefault();
    onConfirmLaunch({
      processId: process.id,
      customName: customName.trim() || process.name,
      notes: notes.trim(),
    });
  };

  const getUserName = (userId) => {
    const user = orgUsers.find((u) => Number(u.id) === Number(userId));
    return user ? user.name : `User #${userId}`;
  };

  const getFormTitle = (formId) => {
    if (!formId) return null;
    const form = orgForms.find((f) => String(f.id) === String(formId));
    return form ? form.title : null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[620px] max-h-[85vh] flex flex-col bg-white text-gray-900 border-gray-200 shadow-xl p-0 overflow-hidden rounded-md">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-gray-200 bg-gray-50/80">
          <DialogTitle className="text-xl font-normal text-gray-800 flex items-center gap-2" style={{ color: "#676a6c" }}>
            <Play className="w-5 h-5 fill-emerald-600 text-emerald-600" /> Start Process Instance
          </DialogTitle>
          <p className="text-xs text-blue-600 mt-0.5">
            Launch an active instance of this process. Tasks will be assigned to specified users based on due offsets.
          </p>
        </DialogHeader>

        <form onSubmit={handleLaunch} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Template Info Card */}
          <div className="p-3 rounded border border-gray-200 bg-gray-50/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500 uppercase font-semibold tracking-wider">
                Process Template
              </span>
              <Badge variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50 text-[10px]">
                {process.steps?.length || 0} Steps Configured
              </Badge>
            </div>
            <h4 className="text-sm font-semibold text-gray-900">{process.name}</h4>
            <p className="text-xs text-gray-600 line-clamp-2">{process.description}</p>
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

          {/* Steps Sequence Preview */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600" /> Sequence of Executed Steps
            </Label>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {process.steps?.map((step, idx) => {
                const formTitle = getFormTitle(step.formId);
                return (
                  <div
                    key={step.id || idx}
                    className="flex items-center gap-3 p-2.5 rounded border border-gray-200 bg-white text-xs shadow-2xs"
                  >
                    <div className="w-5 h-5 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">
                        {step.name}
                      </div>
                      <div className="flex items-center gap-3 text-gray-500 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-indigo-600" />
                          {getUserName(step.assignedUserId)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Due in +{step.dueDays} days
                        </span>
                        {formTitle && (
                          <span className="flex items-center gap-1 text-blue-700">
                            <FileText className="w-3 h-3" />
                            {formTitle}
                          </span>
                        )}
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[9px] shrink-0 ${
                        step.taskType === "Approval"
                          ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                          : step.taskType === "Milestone"
                          ? "border-amber-200 text-amber-700 bg-amber-50"
                          : "border-blue-200 text-blue-700 bg-blue-50"
                      }`}
                    >
                      {step.taskType}
                    </Badge>
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
  );
}
