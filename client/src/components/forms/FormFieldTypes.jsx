import {
  Type,
  Calendar,
  ChevronDown,
  CheckSquare,
  Hash,
  Mail,
  Phone,
  FileText,
  MapPin,
  AlignLeft,
  PenTool,
  Upload,
  Star,
  ToggleRight,
  Search,
  Heading,
  Tag,
  QrCode,
  Link,
  Clock,
  DollarSign,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useState } from "react";

const fieldTypes = [
  // Text Inputs
  {
    type: "text",
    label: "Single-line Text",
    icon: Type,
    description: "Short text input",
    category: "Text",
  },
  {
    type: "textarea",
    label: "Multi-line Text",
    icon: AlignLeft,
    description: "Long text input",
    category: "Text",
  },
  {
    type: "rich_text",
    label: "Rich Text Editor",
    icon: FileText,
    description: "Formatted text with bold, italic, etc.",
    category: "Text",
  },

  {
    type: "number",
    label: "Number (Integer)",
    icon: Hash,
    description: "Whole numbers only",
    category: "Numbers",
  },
  {
    type: "decimal",
    label: "Decimal Number",
    icon: DollarSign,
    description: "Numbers with decimals",
    category: "Numbers",
  },
  // Selections
  {
    type: "dropdown",
    label: "Dropdown (Single)",
    icon: ChevronDown,
    description: "Select one option",
    category: "Selections",
  },
  {
    type: "multiselect",
    label: "Dropdown (Multi)",
    icon: CheckSquare,
    description: "Select multiple options",
    category: "Selections",
  },
  {
    type: "radio",
    label: "Radio Buttons",
    icon: CheckSquare,
    description: "Choose one from a list",
    category: "Selections",
  },
  {
    type: "checkbox",
    label: "Checkboxes",
    icon: CheckSquare,
    description: "Choose multiple from a list",
    category: "Selections",
  },

  // Date/Time
  {
    type: "date",
    label: "Date",
    icon: Calendar,
    description: "Date picker",
    category: "Date/Time",
  },
  {
    type: "datetime",
    label: "Date & Time",
    icon: Clock,
    description: "Date and time picker",
    category: "Date/Time",
  },

  // Contact
  {
    type: "email",
    label: "Email",
    icon: Mail,
    description: "Email address",
    category: "Contact",
  },
  {
    type: "phone",
    label: "Phone Number",
    icon: Phone,
    description: "Phone number with validation",
    category: "Contact",
  },
  {
    type: "url",
    label: "URL/Website",
    icon: Link,
    description: "Website URL",
    category: "Contact",
  },

  // Files & Signature
  {
    type: "file_upload",
    label: "File Upload",
    icon: Upload,
    description: "Upload files (images, PDFs, etc.)",
    category: "Files",
  },
  {
    type: "signature",
    label: "Signature",
    icon: PenTool,
    description: "Capture digital signature",
    category: "Files",
  },

  // Special
  {
    type: "rating",
    label: "Rating",
    icon: Star,
    description: "Star rating (1-5 or 1-10)",
    category: "Special",
  },
  {
    type: "toggle",
    label: "Toggle Switch",
    icon: ToggleRight,
    description: "On/Off switch",
    category: "Special",
  },
  // {
  //   type: 'location_picker',
  //   label: 'Location Picker',
  //   icon: MapPin,
  //   description: 'Pick location on map',
  //   category: 'Special'
  // },
  // {
  //   type: 'lookup',
  //   label: 'Lookup/Reference',
  //   icon: Search,
  //   description: 'Search and select from API',
  //   category: 'Special'
  // },

  // Display Only
  {
    type: "title",
    label: "Section Title",
    icon: Heading,
    description: "Section heading (non-input)",
    category: "Display",
  },
  {
    type: "label",
    label: "Read-only Label",
    icon: Tag,
    description: "Display text only",
    category: "Display",
  },
  {
    type: "qr_code",
    label: "QR/Barcode",
    icon: QrCode,
    description: "QR code scanner (future)",
    category: "Display",
  },
];

export function FormFieldTypes({
  onAddField,
  inDialog,
  className,
  existingFields = [],
  onDone,
  onCancel,
}) {
  // Group fields by category
  const categories = [...new Set(fieldTypes.map((f) => f.category))];

  // Calculate field type counts from existing fields
  const fieldTypeCounts = existingFields.reduce((acc, field) => {
    acc[field.type] = (acc[field.type] || 0) + 1;
    return acc;
  }, {});

  // State for selected field types
  const [selectedTypes, setSelectedTypes] = useState([]);

  const toggleSelection = (type) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const handleDone = () => {
    if (onDone) {
      onDone(selectedTypes);
    }
    setSelectedTypes([]);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    setSelectedTypes([]);
  };

  return (
    <Card
      className={cn(
        "rounded-sm border-slate-200 shadow-sm bg-white dark:bg-[rgb(30,30,45)]",
        inDialog && "border-0 shadow-none",
        className,
      )}
    >
      <CardHeader className="border-b border-slate-200 p-4 pb-2 space-y-1">
        <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white flex items-center">
          <Type className="h-5 w-5 mr-2 text-purple-600" />
          Field Types
        </CardTitle>
        <p className="text-sm text-slate-600 dark:text-slate-400 m-0">
          Select field types and click Done to add them to your form.
        </p>
      </CardHeader>
      <CardContent
        className={cn(
          "p-4 overflow-y-auto",
          inDialog ? "max-h-[min(70vh,520px)]" : "max-h-[calc(100vh-100px)]",
        )}
      >
        {categories.map((category) => {
          const categoryFields = fieldTypes.filter(
            (f) => f.category === category,
          );
          return (
            <div key={category} className="mb-3 last:mb-0">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {category}
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {categoryFields.map((fieldType) => {
                  const Icon = fieldType.icon;
                  return (
                    <Button
                      key={fieldType.type}
                      variant="ghost"
                      className={cn(
                        "h-auto p-3 justify-start border rounded-sm transition-all duration-200 relative",
                        selectedTypes.includes(fieldType.type)
                          ? "bg-green-50 border-green-300"
                          : fieldTypeCounts[fieldType.type] > 0
                            ? "bg-blue-50 border-blue-200 hover:bg-blue-100"
                            : "hover:bg-slate-50 dark:hover:bg-slate-700 border-transparent hover:border-slate-200 dark:hover:border-slate-600",
                      )}
                      onClick={() => toggleSelection(fieldType.type)}
                    >
                      {selectedTypes.includes(fieldType.type) && (
                        <div className="absolute top-2 right-2">
                          <Check className="h-4 w-4 text-green-600" />
                        </div>
                      )}
                      <div className="flex items-center space-x-3 w-full relative">
                        <div
                          className={cn(
                            "p-2 rounded-sm",
                            fieldTypeCounts[fieldType.type] > 0
                              ? "bg-blue-100"
                              : "bg-slate-100 dark:bg-slate-700",
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4",
                              fieldTypeCounts[fieldType.type] > 0
                                ? "text-blue-600"
                                : "text-slate-600 dark:text-slate-300",
                            )}
                          />
                        </div>
                        <div className="text-left flex-1">
                          <div
                            className={cn(
                              "font-medium text-sm",
                              fieldTypeCounts[fieldType.type] > 0
                                ? "text-blue-900 dark:text-blue-300"
                                : "text-slate-900 dark:text-white",
                            )}
                          >
                            {fieldType.label}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {fieldType.description}
                          </div>
                        </div>
                        {fieldTypeCounts[fieldType.type] > 0 && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                            {fieldTypeCounts[fieldType.type]}
                          </span>
                        )}
                      </div>
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
      {inDialog && (
        <div className="p-4 border-t border-slate-200 flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="rounded-sm"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleDone}
            disabled={selectedTypes.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white rounded-sm"
          >
            <Check className="h-4 w-4 mr-2" />
            Done
          </Button>
        </div>
      )}
    </Card>
  );
}
