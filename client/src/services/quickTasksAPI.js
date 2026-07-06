// Quick Tasks API Service
// This file provides API functions for Quick Tasks management

const API_BASE_URL = '/api/quick-tasks';

class QuickTasksAPI {
  constructor() {
    this.mockData = [];
  }

  // Get authentication token
  getAuthToken() {
    const token = localStorage.getItem('token');

    // Debug token retrieval
    if (!token) {
      console.error('🔴 No token in localStorage');
      console.log('📦 localStorage keys:', Object.keys(localStorage));
    }

    return token;
  }

  // Get auth headers
  getAuthHeaders() {
    const token = this.getAuthToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  // GET /api/quick-tasks - Fetch all quick tasks for current user
  async fetchQuickTasks(params = {}) {
    try {
      const hasToken = !!this.getAuthToken();
      console.log('🔐 Has auth token:', hasToken);

      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value && value !== 'all') queryParams.append(key, value);
      });

      const url = queryParams.toString() ? `${API_BASE_URL}?${queryParams}` : API_BASE_URL;
      console.log('🔗 API URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        credentials: 'include'
      });

      console.log('📡 Fetch response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Fetch API Error:', errorData);

        // ✅ FIX: Don't clear token on licensing/feature errors (403)
        // Only clear on actual auth failures (401)
        if (response.status === 401) {
          localStorage.removeItem('token');
        }

        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Fetch API Success:', result);
      return result;
    } catch (error) {
      console.error('Error fetching quick tasks:', error);
      throw error;
    }
  }

  // POST /api/quick-tasks - Create new quick task
  async createQuickTask(taskData) {
    try {
      console.log('🚀 Frontend - Creating Quick Task');
      console.log('📋 taskData:', taskData);
      const token = this.getAuthToken();
      console.log('🔑 Auth token exists:', !!token);
      console.log('🔑 Auth token (masked):', token ? `${token.slice(0, 6)}...${token.slice(-6)}` : null);

      const hasToken = !!token;
      console.log('🔐 Create - Has auth token (final):', hasToken);

      // ✅ FIX: Always make real API call if token exists
      // Don't fall back to mock data - let backend handle auth/licensing errors
      if (!hasToken) {
        console.warn('⚠️ No auth token in localStorage. Please log in.');
        throw new Error('NO_AUTH_TOKEN - Please log in to create tasks');
      }

      console.log('🚀 Making real API call to create task');
      console.log('📤 Request URL:', API_BASE_URL);
      console.log('📤 Request body:', JSON.stringify(taskData));

      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(taskData),
        credentials: 'include'
      });

      console.log('📡 API Response status:', response.status);
      console.log('📡 API Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ API Error Response:', errorData);
        console.error('❌ Full error details:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          headers: Object.fromEntries(response.headers.entries())
        });

        // ✅ FIX: Only clear token on 401 (Unauthorized/Invalid Token)
        // 403 is a feature/licensing issue, NOT auth failure
        if (response.status === 401) {
          console.warn('🔐 API returned 401 (Invalid/Expired Token). Clearing local token.');
          try {
            localStorage.removeItem('token');
          } catch (e) {
            console.warn('Failed to remove token from localStorage', e);
          }

          const authErr = new Error('Session expired. Please log in again.');
          authErr.status = response.status;
          authErr.body = errorData;
          throw authErr;
        }

        // For 403 and other errors, pass through the error without clearing token
        const err = new Error(errorData.message || `HTTP error! status: ${response.status}`);
        err.status = response.status;
        err.body = errorData;
        throw err;
      }

      const result = await response.json();
      console.log('✅ API Success Response:', result);
      return result;
    } catch (error) {
      console.error('Error creating quick task:', error);
      // ✅ FIX: Re-throw the error instead of wrapping it
      // This preserves the original error details and status
      throw error;
    }
  }

  // PUT /api/quick-tasks/:id - Update quick task
  async updateQuickTask(taskId, updates) {
    try {
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('NO_AUTH_TOKEN - Please log in');
      }

      const response = await fetch(`${API_BASE_URL}/${taskId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(updates),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          localStorage.removeItem('token');
        }

        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating quick task:', error);
      throw error;
    }
  }

  // PATCH /api/quick-tasks/:id/status - Update task status
  async updateTaskStatus(taskId, status) {
    try {
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('NO_AUTH_TOKEN - Please log in');
      }

      const response = await fetch(`${API_BASE_URL}/${taskId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ status }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          localStorage.removeItem('token');
        }

        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating task status:', error);
      throw error;
    }
  }

  // DELETE /api/quick-tasks/:id - Delete quick task
  async deleteQuickTask(taskId) {
    try {
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('NO_AUTH_TOKEN - Please log in');
      }

      const response = await fetch(`${API_BASE_URL}/${taskId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          localStorage.removeItem('token');
        }

        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting quick task:', error);
      throw error;
    }
  }

  // POST /api/quick-tasks/:id/convert - Convert quick task to full task
  async convertToRegular(quickTaskId, conversionData) {
    try {
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('NO_AUTH_TOKEN - Please log in');
      }

      console.log('🔄 Converting Quick Task to Regular:', { quickTaskId, conversionData });

      const response = await fetch(`${API_BASE_URL}/${quickTaskId}/convert`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(conversionData),
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Conversion failed:', data);

        if (response.status === 401) {
          localStorage.removeItem('token');
        }

        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      console.log('✅ Quick Task converted successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Error converting quick task:', error);
      throw error;
    }
  }

  // GET /api/quick-tasks/stats - Get quick tasks statistics
  async getQuickTaskStats() {
    try {
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('NO_AUTH_TOKEN - Please log in');
      }

      const response = await fetch(`${API_BASE_URL}/stats`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          localStorage.removeItem('token');
        }

        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching quick task stats:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const quickTasksAPI = new QuickTasksAPI();
export default quickTasksAPI;