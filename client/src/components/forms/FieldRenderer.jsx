import { useEffect, useState, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Star, Info } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

/**
 * FieldRenderer - Renders all 23 field types with validation and conditional logic
 *
 * Supported field types:
 * - Text: text, textarea, rich_text
 * - Numbers: number, decimal
 * - Selections: dropdown, multiselect, radio, checkbox
 * - Date/Time: date, datetime
 * - Contact: email, phone, url
 * - Files: file_upload, signature
 * - Special: rating, toggle, location_picker, lookup
 * - Display: title, label, qr_code
 */
export function FieldRenderer({
  field,
  value,
  onChange,
  formData = {},
  errors = [],
}) {
  const signatureCanvasRef = useRef(null);
  const [lookupResults, setLookupResults] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [isMultiSelectOpen, setIsMultiSelectOpen] = useState(false);

  // Check if field is visible based on visibility_condition
  const isVisible = evaluateConditions(field.visibility_condition, formData);

  // Check if field is enabled based on enable_condition
  const isEnabled = evaluateConditions(field.enable_condition, formData);

  if (!isVisible) return null;

  const isFieldRequired = field.isRequired === true || field.required === true;

  const commonProps = {
    disabled: field.read_only || !isEnabled,
    required: isFieldRequired,
  };

  const handleChange = useCallback(
    (newValue) => {
      onChange(field.field_code || field.id, newValue);
    },
    [onChange, field.field_code, field.id],
  );

  // Render field label with tooltip
  const renderLabel = () => {
    if (field.type === "title" || field.type === "label") return null;

    return (
      <Label className="flex items-center gap-2 mb-0.5">
        {field.label}
        {(field.isRequired === true || field.required === true) && (
          <span className="text-red-500">*</span>
        )}
        {field.tooltip && (
          <div className="group relative">
            <Info className="h-4 w-4 text-slate-400 cursor-help" />
            <div className="hidden group-hover:block absolute z-10 w-64 p-2 bg-slate-900 text-white text-xs rounded-sm shadow-lg -top-2 left-6">
              {field.tooltip}
            </div>
          </div>
        )}
      </Label>
    );
  };

  // Render help text
  const renderHelpText = () => {
    if (!field.help_text && errors.length === 0) return null;

    return (
      <div className="mt-1">
        {field.help_text && (
          <p className="text-xs text-slate-500">{field.help_text}</p>
        )}
        {errors.length > 0 && (
          <p className="text-xs text-red-500 mt-1">{errors.join(", ")}</p>
        )}
      </div>
    );
  };

  // Render field input based on type
  const renderInput = () => {
    // Add error styling to className
    const hasError = errors && errors.length > 0;
    const errorClass = hasError
      ? "border-red-500 focus:border-red-500 focus:ring-red-500"
      : "";

    switch (field.type) {
      // Text Inputs
      case "text":
      case "email":
      case "url":
        return (
          <Input
            {...commonProps}
            type={
              field.type === "email"
                ? "email"
                : field.type === "url"
                  ? "url"
                  : "text"
            }
            placeholder={field.placeholder}
            value={value || field.default_value || ""}
            onChange={(e) => handleChange(e.target.value)}
            maxLength={field.validation?.maxLength}
            pattern={field.validation?.regex}
            className={`${field.css_class || ""} ${errorClass}`}
          />
        );

      case "phone":
        return (
          <Input
            {...commonProps}
            type="tel"
            placeholder={field.placeholder || "+91 9876543210"}
            value={value || field.default_value || ""}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/[^0-9+\-()\s]/g, "");
              handleChange(cleaned);
            }}
            maxLength={field.validation?.maxLength || 15}
            className={`${field.css_class || ""} ${errorClass}`}
          />
        );

      case "textarea":
        return (
          <div className="relative">
            <Textarea
              {...commonProps}
              placeholder={field.placeholder}
              value={value || field.default_value || ""}
              onChange={(e) => handleChange(e.target.value)}
              maxLength={field.validation?.maxLength}
              rows={4}
              className={`${field.css_class || ""} ${errorClass}`}
            />
            {field.meta?.show_character_count &&
              field.validation?.maxLength && (
                <div className="text-xs text-slate-500 text-right mt-1">
                  {(value || "").length} / {field.validation.maxLength}
                </div>
              )}
          </div>
        );

      case "rich_text":
        return (
          <ReactQuill
            theme="snow"
            value={value || field.default_value || ""}
            onChange={handleChange}
            readOnly={field.read_only || !isEnabled}
            placeholder={field.placeholder}
            modules={{
              toolbar:
                field.meta?.allow_formatting !== false
                  ? [
                      ["bold", "italic", "underline"],
                      ["link"],
                      [{ list: "ordered" }, { list: "bullet" }],
                      ["clean"],
                    ]
                  : false,
            }}
          />
        );

      // Numbers
      case "number":
        return (
          <Input
            {...commonProps}
            type="number"
            placeholder={field.placeholder}
            value={value || field.default_value || ""}
            onChange={(e) => handleChange(parseInt(e.target.value) || 0)}
            min={field.validation?.min}
            max={field.validation?.max}
            step={field.validation?.step || 1}
            className={`${field.css_class || ""} ${errorClass}`}
          />
        );

      case "decimal":
        return (
          <Input
            {...commonProps}
            type="number"
            placeholder={field.placeholder}
            value={value || field.default_value || ""}
            onChange={(e) => handleChange(parseFloat(e.target.value) || 0)}
            min={field.validation?.min}
            max={field.validation?.max}
            step={field.validation?.step || 0.01}
            className={`${field.css_class || ""} ${errorClass}`}
          />
        );

      // Selections
      case "dropdown":
        return (
          <Select
            value={value || field.default_value || ""}
            onValueChange={handleChange}
            disabled={commonProps.disabled}
          >
            <SelectTrigger className={field.css_class}>
              <SelectValue
                placeholder={field.placeholder || "Select an option"}
              />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option, index) => (
                <SelectItem key={index} value={option.value || option}>
                  {option.label || option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "multiselect":
        const selectedValues = value || [];

        return (
          <div className="relative">
            <div
              onClick={() =>
                !commonProps.disabled &&
                setIsMultiSelectOpen(!isMultiSelectOpen)
              }
              className={`border rounded-md p-2 min-h-[40px] bg-white cursor-pointer ${commonProps.disabled ? "bg-slate-50 cursor-not-allowed" : "hover:border-slate-400"} border-slate-300`}
            >
              <div className="flex flex-wrap gap-1">
                {selectedValues.length > 0 ? (
                  selectedValues.map((val, idx) => {
                    const option = field.options?.find(
                      (opt) => (opt.value || opt) === val,
                    );
                    const label = option?.label || option || val;
                    return (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                      >
                        {label}
                        {!commonProps.disabled && (
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleChange(
                                selectedValues.filter((v) => v !== val),
                              );
                            }}
                            className="hover:text-blue-900 font-bold h-4 w-4 p-0"
                          >
                            ×
                          </Button>
                        )}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-slate-400 text-sm">
                    {field.placeholder || "-- Select multiple --"}
                  </span>
                )}
              </div>
            </div>
            {!commonProps.disabled && isMultiSelectOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsMultiSelectOpen(false)}
                ></div>
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  {field.options?.map((option, index) => {
                    const optionValue = option.value || option;
                    const optionLabel = option.label || option;
                    const isSelected = selectedValues.includes(optionValue);

                    return (
                      <div
                        key={index}
                        onClick={(e) => {
                          e.stopPropagation();
                          const newValues = isSelected
                            ? selectedValues.filter((v) => v !== optionValue)
                            : [...selectedValues, optionValue];
                          handleChange(newValues);
                        }}
                        className={`px-3 py-2 cursor-pointer hover:bg-slate-100 flex items-center gap-2 ${
                          isSelected ? "bg-blue-50" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm">{optionLabel}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );

      case "radio":
        return (
          <RadioGroup
            value={value || field.default_value || ""}
            onValueChange={handleChange}
            disabled={commonProps.disabled}
          >
            {field.options?.map((option, index) => {
              const optionValue = option.value || option;
              const optionLabel = option.label || option;

              return (
                <div key={index} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={optionValue}
                    id={`${field.field_code}_${index}`}
                  />
                  <Label
                    htmlFor={`${field.field_code}_${index}`}
                    className="text-sm cursor-pointer font-normal"
                  >
                    {optionLabel}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        );

      case "checkbox":
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => {
              const optionValue = option.value || option;
              const optionLabel = option.label || option;
              const selectedValues = value || [];
              const isChecked = selectedValues.includes(optionValue);

              return (
                <div key={index} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${field.field_code}_${index}`}
                    checked={isChecked}
                    disabled={commonProps.disabled}
                    onCheckedChange={(checked) => {
                      const currentValues = value || [];
                      const newValues = checked
                        ? [...currentValues, optionValue]
                        : currentValues.filter((v) => v !== optionValue);
                      handleChange(newValues);
                    }}
                  />
                  <Label
                    htmlFor={`${field.field_code}_${index}`}
                    className="text-sm cursor-pointer select-none font-normal"
                  >
                    {optionLabel}
                  </Label>
                </div>
              );
            })}
          </div>
        );

      // Date/Time
      case "date":
        return (
          <Input
            {...commonProps}
            type="date"
            value={value || field.default_value || ""}
            onChange={(e) => handleChange(e.target.value)}
            min={field.validation?.min}
            max={field.validation?.max}
            className={`${field.css_class || ""} ${errorClass}`}
          />
        );

      case "datetime":
        return (
          <Input
            {...commonProps}
            type="datetime-local"
            value={value || field.default_value || ""}
            onChange={(e) => handleChange(e.target.value)}
            className={`${field.css_class || ""} ${errorClass}`}
          />
        );

      // Files
      case "file_upload":
        return (
          <div>
            <Input
              {...commonProps}
              type="file"
              accept={
                field.meta?.allowed_mime_types?.join(",") ||
                field.meta?.fileTypes?.join(",") ||
                "*"
              }
              multiple={field.meta?.maxFiles > 1}
              onChange={async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) {
                  handleChange(null);
                  return;
                }

                // Convert files to base64 for JSON submission
                const filePromises = Array.from(files).map((file) => {
                  return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                      resolve({
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        data: reader.result, // base64 string
                      });
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                  });
                });

                try {
                  const fileData = await Promise.all(filePromises);
                  handleChange(
                    field.meta?.maxFiles > 1 ? fileData : fileData[0],
                  );
                } catch (err) {
                  console.error("Error reading files:", err);
                }
              }}
              className={field.css_class}
            />
            {value && (
              <div className="mt-2 text-sm text-green-600">
                {Array.isArray(value)
                  ? `${value.length} file(s) selected: ${value.map((f) => f.name).join(", ")}`
                  : `File selected: ${value.name}`}
              </div>
            )}
            {field.meta?.maxSizeMB && (
              <p className="text-xs text-slate-500 mt-1">
                Max file size: {field.meta.maxSizeMB} MB
              </p>
            )}
          </div>
        );

      case "signature":
        return (
          <div className="border border-slate-300 rounded-sm p-4">
            <SignatureCanvas
              penColor="black"
              canvasProps={{
                width: 500,
                height: 200,
                className: "border border-slate-300 rounded-md w-full",
              }}
              onEnd={() => {
                if (signatureCanvasRef.current) {
                  const signatureData = signatureCanvasRef.current.toDataURL();
                  handleChange(signatureData);
                }
              }}
              ref={signatureCanvasRef}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => signatureCanvasRef.current?.clear()}
              className="mt-2"
              type="button"
            >
              Clear Signature
            </Button>
          </div>
        );

      // Special
      case "rating":
        const scale = field.meta?.rating_scale || 5;
        const icon = field.meta?.rating_icon || "star";

        return (
          <div className="flex gap-1">
            {[...Array(scale)].map((_, index) => {
              const ratingValue = index + 1;
              return (
                <Button
                  key={index}
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() =>
                    !commonProps.disabled && handleChange(ratingValue)
                  }
                  disabled={commonProps.disabled}
                  className={`p-1 transition-colors ${
                    ratingValue <= (value || 0)
                      ? "text-yellow-400"
                      : "text-slate-300"
                  }`}
                >
                  <Star className="h-6 w-6 fill-current" />
                </Button>
              );
            })}
            {value && (
              <span className="ml-2 text-sm text-slate-600">
                {value}/{scale}
              </span>
            )}
          </div>
        );

      case "toggle":
        return (
          <div className="flex items-center space-x-2">
            <Switch
              checked={value || field.default_value || false}
              onCheckedChange={handleChange}
              disabled={commonProps.disabled}
            />
            <Label className="text-sm text-slate-600">
              {value ? "On" : "Off"}
            </Label>
          </div>
        );

      case "location_picker":
        return (
          <LocationPicker
            field={field}
            value={value}
            onChange={handleChange}
            disabled={commonProps.disabled}
          />
        );

      case "lookup":
        return (
          <LookupField
            field={field}
            value={value}
            onChange={handleChange}
            disabled={commonProps.disabled}
          />
        );

      // Display Only
      case "title":
        return (
          <div
            className={`text-xl font-bold text-slate-900 mb-3 ${field.css_class}`}
          >
            {field.label}
          </div>
        );

      case "label":
        return (
          <div
            className={`text-sm text-slate-600 dark:text-slate-400 ${field.css_class}`}
          >
            {field.label}
            {field.description && (
              <p className="text-xs text-slate-500 mt-1">{field.description}</p>
            )}
          </div>
        );

      case "qr_code":
        return (
          <div className="p-4 border border-slate-300 rounded-sm text-center text-slate-500">
            <p className="text-sm">QR Code Scanner (Coming Soon)</p>
            <p className="text-xs mt-1">
              This feature will be available in a future update
            </p>
          </div>
        );

      default:
        return (
          <div className="text-red-500 text-sm">
            Unsupported field type: {field.type}
          </div>
        );
    }
  };

  return (
    <div
      className={`${field.css_class || ""}`}
      style={{ gridColumn: `span ${field.column_span || 1}` }}
    >
      {renderLabel()}
      {renderInput()}
      {renderHelpText()}
    </div>
  );
}

// Location Picker Component
function LocationPicker({ field, value, onChange, disabled }) {
  const [userLocation, setUserLocation] = useState({
    lat: 51.505,
    lng: -0.09,
  });

  useEffect(() => {
    if (field.meta?.enable_current_location && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newLocation = { lat: latitude, lng: longitude };
          setUserLocation(newLocation);
          if (!value) {
            onChange(newLocation);
          }
        },
        (error) => {
          console.error("Error fetching location:", error);
        },
      );
    }
  }, []);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  if (!isLoaded)
    return <p className="text-sm text-slate-500">Loading map...</p>;

  return (
    <div className="border border-slate-300 rounded-sm overflow-hidden">
      <div className="w-full h-64">
        <GoogleMap
          center={value || userLocation}
          zoom={13}
          mapContainerStyle={{ width: "100%", height: "100%" }}
          onClick={(e) => {
            if (!disabled) {
              const latLng = e.latLng.toJSON();
              onChange(latLng);
            }
          }}
        >
          <Marker
            position={value || userLocation}
            draggable={!disabled}
            onDragEnd={(e) => {
              const latLng = e.latLng.toJSON();
              onChange(latLng);
            }}
          />
        </GoogleMap>
      </div>
      {field.meta?.enable_address_search && (
        <div className="p-2 bg-slate-50 border-t">
          <Input
            type="text"
            placeholder="Search for address..."
            className="text-sm"
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

// Lookup Field Component
function LookupField({ field, value, onChange, disabled }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (term) => {
    if (!term || !field.meta?.lookup_endpoint) return;

    setLoading(true);
    try {
      const response = await fetch(`${field.meta.lookup_endpoint}?q=${term}`);
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error("Lookup search error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Input
        type="text"
        placeholder={field.placeholder || "Search..."}
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          handleSearch(e.target.value);
        }}
        disabled={disabled}
      />
      {loading && <p className="text-xs text-slate-500">Searching...</p>}
      {results.length > 0 && (
        <div className="border border-slate-200 rounded-sm max-h-48 overflow-y-auto">
          {results.map((result, index) => (
            <Button
              key={index}
              variant="ghost"
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm h-auto justify-start"
              onClick={() => {
                onChange(result[field.meta.lookup_value_field] || result);
                setSearchTerm(
                  result[field.meta.lookup_display_field] || result,
                );
                setResults([]);
              }}
            >
              {result[field.meta.lookup_display_field] ||
                JSON.stringify(result)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

// Evaluate conditional logic
function evaluateConditions(conditions, formData) {
  if (!conditions || conditions.length === 0) return true;

  const results = conditions.map((condition) => {
    const fieldValue = formData[condition.field_code];

    switch (condition.operator) {
      case "==":
        return fieldValue == condition.value;
      case "!=":
        return fieldValue != condition.value;
      case ">":
        return parseFloat(fieldValue) > parseFloat(condition.value);
      case "<":
        return parseFloat(fieldValue) < parseFloat(condition.value);
      case ">=":
        return parseFloat(fieldValue) >= parseFloat(condition.value);
      case "<=":
        return parseFloat(fieldValue) <= parseFloat(condition.value);
      case "contains":
        return String(fieldValue).includes(condition.value);
      case "not_contains":
        return !String(fieldValue).includes(condition.value);
      case "is_empty":
        return !fieldValue || fieldValue === "";
      case "is_not_empty":
        return fieldValue && fieldValue !== "";
      case "in":
        return (
          Array.isArray(condition.value) && condition.value.includes(fieldValue)
        );
      case "not_in":
        return (
          Array.isArray(condition.value) &&
          !condition.value.includes(fieldValue)
        );
      default:
        return true;
    }
  });

  // Check logic type (default to AND)
  const logicType = conditions[0]?.logic || "AND";
  return logicType === "OR" ? results.some((r) => r) : results.every((r) => r);
}
