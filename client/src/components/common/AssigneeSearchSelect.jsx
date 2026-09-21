import React, { useState, useEffect, useRef } from 'react';
import AsyncSelect from 'react-select/async';
import { Loader2 } from 'lucide-react';
import { useActiveRole } from '../RoleSwitcher';

/**
 * Reusable Async Searchable Assignee Select Component
 * Fetches users from backend API with search functionality
 */
const AssigneeSearchSelect = ({
  value,
  onChange,
  isDisabled = false,
  placeholder = "Search and select assignee...",
  className = "react-select-container whitespace-nowrap",
  classNamePrefix = "react-select",
  isMulti = false,
  required = false,
  skipClearOnRoleChange = false, // New prop: don't clear value when role changes
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [key, setKey] = useState(0); // Key to force re-render of AsyncSelect
  const { activeRole } = useActiveRole();
  const selectRef = useRef(null);

  // Force refresh when activeRole changes
  useEffect(() => {
    console.log('🔄 Active role changed:', activeRole, '- Refreshing assignee options');
    console.log('   skipClearOnRoleChange:', skipClearOnRoleChange);
    console.log('   Current value:', value);

    setKey(prev => prev + 1); // Force AsyncSelect to remount and reload options

    // Only clear the select value if there's no existing value (e.g., new assignment)
    // OR if explicitly told to do so
    if (selectRef.current && !skipClearOnRoleChange) {
      console.log('   🧹 Clearing value on role change');
      selectRef.current.clearValue();
    } else if (selectRef.current && skipClearOnRoleChange && value) {
      console.log('   ✅ Keeping existing value (edit mode)');
    }
  }, [activeRole, skipClearOnRoleChange]);

  // Fetch users from API with search term
  const loadOptions = async (inputValue) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');

      if (!token) {
        console.error('No authentication token found');
        return [];
      }

      const searchParams = new URLSearchParams({
        search: inputValue || '',
        limit: '20'
      });

      // Add activeRole to query params if available
      if (activeRole) {
        searchParams.append('activeRole', activeRole);
        console.log('📤 Sending activeRole to API:', activeRole);
      }

      console.log('🔍 Fetching assignable users with params:', {
        search: inputValue || '',
        limit: '20',
        activeRole: activeRole || 'not provided'
      });

      const response = await fetch(
        `/api/users/search-assignable?${searchParams}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        return result.data;
      }

      return [];
    } catch (error) {
      console.error('Error loading assignable users:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Default options (load without search term on initial focus)
  const loadDefaultOptions = async () => {
    return await loadOptions('');
  };

  // Custom styles for react-select
  const customStyles = {
    control: (provided, state) => ({
      ...provided,
      minHeight: '32px',
      height: '32px',
      maxHeight: '32px',
      borderColor: state.isFocused ? '#3B82F6' : '#D1D5DB',
      boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.1)' : 'none',
      '&:hover': {
        borderColor: '#3B82F6'
      }
    }),
    valueContainer: (provided) => ({
      ...provided,
      height: '32px',
      minHeight: '32px',
      maxHeight: '32px',
      padding: '0 8px',
      display: 'flex',
      alignItems: 'center',
      position: 'relative',
    }),
    placeholder: (provided) => ({
      ...provided,
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
      margin: 0,
      color: '#9CA3AF',
      fontSize: '0.75rem',
      lineHeight: '1',
      pointerEvents: 'none',
    }),
    singleValue: (provided) => ({
      ...provided,
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
      margin: 0,
      color: '#111827',
      fontSize: '0.75rem',
      lineHeight: '1',
      display: 'flex',
      alignItems: 'center',
      maxWidth: 'calc(100% - 40px)',
    }),
    input: (provided) => ({
      ...provided,
      margin: '0px',
      padding: '0px',
      fontSize: '0.75rem',
    }),
    indicatorsContainer: (provided) => ({
      ...provided,
      height: '32px',
      minHeight: '32px',
      maxHeight: '32px',
      display: 'flex',
      alignItems: 'center',
    }),
    dropdownIndicator: (provided) => ({
      ...provided,
      padding: '0 6px',
      display: 'flex',
      alignItems: 'center',
    }),
    menu: (provided) => ({
      ...provided,
      zIndex: 9999
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? '#3B82F6'
        : state.isFocused
          ? '#EFF6FF'
          : 'white',
      color: state.isSelected ? 'white' : '#111827',
      cursor: 'pointer',
      fontSize: '0.75rem',
      padding: '6px 10px',
      '&:active': {
        backgroundColor: '#3B82F6'
      }
    })
  };

  return (
    <AsyncSelect
      key={key} // Force remount when activeRole changes
      ref={selectRef}
      value={value}
      onChange={onChange}
      loadOptions={loadOptions}
      defaultOptions // Load default options on mount
      cacheOptions={false} // Disable cache to always fetch fresh data
      isDisabled={isDisabled}
      isMulti={isMulti}
      placeholder={isLoading ? "Loading users..." : placeholder}
      className={className}
      classNamePrefix={classNamePrefix}
      styles={customStyles}
      formatOptionLabel={(option, { context }) => {
        const isSelf = option.isSelf || option.value === "self";
        if (isSelf) {
          if (context === "value") {
            return <span className="font-semibold text-blue-700">Self (You)</span>;
          }
          return (
            <div className="flex items-center justify-between w-full py-0.5">
              <span className="font-semibold text-blue-700">Self (You)</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
                Current User
              </span>
            </div>
          );
        }

        const roles = Array.isArray(option.role)
          ? option.role
          : option.role
          ? [option.role]
          : [];
        const isOrgAdmin =
          roles.includes("org_admin") ||
          roles.includes("admin") ||
          roles.includes("company-admin") ||
          roles.includes("super_admin");
        const isManager = roles.includes("manager");

        let roleBadge = null;
        if (isOrgAdmin) {
          roleBadge = (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium border border-purple-200">
              Org Admin
            </span>
          );
        } else if (isManager) {
          roleBadge = (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium border border-blue-200">
              Manager
            </span>
          );
        } else if (roles.length > 0) {
          roleBadge = (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium border border-green-200">
              Employee
            </span>
          );
        }

        if (context === "value") {
          return (
            <div className="flex items-center gap-1.5 truncate">
              <span className="truncate font-medium">{option.label}</span>
              {roleBadge}
            </div>
          );
        }

        return (
          <div className="flex items-center justify-between w-full py-0.5">
            <div className="flex flex-col min-w-0 pr-2">
              <span className="font-medium text-gray-900 truncate">{option.label}</span>
              {option.email && (
                <span className="text-[11px] text-gray-500 truncate">{option.email}</span>
              )}
            </div>
            <div className="flex-shrink-0">
              {roleBadge}
            </div>
          </div>
        );
      }}
      noOptionsMessage={({ inputValue }) =>
        inputValue ? `No users found matching "${inputValue}"` : "Start typing to search users"
      }
      loadingMessage={() => "Searching users..."}
      isClearable={!required}
      components={{
        DropdownIndicator: (props) => (
          <div {...props.innerProps} className="flex items-center justify-center px-1.5 h-full cursor-pointer">
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : (
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
        )
      }}
      {...props}
    />
  );
};

export default AssigneeSearchSelect;
