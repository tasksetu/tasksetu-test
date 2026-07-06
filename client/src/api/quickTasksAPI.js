// API for quick tasks
import { apiClient } from "../utils/apiClient";

export const quickTasksAPI = {
  async createQuickTask(taskData) {
    // Ensure Authorization header is sent
    const token = localStorage.getItem("token");
    const response = await apiClient.post("/api/quick-tasks", taskData, {
      headers: {
        Authorization: token ? `Bearer ${token}` : undefined,
      },
    });
    return response.data;
  },

  async getQuickTasks() {
    const token = localStorage.getItem("token");
    const response = await apiClient.get("/api/quick-tasks", {
      headers: {
        Authorization: token ? `Bearer ${token}` : undefined,
      },
    });
    return response.data;
  },
};
