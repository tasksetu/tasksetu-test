import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldRenderer } from "@/components/forms/FieldRenderer";

export function FormPreview({ form, onClose, layout }) {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  const handleFieldChange = (fieldCode, value) => {
    setFormData((prev) => ({ ...prev, [fieldCode]: value }));
    // Clear error for this field when user changes value
    if (errors[fieldCode]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldCode];
        return newErrors;
      });
    }
  };

  // Determine grid layout based on settings
  const gridColumns =
    form.settings?.layout === "1-column"
      ? 1
      : form.settings?.layout === "2-columns"
        ? 2
        : form.settings?.layout === "2-column"
          ? 2
          : form.settings?.layout === "3-columns"
            ? 3
            : form.settings?.layout === "3-column"
              ? 3
              : layout === "1-column"
                ? 1
                : layout === "2-columns"
                  ? 2
                  : layout === "2-column"
                    ? 2
                    : layout === "3-columns"
                      ? 3
                      : layout === "3-column"
                        ? 3
                        : 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-sm p-4 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold">Form Preview</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Card className="p-4">
          <div className="space-y-3">
            {/* Form Header */}
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {form.title || "Untitled Form"}
              </h1>
              {form.description && (
                <p className="text-slate-600 mt-2">{form.description}</p>
              )}
            </div>

            {/* Form Fields */}
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
              }}
            >
              {form.fields?.map((field) => (
                <FieldRenderer
                  key={field.id || field.field_code}
                  field={field}
                  value={formData[field.field_code || field.id]}
                  onChange={handleFieldChange}
                  formData={formData}
                  errors={errors[field.field_code || field.id] || []}
                />
              ))}
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t">
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                type="button"
              >
                Submit Form (Preview Mode)
              </Button>
              <p className="text-sm text-slate-500 mt-2 text-center">
                This is a preview. The form cannot be submitted in preview mode.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
