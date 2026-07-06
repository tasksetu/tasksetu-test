// API for support tickets
import { apiClient } from "../utils/apiClient";

const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
        Authorization: token ? `Bearer ${token}` : undefined,
    };
};

export const supportAPI = {
    /**
     * Create a new support ticket
     */
    async createTicket(ticketData) {
        const formData = new FormData();
        formData.append('subject', ticketData.subject);
        formData.append('message', ticketData.message);
        formData.append('priority', ticketData.priority);
        formData.append('category', ticketData.category);

        // Append files if present
        if (ticketData.files && ticketData.files.length > 0) {
            ticketData.files.forEach((file) => {
                formData.append('attachments', file);
            });
        }

        const response = await apiClient.post("/api/support/tickets", formData, {
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    /**
     * Get all support tickets for the current user
     */
    async getTickets(params = {}) {
        const { status, priority, page = 1, limit = 10 } = params;
        const queryParams = new URLSearchParams();

        if (status) queryParams.append("status", status);
        if (priority) queryParams.append("priority", priority);
        queryParams.append("page", page.toString());
        queryParams.append("limit", limit.toString());

        const response = await apiClient.get(
            `/api/support/tickets?${queryParams.toString()}`,
            {
                headers: getAuthHeaders(),
            }
        );
        return response.data;
    },

    /**
     * Get a specific support ticket by ID
     */
    async getTicketById(ticketId) {
        const response = await apiClient.get(`/api/support/tickets/${ticketId}`, {
            headers: getAuthHeaders(),
        });
        return response.data;
    },

    /**
     * Update a support ticket
     */
    async updateTicket(ticketId, updateData) {
        const response = await apiClient.patch(
            `/api/support/tickets/${ticketId}`,
            updateData,
            {
                headers: getAuthHeaders(),
            }
        );
        return response.data;
    },

    /**
     * Add a response to a support ticket
     */
    async addResponse(ticketId, message) {
        const response = await apiClient.post(
            `/api/support/tickets/${ticketId}/response`,
            { message },
            {
                headers: getAuthHeaders(),
            }
        );
        return response.data;
    },

    /**
     * Close a support ticket
     */
    async closeTicket(ticketId, feedback = {}) {
        const response = await apiClient.patch(
            `/api/support/tickets/${ticketId}/close`,
            feedback,
            {
                headers: getAuthHeaders(),
            }
        );
        return response.data;
    },

    /**
     * Delete a support ticket
     */
    async deleteTicket(ticketId) {
        const response = await apiClient.delete(`/api/support/tickets/${ticketId}`, {
            headers: getAuthHeaders(),
        });
        return response.data;
    },

    // Admin APIs
    /**
     * Get all support tickets (Admin only)
     */
    async getAdminTickets(params = {}) {
        const { status, priority, organizationId, page = 1, limit = 20 } = params;
        const queryParams = new URLSearchParams();

        if (status) queryParams.append("status", status);
        if (priority) queryParams.append("priority", priority);
        if (organizationId) queryParams.append("organizationId", organizationId.toString());
        queryParams.append("page", page.toString());
        queryParams.append("limit", limit.toString());

        const response = await apiClient.get(
            `/api/support/admin/tickets?${queryParams.toString()}`,
            {
                headers: getAuthHeaders(),
            }
        );
        return response.data;
    },

    /**
     * Assign a ticket to an agent (Admin only)
     */
    async assignTicket(ticketId, assignData) {
        const response = await apiClient.patch(
            `/api/support/admin/tickets/${ticketId}/assign`,
            assignData,
            {
                headers: getAuthHeaders(),
            }
        );
        return response.data;
    },

    /**
     * Update ticket status (Admin only)
     */
    async updateTicketStatus(ticketId, status) {
        const response = await apiClient.patch(
            `/api/support/admin/tickets/${ticketId}/status`,
            { status },
            {
                headers: getAuthHeaders(),
            }
        );
        return response.data;
    },

    /**
     * Add response as admin (Admin only)
     */
    async addAdminResponse(ticketId, message) {
        const response = await apiClient.post(
            `/api/support/admin/tickets/${ticketId}/response`,
            { message },
            {
                headers: getAuthHeaders(),
            }
        );
        return response.data;
    },
};
