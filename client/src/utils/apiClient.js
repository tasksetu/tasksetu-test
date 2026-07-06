import axios from "axios";
import { clearAuth } from "./auth";

export const apiClient = axios.create({
  baseURL: "/",
  withCredentials: true,
});

// Attach JWT token from localStorage to every request if present
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: Handle 401 token expired → auto-logout
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const data = error.response?.data || {};
      const message = data.message || data.error || '';

      // Check if it's a token expired error
      if (
        message.toLowerCase().includes('expired') ||
        message.toLowerCase().includes('token') ||
        data.expiredAt
      ) {
        console.log('🔐 [apiClient] Token expired — clearing auth and redirecting to login');
        clearAuth();
        localStorage.removeItem('tokenExpiry');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
