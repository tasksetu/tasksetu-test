import * as React from "react";
import { cn } from "@/lib/utils";
import { FORM_FIELD_STYLES } from "./design-system.config";

/**
 * FormField Component
 * Base wrapper for all form inputs providing consistent spacing, labels, and error handling
 * 
 * @param {string} label - Field label text
 * @param {boolean} required - Shows required indicator
 * @param {string} error - Error message to display
 * @param {string} hint - Helper text below the input
 * @param {string} className - Additional wrapper classes
 * @param {React.ReactNode} children - Input element(s)
 */
const FormField = React.forwardRef(
    ({ label, required, error, hint, className, children, labelClassName, ...props }, ref) => {
        return (
            <div className={cn(FORM_FIELD_STYLES.wrapper, className)} ref={ref} {...props}>
                {label && (
                    <label className={cn(FORM_FIELD_STYLES.label, labelClassName)}>
                        {label}
                        {required && <span className={FORM_FIELD_STYLES.labelRequired}>*</span>}
                    </label>
                )}

                <div className="relative">
                    {children}
                </div>

                {error && (
                    <p className={FORM_FIELD_STYLES.error}>{error}</p>
                )}

                {hint && !error && (
                    <p className={FORM_FIELD_STYLES.hint}>{hint}</p>
                )}
            </div>
        );
    }
);

FormField.displayName = "FormField";

/**
 * FormFieldRow Component
 * For horizontal form layouts with multiple fields in a row
 */
const FormFieldRow = React.forwardRef(
    ({ className, children, cols = 2, ...props }, ref) => {
        const gridCols = {
            1: "grid-cols-1",
            2: "grid-cols-1 md:grid-cols-2",
            3: "grid-cols-1 md:grid-cols-3",
            4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
        };

        return (
            <div
                className={cn("grid gap-3", gridCols[cols] || gridCols[2], className)}
                ref={ref}
                {...props}
            >
                {children}
            </div>
        );
    }
);

FormFieldRow.displayName = "FormFieldRow";

/**
 * FormSection Component
 * Groups related form fields with optional title
 */
const FormSection = React.forwardRef(
    ({ title, description, className, children, ...props }, ref) => {
        return (
            <div className={cn("space-y-3", className)} ref={ref} {...props}>
                {(title || description) && (
                    <div className="space-y-1">
                        {title && (
                            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                        )}
                        {description && (
                            <p className="text-sm text-gray-500">{description}</p>
                        )}
                    </div>
                )}
                <div className="space-y-3">
                    {children}
                </div>
            </div>
        );
    }
);

FormSection.displayName = "FormSection";

/**
 * FormActions Component
 * Container for form action buttons with consistent spacing
 */
const FormActions = React.forwardRef(
    ({ className, children, align = "end", ...props }, ref) => {
        const alignments = {
            start: "justify-start",
            center: "justify-center",
            end: "justify-end",
            between: "justify-between",
        };

        return (
            <div
                className={cn(
                    "flex items-center gap-3 pt-4",
                    alignments[align] || alignments.end,
                    className
                )}
                ref={ref}
                {...props}
            >
                {children}
            </div>
        );
    }
);

FormActions.displayName = "FormActions";

export { FormField, FormFieldRow, FormSection, FormActions };
