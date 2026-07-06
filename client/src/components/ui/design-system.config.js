/**
 * Design System Configuration
 * Central configuration for consistent UI components
 * 
 * Height System: h-9 (36px) - Compact, Professional
 * All inputs and buttons should use the same height for alignment
 */

// ==========================================
// INPUT SIZE TOKENS
// ==========================================
export const INPUT_SIZES = {
    sm: "h-8 text-xs",
    md: "h-9 text-sm",
    lg: "h-10 text-base",
};

// Default input size
export const DEFAULT_INPUT_SIZE = "md";

// ==========================================
// BUTTON SIZE TOKENS
// ==========================================
export const BUTTON_SIZES = {
    xs: "h-7 px-2 text-xs",
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-4 text-sm",
    lg: "h-10 px-5 text-base",
    xl: "h-11 px-6 text-base",
};

// Icon button sizes (square)
export const ICON_BUTTON_SIZES = {
    xs: "h-7 w-7",
    sm: "h-8 w-8",
    md: "h-9 w-9",
    lg: "h-10 w-10",
    xl: "h-11 w-11",
};

// ==========================================
// BUTTON VARIANT TOKENS
// ==========================================
export const BUTTON_VARIANTS = {
    primary:
        "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 border-transparent",
    secondary:
        "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500",
    success:
        "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 border-transparent",
    danger:
        "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 border-transparent",
    warning:
        "bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-500 border-transparent",
    ghost:
        "bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500 border-transparent",
    outline:
        "bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500",
    link:
        "bg-transparent text-blue-600 hover:text-blue-700 hover:underline focus:ring-blue-500 border-transparent",
    gradient:
        "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 focus:ring-blue-500 border-transparent",
};

// ==========================================
// INPUT BASE STYLES
// ==========================================
export const INPUT_BASE_STYLES =
    "w-full rounded-md border border-gray-300 bg-white px-3 text-sm ring-offset-background placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50";

// ==========================================
// BUTTON BASE STYLES
// ==========================================
export const BUTTON_BASE_STYLES =
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

// ==========================================
// FORM FIELD STYLES
// ==========================================
export const FORM_FIELD_STYLES = {
    wrapper: "space-y-1",
    label: "block text-sm font-medium text-gray-900",
    labelRequired: "text-red-500 ml-0.5",
    error: "text-xs text-red-500 mt-1",
    hint: "text-xs text-gray-500 mt-1",
};

// ==========================================
// REACT-SELECT CUSTOM STYLES (For JS usage)
// ==========================================
export const getReactSelectStyles = (hasError = false, size = "md") => {
    const heights = {
        sm: 32,
        md: 36,
        lg: 40,
    };

    const height = heights[size] || 36;

    return {
        control: (base, state) => ({
            ...base,
            minHeight: height,
            height: height,
            borderColor: hasError ? '#ef4444' : state.isFocused ? '#3b82f6' : '#d1d5db',
            boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
            '&:hover': {
                borderColor: state.isFocused ? '#3b82f6' : '#9ca3af',
            },
        }),
        valueContainer: (base) => ({
            ...base,
            padding: '0 8px',
            height: height - 2,
        }),
        input: (base) => ({
            ...base,
            margin: 0,
            padding: 0,
        }),
        indicatorsContainer: (base) => ({
            ...base,
            height: height - 2,
        }),
        singleValue: (base) => ({
            ...base,
            fontSize: '0.875rem',
        }),
        placeholder: (base) => ({
            ...base,
            fontSize: '0.875rem',
            color: '#9ca3af',
        }),
        option: (base, state) => ({
            ...base,
            fontSize: '0.875rem',
            backgroundColor: state.isSelected
                ? '#3b82f6'
                : state.isFocused
                    ? '#eff6ff'
                    : 'white',
            color: state.isSelected ? 'white' : '#374151',
            '&:hover': {
                backgroundColor: state.isSelected ? '#3b82f6' : '#eff6ff',
            },
        }),
        menu: (base) => ({
            ...base,
            zIndex: 50,
        }),
        multiValue: (base) => ({
            ...base,
            backgroundColor: '#eff6ff',
            borderRadius: '4px',
        }),
        multiValueLabel: (base) => ({
            ...base,
            fontSize: '0.75rem',
            color: '#1e40af',
        }),
        multiValueRemove: (base) => ({
            ...base,
            color: '#1e40af',
            '&:hover': {
                backgroundColor: '#dbeafe',
                color: '#1e40af',
            },
        }),
    };
};

// ==========================================
// RICH TEXT EDITOR (react-quill) CONFIG
// ==========================================
export const RICH_TEXT_CONFIG = {
    minHeight: 120,
    toolbar: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['link'],
        ['clean']
    ],
};

// ==========================================
// SPACING TOKENS
// ==========================================
export const SPACING = {
    formGap: "gap-3",
    fieldGap: "space-y-1",
    sectionGap: "space-y-3",
};

// ==========================================
// Z-INDEX TOKENS
// ==========================================
export const Z_INDEX = {
    dropdown: 50,
    modal: 100,
    tooltip: 150,
    notification: 200,
};
