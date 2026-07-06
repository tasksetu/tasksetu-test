import React from "react";
import Select from "react-select";

const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder = "Select...",
  isMulti = false,
  className = "",
  isDisabled = false,
  isClearable = false,
  menuPlacement = "auto",
  size = "default",
  /** Square corners for control + menu (e.g. All Tasks toolbar) */
  squareCorners = false,
  ...props
}) => {
  const getSelectedOption = () => {
    if (!value) return null;
    if (isMulti) {
      return options?.filter((option) => value.includes(option.value)) || [];
    } else {
      return options?.find((option) => option.value === value) || null;
    }
  };

  const selectedOption = getSelectedOption();
  const displayValue = selectedOption ? selectedOption : null;
  const displayPlaceholder = selectedOption ? null : placeholder;

  const br = squareCorners ? "0.25rem" : "0.375rem";

  const isSmall = size === "small";

  const customStyles = {
    control: (provided, state) => ({
      ...provided,
      minHeight: isSmall ? "32px" : "36px",
      maxHeight: isSmall ? "32px" : "none",
      height: isSmall ? "32px" : "auto",
      fontSize: "0.875rem",
      lineHeight: "1.25rem",
      borderRadius: br,
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: state.isFocused ? "#3b82f6" : "#d1d5db",
      boxShadow: "none",
      transition: "none",
      flexWrap: isSmall ? "nowrap" : "wrap",
      overflow: isSmall ? "hidden" : "visible",
      "&:hover": {
        borderColor: state.isFocused ? "#3b82f6" : "#9ca3af",
      },
    }),
    valueContainer: (provided) => ({
      ...provided,
      padding: isSmall ? "0 6px" : "2px 8px",
      overflow: "hidden",
      alignItems: "center",
    }),
    singleValue: (provided) => ({
      ...provided,
      marginLeft: 0,
      marginRight: 0,
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      lineHeight: "1.25rem",
    }),
    placeholder: (provided) => ({
      ...provided,
      margin: 0,
      lineHeight: "1.25rem",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    }),
    input: (provided) => ({
      ...provided,
      margin: 0,
      padding: 0,
    }),
    indicatorsContainer: (provided) => ({
      ...provided,
      flexShrink: 0,
      height: isSmall ? "30px" : "auto",
      alignItems: "center",
    }),
    dropdownIndicator: (provided) => ({
      ...provided,
      padding: isSmall ? "4px" : provided.padding,
    }),
    clearIndicator: (provided) => ({
      ...provided,
      padding: isSmall ? "4px" : provided.padding,
    }),
    menu: (provided) => ({
      ...provided,
      zIndex: 9999,
      borderRadius: squareCorners ? "0.25rem" : provided.borderRadius,
    }),
    menuPortal: (provided) => ({ ...provided, zIndex: 9999 }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? "#3b82f6"
        : state.isFocused
          ? "#eff6ff"
          : "white",
      color: state.isSelected ? "white" : "#374151",
      "&:hover": {
        backgroundColor: state.isSelected ? "#3b82f6" : "#eff6ff",
      },
    }),
    multiValue: (provided) => ({
      ...provided,
      backgroundColor: "#eff6ff",
      borderRadius: squareCorners ? "0.25rem" : provided.borderRadius,
    }),
    multiValueLabel: (provided) => ({ ...provided, color: "#1f2937" }),
    multiValueRemove: (provided) => ({
      ...provided,
      color: "#6b7280",
      "&:hover": { backgroundColor: "#fee2e2", color: "#dc2626" },
    }),
  };

  return (
    <Select
      options={options}
      value={displayValue}
      onChange={onChange}
      placeholder={displayPlaceholder}
      isMulti={isMulti}
      isDisabled={isDisabled}
      isClearable={isClearable}
      isSearchable={true}
      menuPlacement={menuPlacement}
      menuPortalTarget={document.body}
      styles={customStyles}
      className={`${className} ${size === "small" ? "react-select--small" : ""}`.trim()}
      classNamePrefix="react-select"
      {...props}
    />
  );
};

export default SearchableSelect;
