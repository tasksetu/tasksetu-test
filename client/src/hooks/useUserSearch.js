import { useState, useCallback } from 'react';
import { debounce } from 'lodash';

/**
 * Custom hook for async user search in task assignment dropdowns
 * Provides searchable user list with debounced API calls
 */
export const useUserSearch = (isOrgUser, currentUser) => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Build assignment options with "Self" option
  const getAssignmentOptions = useCallback(() => {
    const selfOption = {
      value: 'self',
      label: `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || currentUser?.name || 'Self',
      email: currentUser?.email || '',
      isSelf: true
    };

    if (!isOrgUser) {
      // Individual users can only assign to themselves
      return [selfOption];
    }

    // Organization users: Self + searched users
    return [selfOption, ...users];
  }, [isOrgUser, currentUser, users]);

  // Fetch users from API with search
  const fetchUsers = async (searchTerm = '') => {
    if (!isOrgUser) {
      // Individual users don't need to search
      setUsers([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(
        `/api/users/search-for-assignment?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.message);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search function (500ms delay)
  const debouncedSearch = useCallback(
    debounce((searchTerm) => {
      fetchUsers(searchTerm);
    }, 500),
    [isOrgUser]
  );

  // Handle input change in react-select
  const handleInputChange = (inputValue) => {
    if (isOrgUser) {
      debouncedSearch(inputValue);
    }
  };

  // Initial load - fetch users without search term
  const loadInitialUsers = useCallback(() => {
    if (isOrgUser) {
      fetchUsers('');
    }
  }, [isOrgUser]);

  return {
    assignmentOptions: getAssignmentOptions(),
    isLoading,
    error,
    handleInputChange,
    loadInitialUsers,
  };
};
