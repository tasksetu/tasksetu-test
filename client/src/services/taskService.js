// Use window.location to determine the API URL or set a fallback
const getApiBaseUrl = () => {
  // Try to get from environment variable (works in React with REACT_APP_ prefix)
  if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Fallback based on current location
  const { protocol, hostname } = window.location;
  const port = hostname === 'localhost' ? '5000' : '';
  return `${protocol}//${hostname}${port ? ':' + port : ''}/api`;
};

const API_BASE_URL = getApiBaseUrl();

const deleteTask = async (taskId) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/tasks/delete/${taskId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to delete task');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
};

const updateTask = async (taskId, taskData) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(taskData),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to update task');
    }

    return data;
  } catch (error) {
    console.error('Error updating task:', error);
    throw error;
  }
};

export const taskService = {
  // Fetch tasks by type (milestone, regular, recurring, approval)
  getTasksByType: async (type, filters = {}) => {
    try {
      const params = new URLSearchParams();
      
      // Add filters to params
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.priority && filters.priority !== 'all') params.append('priority', filters.priority);
      if (filters.assignee) params.append('assignee', filters.assignee);
      if (filters.category) params.append('category', filters.category);
      if (filters.search) params.append('search', filters.search);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.page) params.append('page', filters.page);
      if (filters.limit) params.append('limit', filters.limit);

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/tasks/filter/${type}?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching tasks by type:', error);
      throw error;
    }
  },

  deleteTask,
  updateTask,
};