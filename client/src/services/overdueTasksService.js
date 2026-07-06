/**
 * Overdue Tasks Service
 * API calls for fetching overdue tasks
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Get overdue tasks for the current user
 * @param {Object} filters - Filter options (search, priority, category)
 * @returns {Promise} - Overdue tasks data
 */
export const getOverdueTasks = async (filters = {}) => {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('No authentication token found');
    }

    // Build query params
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.priority && filters.priority !== 'all') params.append('priority', filters.priority);
    if (filters.category && filters.category !== 'all') params.append('category', filters.category);

    const response = await axios.get(
      `${API_BASE_URL}/tasks/overdue?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error fetching overdue tasks:', error);
    throw error;
  }
};

/**
 * Get overdue task statistics
 * @returns {Promise} - Overdue tasks statistics
 */
export const getOverdueTaskStats = async () => {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await axios.get(
      `${API_BASE_URL}/tasks/overdue/stats`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error fetching overdue task stats:', error);
    throw error;
  }
};
