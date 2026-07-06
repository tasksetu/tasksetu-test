/**
 * Billing Details Service
 * Frontend API calls for managing billing details
 */

const API_BASE = '/api/billing-details';

const getAuthToken = () => localStorage.getItem('token');

const getFetchOptions = (method = 'GET') => ({
    method,
    headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json',
    },
});

/**
 * Get all billing details for organization
 */
export const getAllBillingDetails = async () => {
    try {
        const response = await fetch(API_BASE, {
            ...getFetchOptions('GET')
        });

        if (!response.ok) {
            throw new Error('Failed to fetch billing details');
        }

        const data = await response.json();
        return data.data || [];

    } catch (error) {
        console.error('❌ Error fetching billing details:', error);
        throw error;
    }
};

/**
 * Get single billing details
 */
export const getBillingDetailsById = async (billingDetailsId) => {
    try {
        const response = await fetch(`${API_BASE}/${billingDetailsId}`, {
            ...getFetchOptions('GET')
        });

        if (!response.ok) {
            throw new Error('Failed to fetch billing details');
        }

        const data = await response.json();
        return data.data;

    } catch (error) {
        console.error('❌ Error fetching billing details:', error);
        throw error;
    }
};

/**
 * Create new billing details
 */
export const createBillingDetails = async (billingData) => {
    try {
        const response = await fetch(API_BASE, {
            ...getFetchOptions('POST'),
            body: JSON.stringify(billingData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create billing details');
        }

        const data = await response.json();
        console.log('✅ Billing details created:', data.data._id);
        return data.data;

    } catch (error) {
        console.error('❌ Error creating billing details:', error);
        throw error;
    }
};

/**
 * Update billing details
 */
export const updateBillingDetails = async (billingDetailsId, billingData) => {
    try {
        const response = await fetch(`${API_BASE}/${billingDetailsId}`, {
            ...getFetchOptions('PUT'),
            body: JSON.stringify(billingData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to update billing details');
        }

        const data = await response.json();
        console.log('✅ Billing details updated:', billingDetailsId);
        return data.data;

    } catch (error) {
        console.error('❌ Error updating billing details:', error);
        throw error;
    }
};

/**
 * Delete billing details
 */
export const deleteBillingDetails = async (billingDetailsId) => {
    try {
        const response = await fetch(`${API_BASE}/${billingDetailsId}`, {
            ...getFetchOptions('DELETE')
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to delete billing details');
        }

        console.log('✅ Billing details deleted:', billingDetailsId);
        return true;

    } catch (error) {
        console.error('❌ Error deleting billing details:', error);
        throw error;
    }
};

/**
 * Set billing details as default
 */
export const setDefaultBillingDetails = async (billingDetailsId) => {
    try {
        const response = await fetch(`${API_BASE}/${billingDetailsId}/set-default`, {
            ...getFetchOptions('POST')
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to set as default');
        }

        const data = await response.json();
        console.log('✅ Set as default:', billingDetailsId);
        return data.data;

    } catch (error) {
        console.error('❌ Error setting as default:', error);
        throw error;
    }
};

export default {
    getAllBillingDetails,
    getBillingDetailsById,
    createBillingDetails,
    updateBillingDetails,
    deleteBillingDetails,
    setDefaultBillingDetails
};
