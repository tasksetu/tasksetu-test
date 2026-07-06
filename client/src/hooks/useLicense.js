/**
 * useLicense Hook
 * 
 * Centralized license management for frontend
 * Fetches and caches license information, provides feature access checks
 * 
 * Usage:
 * const { license, features, checkFeature, isLoading, refreshLicense } = useLicense();
 * 
 * if (checkFeature('TASK_APPROVAL')) {
 *   // Show approval task UI
 * } else {
 *   // Show lock icon or upgrade prompt
 * }
 */

import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../utils/apiClient';

const LICENSE_CACHE_KEY = 'tasksetu_license_cache';

export const useLicense = () => {
    const queryClient = useQueryClient();

    // Clean up legacy localStorage cache on mount
    useEffect(() => {
        if (localStorage.getItem(LICENSE_CACHE_KEY)) {
            localStorage.removeItem(LICENSE_CACHE_KEY);
        }
    }, []);

    const { data, isLoading, error } = useQuery({
        queryKey: ['current-license-info'],
        queryFn: async () => {
            const [licenseResponse, featuresResponse] = await Promise.all([
                apiClient.get('/api/license/current'),
                apiClient.get('/api/license/features-access'),
            ]);

            const licenseData = licenseResponse.data;
            const featuresData = featuresResponse.data.features || {};

            return {
                license: {
                    code: licenseData.license,
                    name: licenseData.licenseName,
                    status: licenseData.status,
                    expiry: licenseData.expiry,
                    usage: licenseData.usage || {},
                    entityType: licenseData.entityType,
                },
                features: featuresData,
            };
        },
        staleTime: 5 * 60 * 1000, // 5 minutes cache duration
        retry: 1,
    });

    const license = data?.license || (error ? {
        code: 'EXPLORE',
        name: 'Explore (Free)',
        status: 'TRIAL',
        usage: {},
    } : null);

    const features = data?.features || {};

    /**
     * Refresh license data (clear cache and refetch)
     */
    const refreshLicense = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['current-license-info'] });
    }, [queryClient]);

    /**
     * Check if a feature is accessible
     * @param {string} featureCode - Feature code to check (e.g., 'TASK_APPROVAL')
     * @returns {boolean} - True if feature is accessible
     */
    const checkFeature = useCallback((featureCode) => {
        return features[featureCode] === true;
    }, [features]);

    /**
     * Get usage percentage for a feature
     * @param {string} featureCode - Feature code
     * @returns {number} - Usage percentage (0-100)
     */
    const getUsagePercent = useCallback((featureCode) => {
        if (!license || !license.usage || !license.usage[featureCode]) {
            return 0;
        }
        return license.usage[featureCode].percentage || 0;
    }, [license]);

    /**
     * Check if usage is near limit (>80%)
     * @param {string} featureCode - Feature code
     * @returns {boolean} - True if near limit
     */
    const isNearLimit = useCallback((featureCode) => {
        return getUsagePercent(featureCode) >= 80;
    }, [getUsagePercent]);

    /**
     * Check if license is expired
     * @returns {boolean} - True if expired
     */
    const isExpired = useCallback(() => {
        if (!license) return false;
        return license.status === 'EXPIRED';
    }, [license]);

    /**
     * Check if on trial
     * @returns {boolean} - True if on trial
     */
    const isTrial = useCallback(() => {
        if (!license) return false;
        return license.status === 'TRIAL';
    }, [license]);

    return {
        license,
        features,
        isLoading,
        error: error ? error.message || 'Failed to fetch license information' : null,
        checkFeature,
        getUsagePercent,
        isNearLimit,
        isExpired,
        isTrial,
        refreshLicense,
    };
};

export default useLicense;

