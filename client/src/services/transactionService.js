/**
 * Transaction History Service
 * Frontend API calls for transaction history
 * Used in Billing page to display payment history
 */

const API_BASE = '/api/transaction-history';

// Get authorization token
const getAuthToken = () => {
    return localStorage.getItem('token');
};

// Common fetch options with auth header
const getFetchOptions = (method = 'GET') => ({
    method,
    headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json',
    },
});

/**
 * Get all transactions for the organization
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 10)
 * @param {string} status - Filter by status (PENDING, COMPLETED, FAILED, CANCELLED, REFUNDED)
 * @returns {Promise} Transaction data with pagination info
 */
export const getOrganizationTransactions = async (page = 1, limit = 10, status = null) => {
    try {
        let url = `${API_BASE}/organization?page=${page}&limit=${limit}`;
        if (status) {
            url += `&status=${status}`;
        }

        const response = await fetch(url, getFetchOptions());

        if (!response.ok) {
            throw new Error(`Failed to fetch transactions: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('❌ Error fetching organization transactions:', error);
        throw error;
    }
};

/**
 * Get a specific transaction by ID
 * @param {string} transactionId - Transaction ID
 * @returns {Promise} Transaction details
 */
export const getTransactionById = async (transactionId) => {
    try {
        const response = await fetch(`${API_BASE}/${transactionId}`, getFetchOptions());

        if (!response.ok) {
            throw new Error(`Failed to fetch transaction: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('❌ Error fetching transaction:', error);
        throw error;
    }
};

/**
 * Create a new transaction record (called before Razorpay payment)
 * @param {Object} transactionData - Transaction details
 * @returns {Promise} Created transaction ID
 */
export const createTransaction = async (transactionData) => {
    try {
        const response = await fetch(`${API_BASE}/create`, {
            ...getFetchOptions('POST'),
            body: JSON.stringify(transactionData),
        });

        if (!response.ok) {
            throw new Error(`Failed to create transaction: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('❌ Error creating transaction:', error);
        throw error;
    }
};

/**
 * Mark transaction as completed after successful Razorpay payment
 * @param {string} transactionId - Transaction ID
 * @param {Object} paymentDetails - Razorpay payment details
 * @returns {Promise} Updated transaction
 */
export const completeTransaction = async (transactionId, paymentDetails) => {
    try {
        const response = await fetch(`${API_BASE}/${transactionId}/complete`, {
            ...getFetchOptions('PUT'),
            body: JSON.stringify(paymentDetails),
        });

        if (!response.ok) {
            throw new Error(`Failed to complete transaction: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('❌ Error completing transaction:', error);
        throw error;
    }
};

/**
 * Mark transaction as failed
 * @param {string} transactionId - Transaction ID
 * @param {Object} errorDetails - Error information
 * @returns {Promise} Updated transaction
 */
export const failTransaction = async (transactionId, errorDetails) => {
    try {
        const response = await fetch(`${API_BASE}/${transactionId}/fail`, {
            ...getFetchOptions('PUT'),
            body: JSON.stringify(errorDetails),
        });

        if (!response.ok) {
            throw new Error(`Failed to update transaction: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('❌ Error failing transaction:', error);
        throw error;
    }
};

/**
 * Process refund for a transaction
 * @param {string} transactionId - Transaction ID
 * @param {Object} refundDetails - Refund information
 * @returns {Promise} Updated transaction
 */
export const refundTransaction = async (transactionId, refundDetails) => {
    try {
        const response = await fetch(`${API_BASE}/${transactionId}/refund`, {
            ...getFetchOptions('POST'),
            body: JSON.stringify(refundDetails),
        });

        if (!response.ok) {
            throw new Error(`Failed to refund transaction: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('❌ Error refunding transaction:', error);
        throw error;
    }
};

/**
 * Search transactions by criteria
 * @param {Object} filters - Search filters
 * @returns {Promise} Array of matching transactions
 */
export const searchTransactions = async (filters = {}) => {
    try {
        const queryParams = new URLSearchParams();

        if (filters.license_code) queryParams.append('license_code', filters.license_code);
        if (filters.status) queryParams.append('status', filters.status);
        if (filters.start_date) queryParams.append('start_date', filters.start_date);
        if (filters.end_date) queryParams.append('end_date', filters.end_date);
        if (filters.transaction_id) queryParams.append('transaction_id', filters.transaction_id);

        const url = `${API_BASE}/search?${queryParams.toString()}`;
        const response = await fetch(url, getFetchOptions());

        if (!response.ok) {
            throw new Error(`Failed to search transactions: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('❌ Error searching transactions:', error);
        throw error;
    }
};

/**
 * Get transaction statistics for the organization
 * @returns {Promise} Transaction statistics
 */
export const getTransactionStats = async () => {
    try {
        const response = await fetch(`${API_BASE}/stats`, getFetchOptions());

        if (!response.ok) {
            throw new Error(`Failed to fetch statistics: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('❌ Error fetching transaction stats:', error);
        throw error;
    }
};

export default {
    getOrganizationTransactions,
    getTransactionById,
    createTransaction,
    completeTransaction,
    failTransaction,
    refundTransaction,
    searchTransactions,
    getTransactionStats,
};
