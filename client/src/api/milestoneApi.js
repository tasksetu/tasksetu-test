/**
 * Milestone Task API Functions
 * Provides methods to interact with milestone task endpoints
 */

import axios from 'axios';

// Base URL for milestone tasks
const MILESTONE_API_BASE = '/api/milestone-tasks';

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json'
  };
};

/**
 * Create a new milestone task
 * @param {Object} milestoneData - Milestone data
 * @returns {Promise} API response
 */
export const createMilestone = async (milestoneData) => {
  try {
    console.log('Creating milestone with data:', milestoneData);
    
    const response = await axios.post(MILESTONE_API_BASE, milestoneData, {
      headers: getAuthHeaders()
    });
    
    console.log('Milestone created successfully:', response.data);
    return response;
  } catch (error) {
    console.error('Error creating milestone:', error);
    throw error;
  }
};

/**
 * Get all milestone tasks for the authenticated user
 * @param {Object} params - Query parameters
 * @returns {Promise} API response
 */
export const getMilestones = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `${MILESTONE_API_BASE}?${queryParams}` : MILESTONE_API_BASE;
    
    const response = await axios.get(url, {
      headers: getAuthHeaders()
    });
    
    return response;
  } catch (error) {
    console.error('Error fetching milestones:', error);
    throw error;
  }
};

/**
 * Get a single milestone task by ID
 * @param {string} milestoneId - Milestone ID
 * @returns {Promise} API response
 */
export const getMilestoneById = async (milestoneId) => {
  try {
    const response = await axios.get(`${MILESTONE_API_BASE}/${milestoneId}`, {
      headers: getAuthHeaders()
    });
    
    return response;
  } catch (error) {
    console.error('Error fetching milestone:', error);
    throw error;
  }
};

/**
 * Update a milestone task
 * @param {string} milestoneId - Milestone ID
 * @param {Object} updateData - Data to update
 * @returns {Promise} API response
 */
export const updateMilestone = async (milestoneId, updateData) => {
  try {
    console.log('Updating milestone:', milestoneId, 'with data:', updateData);
    
    const response = await axios.put(`${MILESTONE_API_BASE}/${milestoneId}`, updateData, {
      headers: getAuthHeaders()
    });
    
    console.log('Milestone updated successfully:', response.data);
    return response;
  } catch (error) {
    console.error('Error updating milestone:', error);
    throw error;
  }
};

/**
 * Delete a milestone task
 * @param {string} milestoneId - Milestone ID
 * @returns {Promise} API response
 */
export const deleteMilestone = async (milestoneId) => {
  try {
    console.log('Deleting milestone:', milestoneId);
    
    const response = await axios.delete(`${MILESTONE_API_BASE}/${milestoneId}`, {
      headers: getAuthHeaders()
    });
    
    console.log('Milestone deleted successfully:', response.data);
    return response;
  } catch (error) {
    console.error('Error deleting milestone:', error);
    throw error;
  }
};

/**
 * Link a task to a milestone
 * @param {string} milestoneId - Milestone ID
 * @param {Object} taskData - Task data to link
 * @returns {Promise} API response
 */
export const linkTaskToMilestone = async (milestoneId, taskData) => {
  try {
    console.log('Linking task to milestone:', milestoneId, 'task:', taskData);
    
    const response = await axios.post(`${MILESTONE_API_BASE}/${milestoneId}/link-task`, taskData, {
      headers: getAuthHeaders()
    });
    
    console.log('Task linked successfully:', response.data);
    return response;
  } catch (error) {
    console.error('Error linking task to milestone:', error);
    throw error;
  }
};

/**
 * Unlink a task from a milestone
 * @param {string} milestoneId - Milestone ID
 * @param {string} taskId - Task ID to unlink
 * @returns {Promise} API response
 */
export const unlinkTaskFromMilestone = async (milestoneId, taskId) => {
  try {
    console.log('Unlinking task from milestone:', milestoneId, 'task:', taskId);
    
    const response = await axios.delete(`${MILESTONE_API_BASE}/${milestoneId}/unlink-task/${taskId}`, {
      headers: getAuthHeaders()
    });
    
    console.log('Task unlinked successfully:', response.data);
    return response;
  } catch (error) {
    console.error('Error unlinking task from milestone:', error);
    throw error;
  }
};

/**
 * Add comment to milestone
 * @param {string} milestoneId - Milestone ID
 * @param {Object} commentData - Comment data
 * @returns {Promise} API response
 */
export const addMilestoneComment = async (milestoneId, commentData) => {
  try {
    console.log('Adding comment to milestone:', milestoneId, 'comment:', commentData);
    
    const response = await axios.post(`${MILESTONE_API_BASE}/${milestoneId}/comments`, commentData, {
      headers: getAuthHeaders()
    });
    
    console.log('Comment added successfully:', response.data);
    return response;
  } catch (error) {
    console.error('Error adding comment to milestone:', error);
    throw error;
  }
};

/**
 * Mark milestone as achieved
 * @param {string} milestoneId - Milestone ID
 * @param {Object} data - Achievement data
 * @returns {Promise} API response
 */
export const markMilestoneAsAchieved = async (milestoneId, data = {}) => {
  try {
    console.log('Marking milestone as achieved:', milestoneId);
    
    const response = await axios.patch(`${MILESTONE_API_BASE}/${milestoneId}/achieve`, data, {
      headers: getAuthHeaders()
    });
    
    console.log('Milestone marked as achieved:', response.data);
    return response;
  } catch (error) {
    console.error('Error marking milestone as achieved:', error);
    throw error;
  }
};

/**
 * Get milestone statistics
 * @returns {Promise} API response
 */
export const getMilestoneStats = async () => {
  try {
    const response = await axios.get(`${MILESTONE_API_BASE}/stats`, {
      headers: getAuthHeaders()
    });
    
    return response;
  } catch (error) {
    console.error('Error fetching milestone stats:', error);
    throw error;
  }
};