/**
 * Reports Service
 * Frontend API service for analytics and reporting endpoints
 * Document Reference: Section 6.0 - Reporting & Analytics Module
 */

import axios from 'axios';

const API_BASE_URL = '/api/reports';

/**
 * Get authentication headers with token
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
};

/**
 * Generic fetcher for reports
 * @param {string} endpoint - The report endpoint
 * @param {Object} filters - Filter criteria
 */
const fetchReport = async (endpoint, filters = {}) => {
  try {
    const params = new URLSearchParams();

    if (filters.startDate && filters.endDate) {
      params.append('startDate', filters.startDate);
      params.append('endDate', filters.endDate);
    } else if (filters.dateRange) {
      params.append('dateRange', filters.dateRange);
    } else {
      params.append('dateRange', '30');
    }

    if (filters.status) params.append('status', filters.status);
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.userId) params.append('userId', filters.userId);
    if (filters.teamId) params.append('teamId', filters.teamId);

    const response = await axios.get(
      `${API_BASE_URL}${endpoint}?${params.toString()}`,
      getAuthHeaders()
    );

    return response.data;
  } catch (error) {
    console.error(`Error fetching ${endpoint} report:`, error);
    throw error.response?.data || error;
  }
};

/**
 * Individual report fetchers
 */
export const getMyProductivity = (filters) => fetchReport('/my-productivity', filters);
export const getMilestoneAchievement = (filters) => fetchReport('/milestone-achievement', filters);
export const getRecurringTaskAdherence = (filters) => fetchReport('/recurring-task-adherence', filters);
export const getQuickTaskConversion = (filters) => fetchReport('/quick-task-conversion', filters);
export const getOverdueTasks = (filters) => fetchReport('/overdue-tasks', filters);
export const getProductivityEfficiency = (filters) => fetchReport('/productivity-efficiency', filters);
export const getActivityEngagement = (filters) => fetchReport('/activity-engagement', filters);
export const getTeamAnalytics = (filters) => fetchReport('/team-analytics', filters);
export const getWorkloadDistribution = (filters) => fetchReport('/workload-distribution', filters);
export const getOrganizationAnalytics = (filters) => fetchReport('/organization-analytics', filters);

/**
 * Export Report Data
 * @param {string} reportType - Type of report to export
 * @param {string} format - Export format (csv, xlsx, pdf)
 * @param {Object} filters - Filter criteria
 * @returns {Promise} - Exported file data
 */
export const exportReport = async (reportType, format = 'csv', filters = {}) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/export`,
      {
        reportType,
        format,
        filters
      },
      {
        ...getAuthHeaders(),
        responseType: format === 'pdf' ? 'blob' : 'json'
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error exporting report:', error);
    throw error.response?.data || error;
  }
};

// Export all service functions
const reportsService = {
  getMyProductivity,
  getMilestoneAchievement,
  getRecurringTaskAdherence,
  getQuickTaskConversion,
  getOverdueTasks,
  getProductivityEfficiency,
  getActivityEngagement,
  getTeamAnalytics,
  getWorkloadDistribution,
  getOrganizationAnalytics,
  exportReport
};

export default reportsService;
