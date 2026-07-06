/**
 * 🎯 SUPER ADMIN LICENSE MANAGEMENT PORTAL
 * /admin/licenses
 * 
 * Capabilities:
 * - Search organizations
 * - View detailed license info
 * - Override licenses
 * - Extend trials
 * - Suspend/reactivate
 * - Toggle feature flags
 * - View audit logs
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './LicenseManagementPage.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
import { useShowToast } from "@/utils/ToastMessage";
import { Button } from '@/components/ui/button';

const LicenseManagementPage = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [organizations, setOrganizations] = useState([]);
    const [selectedOrg, setSelectedOrg] = useState(null);
    const [activeTab, setActiveTab] = useState('license');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { showSuccessToast, showErrorToast } = useShowToast();

    // Modals
    const [showOverrideModal, setShowOverrideModal] = useState(false);
    const [showExtendTrialModal, setShowExtendTrialModal] = useState(false);
    const [showSuspendModal, setShowSuspendModal] = useState(false);
    const [showFeatureFlagModal, setShowFeatureFlagModal] = useState(false);

    useEffect(() => {
        searchOrganizations();
    }, []);

    const searchOrganizations = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.get(`${API_BASE_URL}/api/super-admin/organizations/search`, {
                params: { q: searchQuery, limit: 50 }
            });
            setOrganizations(response.data.data || []);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load organizations');
        } finally {
            setLoading(false);
        }
    };

    const loadOrgDetails = async (orgId) => {
        try {
            const response = await axios.get(`/api/super-admin/organizations/${orgId}`);
            setSelectedOrg(response.data.data);
        } catch (err) {
            showErrorToast('Unable to load organization details');
        }
    };

    return (
        <div className="license-management-page">
            <div className="page-header">
                <h1>🌐 License Management Portal</h1>
                <p className="subtitle">Manage licenses for all organizations</p>
            </div>

            {/* Search Bar */}
            <div className="search-section">
                <div className="search-bar">
                    <input
                        type="text"
                        placeholder="Search by company name, email, or organization ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && searchOrganizations()}
                        className="search-input h-9"
                    />
                    <Button variant="primary" className="h-9" onClick={searchOrganizations}>
                        🔍 Search
                    </Button>
                </div>
            </div>

            {/* Organizations List */}
            <div className="content-layout">
                <div className="organizations-list">
                    <h3>Organizations ({organizations.length})</h3>

                    {loading && <div className="loading-spinner">Loading...</div>}

                    {error && (
                        <div className="error-box">{error}</div>
                    )}

                    {!loading && organizations.length === 0 && (
                        <div className="empty-state">
                            No organizations found. Try a different search.
                        </div>
                    )}

                    {organizations.map((org) => (
                        <OrganizationCard
                            key={org._id}
                            org={org}
                            isSelected={selectedOrg?._id === org._id}
                            onClick={() => loadOrgDetails(org._id)}
                        />
                    ))}
                </div>

                {/* Organization Details Panel */}
                {selectedOrg && (
                    <div className="organization-details">
                        <OrganizationHeader org={selectedOrg.organization} />

                        {/* Tabs */}
                        <div className="tabs">
                            <Button
                                variant={activeTab === 'license' ? 'primary' : 'outline'}
                                className={`tab h-9 ${activeTab === 'license' ? 'active' : ''}`}
                                onClick={() => setActiveTab('license')}
                            >
                                License & Usage
                            </Button>
                            <Button
                                variant={activeTab === 'billing' ? 'primary' : 'outline'}
                                className={`tab h-9 ${activeTab === 'billing' ? 'active' : ''}`}
                                onClick={() => setActiveTab('billing')}
                            >
                                Billing
                            </Button>
                            <Button
                                variant={activeTab === 'flags' ? 'primary' : 'outline'}
                                className={`tab h-9 ${activeTab === 'flags' ? 'active' : ''}`}
                                onClick={() => setActiveTab('flags')}
                            >
                                Feature Flags
                            </Button>
                            <Button
                                variant={activeTab === 'audit' ? 'primary' : 'outline'}
                                className={`tab h-9 ${activeTab === 'audit' ? 'active' : ''}`}
                                onClick={() => setActiveTab('audit')}
                            >
                                Audit Log
                            </Button>
                        </div>

                        {/* Tab Content */}
                        <div className="tab-content">
                            {activeTab === 'license' && (
                                <LicenseTab
                                    subscription={selectedOrg.subscription}
                                    licenseDetails={selectedOrg.licenseDetails}
                                    usageStats={selectedOrg.usageStats}
                                />
                            )}
                            {activeTab === 'billing' && (
                                <BillingTab subscription={selectedOrg.subscription} />
                            )}
                            {activeTab === 'flags' && (
                                <FeatureFlagsTab
                                    subscription={selectedOrg.subscription}
                                    onToggle={() => setShowFeatureFlagModal(true)}
                                />
                            )}
                            {activeTab === 'audit' && (
                                <AuditLogTab logs={selectedOrg.auditLogs} />
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="action-buttons">
                            <Button
                                variant="primary"
                                className="h-9"
                                onClick={() => setShowExtendTrialModal(true)}
                            >
                                🕒 Extend Trial
                            </Button>
                            <Button
                                variant="outline"
                                className="h-9"
                                onClick={() => setShowOverrideModal(true)}
                            >
                                ⚡ Override License
                            </Button>
                            <Button
                                variant="outline"
                                className="h-9 text-orange-600 hover:bg-orange-50"
                                onClick={() => setShowSuspendModal(true)}
                            >
                                🚫 {selectedOrg.subscription?.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                            </Button>
                        </div>

                        {/* Modals */}
                        {showOverrideModal && (
                            <OverrideLicenseModal
                                orgId={selectedOrg.organization._id}
                                currentLicense={selectedOrg.subscription?.license_code}
                                onClose={() => setShowOverrideModal(false)}
                                onSuccess={() => {
                                    setShowOverrideModal(false);
                                    loadOrgDetails(selectedOrg.organization._id);
                                }}
                            />
                        )}

                        {showExtendTrialModal && (
                            <ExtendTrialModal
                                orgId={selectedOrg.organization._id}
                                onClose={() => setShowExtendTrialModal(false)}
                                onSuccess={() => {
                                    setShowExtendTrialModal(false);
                                    loadOrgDetails(selectedOrg.organization._id);
                                }}
                            />
                        )}

                        {showSuspendModal && (
                            <SuspendModal
                                orgId={selectedOrg.organization._id}
                                currentStatus={selectedOrg.subscription?.status}
                                onClose={() => setShowSuspendModal(false)}
                                onSuccess={() => {
                                    setShowSuspendModal(false);
                                    loadOrgDetails(selectedOrg.organization._id);
                                }}
                            />
                        )}

                        {showFeatureFlagModal && (
                            <FeatureFlagModal
                                orgId={selectedOrg.organization._id}
                                onClose={() => setShowFeatureFlagModal(false)}
                                onSuccess={() => {
                                    setShowFeatureFlagModal(false);
                                    loadOrgDetails(selectedOrg.organization._id);
                                }}
                            />
                        )}
                    </div>
                )}

                {!selectedOrg && (
                    <div className="no-selection">
                        <div className="empty-icon">📋</div>
                        <h3>No Organization Selected</h3>
                        <p>Select an organization from the list to view details</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// ============================================================================
// ORGANIZATION CARD
// ============================================================================

const OrganizationCard = ({ org, isSelected, onClick }) => {
    const subscription = org.subscription;
    const statusColor = {
        'ACTIVE': 'green',
        'EXPIRED': 'red',
        'SUSPENDED': 'orange'
    }[subscription?.status] || 'gray';

    return (
        <div
            className={`org-card ${isSelected ? 'selected' : ''}`}
            onClick={onClick}
        >
            <div className="org-card-header">
                <h4>{org.name}</h4>
                <span className={`status-dot status-${statusColor}`}></span>
            </div>
            <div className="org-card-body">
                <p className="org-email">{org.email}</p>
                <div className="org-meta">
                    <span className="license-badge">
                        {subscription?.license_code || 'No License'}
                    </span>
                    <span className="users-count">
                        👥 {org.userCount} users
                    </span>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// ORGANIZATION HEADER
// ============================================================================

const OrganizationHeader = ({ org }) => {
    return (
        <div className="org-header">
            <div>
                <h2>{org.name}</h2>
                <p className="org-id">ID: {org._id}</p>
                <p className="org-email">📧 {org.email}</p>
                {org.phone && <p className="org-phone">📞 {org.phone}</p>}
            </div>
            <div className={`org-status status-${org.status}`}>
                {org.status}
            </div>
        </div>
    );
};

// ============================================================================
// LICENSE TAB
// ============================================================================

const LicenseTab = ({ subscription, licenseDetails, usageStats }) => {
    if (!subscription) {
        return <div className="no-data">No subscription found for this organization.</div>;
    }

    return (
        <div className="license-tab">
            {/* Subscription Info */}
            <div className="info-section">
                <h3>Subscription Details</h3>
                <div className="info-grid">
                    <InfoItem label="License Code" value={subscription.license_code} />
                    <InfoItem label="License Name" value={licenseDetails?.name || subscription.license_code} />
                    <InfoItem label="Status" value={subscription.status} badge />
                    <InfoItem label="Billing Cycle" value={subscription.billing_cycle || 'N/A'} />
                    <InfoItem
                        label="Start Date"
                        value={subscription.subscription_start_date
                            ? new Date(subscription.subscription_start_date).toLocaleDateString()
                            : 'N/A'}
                    />
                    <InfoItem
                        label="End Date"
                        value={subscription.subscription_end_date
                            ? new Date(subscription.subscription_end_date).toLocaleDateString()
                            : 'N/A'}
                    />
                    <InfoItem label="Seats Purchased" value={subscription.seats_purchased || 0} />
                    <InfoItem label="Seats Used" value={subscription.seats_used || 0} />
                </div>
            </div>

            {/* Usage Statistics */}
            <div className="info-section">
                <h3>Feature Usage</h3>
                {usageStats && usageStats.length > 0 ? (
                    <div className="usage-list">
                        {usageStats.map((stat, index) => (
                            <div key={index} className="usage-item">
                                <span className="feature-code">{stat.feature_code}</span>
                                <span className="usage-value">{stat.current_usage || 0}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="no-data">No usage data available</p>
                )}
            </div>

            {/* Override Info */}
            {subscription.override_reason && (
                <div className="info-section override-info">
                    <h3>⚠️ Override Information</h3>
                    <p><strong>Reason:</strong> {subscription.override_reason}</p>
                    <p><strong>Overridden At:</strong> {new Date(subscription.overridden_at).toLocaleString()}</p>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// BILLING TAB
// ============================================================================

const BillingTab = ({ subscription }) => {
    return (
        <div className="billing-tab">
            <div className="info-section">
                <h3>Billing Information</h3>
                <div className="info-grid">
                    <InfoItem label="Billing Cycle" value={subscription?.billing_cycle || 'N/A'} />
                    <InfoItem label="Seats Purchased" value={subscription?.seats_purchased || 0} />
                    <InfoItem
                        label="Next Billing Date"
                        value={subscription?.subscription_end_date
                            ? new Date(subscription.subscription_end_date).toLocaleDateString()
                            : 'N/A'}
                    />
                </div>
            </div>
            <p className="coming-soon">💳 Payment gateway integration coming soon...</p>
        </div>
    );
};

// ============================================================================
// FEATURE FLAGS TAB
// ============================================================================

const FeatureFlagsTab = ({ subscription, onToggle }) => {
    const overrides = subscription?.feature_overrides || [];

    return (
        <div className="feature-flags-tab">
            <div className="flags-header">
                <h3>Feature Flag Overrides</h3>
                <Button variant="primary" className="h-9" onClick={onToggle}>
                    + Add Override
                </Button>
            </div>

            {overrides.length > 0 ? (
                <div className="flags-list">
                    {overrides.map((override, index) => (
                        <div key={index} className="flag-item">
                            <div className="flag-info">
                                <span className="flag-code">{override.feature_code}</span>
                                <span className={`flag-status ${override.enabled ? 'enabled' : 'disabled'}`}>
                                    {override.enabled ? '✅ Enabled' : '❌ Disabled'}
                                </span>
                            </div>
                            <p className="flag-reason">{override.reason}</p>
                            <p className="flag-date">
                                {new Date(override.overridden_at).toLocaleString()}
                            </p>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="no-data">No feature overrides configured</p>
            )}
        </div>
    );
};

// ============================================================================
// AUDIT LOG TAB
// ============================================================================

const AuditLogTab = ({ logs }) => {
    return (
        <div className="audit-log-tab">
            <h3>Recent Actions</h3>
            {logs && logs.length > 0 ? (
                <div className="audit-list">
                    {logs.map((log) => (
                        <div key={log._id} className="audit-item">
                            <div className="audit-header">
                                <span className="audit-action">{log.action}</span>
                                <span className="audit-date">
                                    {new Date(log.timestamp).toLocaleString()}
                                </span>
                            </div>
                            <p className="audit-summary">{log.change_summary}</p>
                            {log.actor_id && (
                                <p className="audit-actor">
                                    By: {log.actor_id.firstName} {log.actor_id.lastName}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="no-data">No audit logs found</p>
            )}
        </div>
    );
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const InfoItem = ({ label, value, badge }) => {
    return (
        <div className="info-item">
            <span className="info-label">{label}</span>
            <span className={`info-value ${badge ? 'badge' : ''}`}>{value}</span>
        </div>
    );
};

// ============================================================================
// MODALS (Continued in next file due to length...)
// ============================================================================

const OverrideLicenseModal = ({ orgId, currentLicense, onClose, onSuccess }) => {
    const [license, setLicense] = useState('PLAN');
    const [reason, setReason] = useState('');
    const [billingCycle, setBillingCycle] = useState('MONTHLY');
    const [seats, setSeats] = useState(10);
    const [extendDays, setExtendDays] = useState(30);
    const [loading, setLoading] = useState(false);
    const { showSuccessToast, showErrorToast } = useShowToast();

    const handleSubmit = async () => {
        if (!reason.trim()) {
            showErrorToast('Provide a reason for overriding the license');
            return;
        }

        setLoading(true);
        try {
            await axios.post(`/api/super-admin/organizations/${orgId}/override-license`, {
                license_code: license,
                reason,
                billing_cycle: billingCycle,
                seats,
                extend_days: extendDays
            });
            showSuccessToast('License overridden');
            onSuccess();
        } catch (err) {
            showErrorToast(err.response?.data?.message || 'Unable to override license');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalWrapper onClose={onClose} title="Override License">
            <div className="modal-form">
                <div className="form-group">
                    <label>License Code</label>
                    <select value={license} onChange={(e) => setLicense(e.target.value)}>
                        <option value="EXPLORE">Explore (Free)</option>
                        <option value="PLAN">Plan</option>
                        <option value="EXECUTE">Execute</option>
                        <option value="OPTIMIZE">Optimize</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>Billing Cycle</label>
                    <select value={billingCycle} onChange={(e) => setBillingCycle(e.target.value)}>
                        <option value="MONTHLY">Monthly</option>
                        <option value="YEARLY">Yearly</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>Number of Seats</label>
                    <input
                        type="number"
                        value={seats}
                        onChange={(e) => setSeats(parseInt(e.target.value))}
                        min="1"
                    />
                </div>

                <div className="form-group">
                    <label>Extend Days</label>
                    <input
                        type="number"
                        value={extendDays}
                        onChange={(e) => setExtendDays(parseInt(e.target.value))}
                        min="1"
                    />
                </div>

                <div className="form-group">
                    <label>Reason *</label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Explain why you're overriding this license..."
                        rows="3"
                    />
                </div>

                <div className="modal-actions">
                    <Button variant="outline" className="h-9" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" className="h-9" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Processing...' : 'Override License'}
                    </Button>
                </div>
            </div>
        </ModalWrapper>
    );
};

const ExtendTrialModal = ({ orgId, onClose, onSuccess }) => {
    const [days, setDays] = useState(14);
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const { showSuccessToast, showErrorToast } = useShowToast();

    const handleSubmit = async () => {
        if (!reason.trim()) {
            showErrorToast('Please provide a reason');
            return;
        }

        setLoading(true);
        try {
            await axios.post(`/api/super-admin/organizations/${orgId}/extend-trial`, {
                days,
                reason
            });
            showSuccessToast(`Trial extended by ${days} days`);
            onSuccess();
        } catch (err) {
            showErrorToast(err.response?.data?.message || 'Unable to extend trial');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalWrapper onClose={onClose} title="Extend Trial Period">
            <div className="modal-form">
                <div className="form-group">
                    <label>Extend by (days)</label>
                    <input
                        type="number"
                        value={days}
                        onChange={(e) => setDays(parseInt(e.target.value))}
                        min="1"
                        max="365"
                    />
                </div>

                <div className="form-group">
                    <label>Reason *</label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Explain why you're extending the trial..."
                        rows="3"
                    />
                </div>

                <div className="modal-actions">
                    <Button variant="outline" className="h-9" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" className="h-9" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Processing...' : 'Extend Trial'}
                    </Button>
                </div>
            </div>
        </ModalWrapper>
    );
};

const SuspendModal = ({ orgId, currentStatus, onClose, onSuccess }) => {
    const isSuspended = currentStatus === 'SUSPENDED';
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const { showSuccessToast, showErrorToast } = useShowToast();

    const handleSubmit = async () => {
        if (!reason.trim()) {
            showErrorToast('Please provide a reason');
            return;
        }

        setLoading(true);
        try {
            await axios.post(`/api/super-admin/organizations/${orgId}/suspend`, {
                suspend: !isSuspended,
                reason
            });
            showSuccessToast(`License ${isSuspended ? 'reactivated' : 'suspended'}`);
            onSuccess();
        } catch (err) {
            showErrorToast(err.response?.data?.message || 'Unable to update status');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalWrapper
            onClose={onClose}
            title={isSuspended ? 'Reactivate License' : 'Suspend License'}
        >
            <div className="modal-form">
                <div className="warning-box">
                    {isSuspended
                        ? '⚠️ This will reactivate the license and restore access.'
                        : '⚠️ This will suspend the license and block all access.'}
                </div>

                <div className="form-group">
                    <label>Reason *</label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Explain the reason..."
                        rows="3"
                    />
                </div>

                <div className="modal-actions">
                    <Button variant="outline" className="h-9" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant={isSuspended ? 'primary' : 'outline'}
                        className={`h-9 ${!isSuspended ? 'text-orange-600 hover:bg-orange-50' : ''}`}
                        onClick={handleSubmit}
                        disabled={loading}
                    >
                        {loading ? 'Processing...' : isSuspended ? 'Reactivate' : 'Suspend'}
                    </Button>
                </div>
            </div>
        </ModalWrapper>
    );
};

const FeatureFlagModal = ({ orgId, onClose, onSuccess }) => {
    const [featureCode, setFeatureCode] = useState('SSO_LOGIN');
    const [enabled, setEnabled] = useState(true);
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const { showSuccessToast, showErrorToast } = useShowToast();

    const handleSubmit = async () => {
        if (!reason.trim()) {
            showErrorToast('Please provide a reason');
            return;
        }

        setLoading(true);
        try {
            await axios.post(`/api/super-admin/organizations/${orgId}/feature-flags`, {
                feature_code: featureCode,
                enabled,
                reason
            });
            showSuccessToast('Feature flag updated');
            onSuccess();
        } catch (err) {
            showErrorToast(err.response?.data?.message || 'Unable to update feature flag');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalWrapper onClose={onClose} title="Override Feature Flag">
            <div className="modal-form">
                <div className="form-group">
                    <label>Feature Code</label>
                    <select value={featureCode} onChange={(e) => setFeatureCode(e.target.value)}>
                        <option value="SSO_LOGIN">SSO Login</option>
                        <option value="API_ACCESS">API Access</option>
                        <option value="AUDIT_LOG">Audit Logs</option>
                        <option value="CUSTOM_ROLE">Custom Roles</option>
                        <option value="TASK_APPROVAL">Task Approvals</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>Status</label>
                    <div className="radio-group">
                        <label>
                            <input
                                type="radio"
                                checked={enabled}
                                onChange={() => setEnabled(true)}
                            />
                            Enable
                        </label>
                        <label>
                            <input
                                type="radio"
                                checked={!enabled}
                                onChange={() => setEnabled(false)}
                            />
                            Disable
                        </label>
                    </div>
                </div>

                <div className="form-group">
                    <label>Reason *</label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Explain why you're overriding this feature..."
                        rows="3"
                    />
                </div>

                <div className="modal-actions">
                    <Button variant="outline" className="h-9" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" className="h-9" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Processing...' : 'Update Flag'}
                    </Button>
                </div>
            </div>
        </ModalWrapper>
    );
};

const ModalWrapper = ({ onClose, title, children }) => {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{title}</h3>
                    <Button variant="ghost" size="icon" className="close-btn" onClick={onClose}>
                        ×
                    </Button>
                </div>
                <div className="modal-body">{children}</div>
            </div>
        </div>
    );
};

export default LicenseManagementPage;
