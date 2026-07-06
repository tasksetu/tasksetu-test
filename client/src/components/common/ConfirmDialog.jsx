import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ConfirmDialog({
  isOpen,
  title = "Are you sure?",
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  confirmVariant = "destructive",
  isConfirming = false,
}) {
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e) => {
      if (e.key === "Escape") onCancel?.();
      if (e.key === "Enter") onConfirm?.();
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-md mx-4 rounded-sm bg-white shadow-lg"
      >
        <div className="mx-5 pt-5 ">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <hr className="py-2" />
          {description && (
            <p
              className="mt-1 text-sm text-gray-600"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          )}
        </div>

        <div className="p-5 flex items-center justify-between gap-3">
          <Button
            onClick={onCancel}
            variant="outline"
            className="h-9 px-4"
            disabled={isConfirming}
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            variant={confirmVariant}
            className="h-9 px-4"
            disabled={isConfirming}
          >
            {isConfirming ? "Please wait..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
