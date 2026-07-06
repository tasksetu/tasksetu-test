/**
 * 🎯 LICENSE MANAGEMENT PAGE
 * Role-based license display:
 * - Org Admin: Full management (upgrade, renew, usage)
 * - Manager/Employee: Read-only view
 */

import React, { useState, useEffect } from 'react';
import { useLicense } from '../../hooks/useLicense';
import { UsageBadge, FeatureLock } from '../../components/license/FeatureLock';
import './LicensePage.css';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
import { LICENSE_TIER_LEVELS } from '../../utils/licenseConstants';
import { useShowToast } from "@/utils/ToastMessage";
import { Button } from '@/components/ui/button';

const LicensePage = () => {
    const { license, usage, loading, error, refreshLicense } = useLicense();
    const [user, setUser] = useState(null);
    const [showComparison, setShowComparison] = useState(false);
    const [upgradeModal, setUpgradeModal] = useState(false);

    useEffect(() => {
        // Fetch current user to determine role
        const fetchUser = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/api/users/me`);
                setUser(response.data);
            } catch (err) {
                console.error('Error fetching user:', err);
            }
        };
        fetchUser();
    }, []);

    if (loading) {
        return (
            <div className="license-page-loading">
                <div className="spinner"></div>
                <p>Loading license information...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="license-page-error">
                <h2>Error Loading License</h2>
                <p>{error}</p>
                <Button variant="primary" className="h-9" onClick={refreshLicense}>Retry</Button>
            </div>
        );
    }

    const isAdmin = user?.role === 'admin' || user?.role === 'org_admin';

    return (
        <div className="license-page">
            <div className="license-page-header">
                <h1>License & Usage</h1>
                <p className="subtitle">Manage your subscription and monitor feature usage</p>
            </div>

            {isAdmin ? (
                <OrgAdminView
                    license={license}
                    usage={usage}
                    showComparison={showComparison}
                    setShowComparison={setShowComparison}
                    upgradeModal={upgradeModal}
                    setUpgradeModal={setUpgradeModal}
                    refreshLicense={refreshLicense}
                />
            ) : (
                <EmployeeView
                    license={license}
                    usage={usage}
                />
            )}
        </div>
    );
};

// ============================================================================
// ORG ADMIN VIEW
// ============================================================================

const OrgAdminView = ({
    license,
    usage,
    showComparison,
    setShowComparison,
    upgradeModal,
    setUpgradeModal,
    refreshLicense
}) => {
    return (
        <>
            {/* License Summary Card */}
            <div className="license-summary-card">
                <div className="summary-header">
                    <div>
                        <h2>Current Plan: {license?.name || license?.code}</h2>
                        <p className="billing-cycle">
                            {license?.billingCycle === 'YEARLY' ? 'Annual Billing' : 'Monthly Billing'}
                        </p>
                    </div>
                    <div className={`status-badge status-${license?.status?.toLowerCase()}`}>
                        {license?.status === 'ACTIVE' && '🟢 Active'}
                        {license?.status === 'EXPIRED' && '🔴 Expired'}
                        {license?.status === 'SUSPENDED' && '🟡 Suspended'}
                    </div>
                </div>

                <div className="summary-details">
                    <div className="detail-item">
                        <span className="label">Expires:</span>
                        <span className="value">
                            {license?.endDate ? new Date(license.endDate).toLocaleDateString('en-US', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                            }) : 'N/A'}
                        </span>
                    </div>

                    {license?.trialEndDate && (
                        <div className="detail-item">
                            <span className="label">Trial Ends:</span>
                            <span className="value">
                                {new Date(license.trialEndDate).toLocaleDateString('en-US', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric'
                                })}
                            </span>
                        </div>
                    )}

                    <div className="detail-item">
                        <span className="label">Started:</span>
                        <span className="value">
                            {license?.startDate ? new Date(license.startDate).toLocaleDateString('en-US', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                            }) : 'N/A'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Usage Cards Grid */}
            <div className="usage-cards-grid">
                <UsageCard
                    title="Tasks"
                    feature="TASK_BASIC"
                    usage={usage}
                    icon="📋"
                />
                <UsageCard
                    title="Forms"
                    feature="FORM_CREATE"
                    usage={usage}
                    icon="📝"
                />
                <UsageCard
                    title="Procedures"
                    feature="PROC_CREATE"
                    usage={usage}
                    icon="📊"
                />
                <UsageCard
                    title="Approvals"
                    feature="TASK_APPROVAL"
                    usage={usage}
                    icon="✅"
                />
            </div>

            {/* Action Bar */}
            <div className="action-bar">
                <Button
                    variant="primary"
                    className="h-9"
                    onClick={() => setUpgradeModal(true)}
                >
                    <span className="icon">⬆️</span>
                    Upgrade Plan
                </Button>
                <Button
                    variant="outline"
                    className="h-9"
                    onClick={() => {/* TODO: Implement renew */ }}
                >
                    <span className="icon">🔄</span>
                    Renew Subscription
                </Button>
            </div>

            {/* Plan Comparison (Collapsible) */}
            <div className="plan-comparison-section">
                <Button
                    variant="outline"
                    className="comparison-toggle h-9"
                    onClick={() => setShowComparison(!showComparison)}
                >
                    <span>Compare Plans</span>
                    <span className={`arrow ${showComparison ? 'open' : ''}`}>▼</span>
                </Button>

                {showComparison && <PlanComparison currentPlan={license?.code} />}
            </div>

            {/* Upgrade Modal */}
            {upgradeModal && (
                <UpgradeModal
                    currentPlan={license?.code}
                    onClose={() => setUpgradeModal(false)}
                    onSuccess={() => {
                        setUpgradeModal(false);
                        refreshLicense();
                    }}
                />
            )}
        </>
    );
};

// ============================================================================
// EMPLOYEE/MANAGER VIEW (Read-Only)
// ============================================================================

const EmployeeView = ({ license, usage }) => {
    return (
        <div className="employee-view">
            {/* Current Plan Card */}
            <div className="plan-card-readonly">
                <div className="plan-header">
                    <h2>Current Plan: {license?.name || license?.code}</h2>
                    <div className={`status-badge status-${license?.status?.toLowerCase()}`}>
                        {license?.status === 'ACTIVE' && '🟢 Active'}
                        {license?.status === 'EXPIRED' && '🔴 Expired'}
                    </div>
                </div>
                <p className="expiry-date">
                    Expires: {license?.endDate ? new Date(license.endDate).toLocaleDateString('en-US', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                    }) : 'N/A'}
                </p>
            </div>

            {/* Usage Bars */}
            <div className="usage-bars-section">
                <h3>Usage Overview</h3>

                {usage && usage.length > 0 ? (
                    usage.map((item) => (
                        <UsageBar
                            key={item.featureCode}
                            featureCode={item.featureCode}
                            used={item.used}
                            limit={item.limit}
                        />
                    ))
                ) : (
                    <p className="no-usage">No usage data available</p>
                )}
            </div>

            {/* Upgrade Message */}
            <div className="upgrade-message">
                <div className="lock-icon">🔒</div>
                <h3>Need More Features?</h3>
                <p>Contact your organization administrator to upgrade your plan and unlock additional features.</p>
            </div>
        </div>
    );
};

// ============================================================================
// SUPPORTING COMPONENTS
// ============================================================================

const UsageCard = ({ title, feature, usage, icon }) => {
    const usageData = usage?.find(u => u.featureCode === feature);

    if (!usageData) {
        return (
            <div className="usage-card">
                <div className="card-icon">{icon}</div>
                <h3>{title}</h3>
                <div className="usage-value">Not Available</div>
            </div>
        );
    }

    const isUnlimited = usageData.limit === -1 || usageData.limit >= 999999;
    const percentage = isUnlimited ? 0 : (usageData.used / usageData.limit) * 100;

    return (
        <div className="usage-card">
            <div className="card-icon">{icon}</div>
            <h3>{title}</h3>
            <div className="usage-value">
                {isUnlimited ? (
                    <>
                        <span className="used">{usageData.used}</span>
                        <span className="separator">/</span>
                        <span className="limit">∞</span>
                    </>
                ) : (
                    <>
                        <span className="used">{usageData.used}</span>
                        <span className="separator">/</span>
                        <span className="limit">{usageData.limit}</span>
                    </>
                )}
            </div>
            {!isUnlimited && (
                <div className="usage-bar">
                    <div
                        className={`usage-bar-fill ${getBarColor(percentage)}`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                </div>
            )}
            <div className="usage-label">{usageData.period || 'MONTHLY'}</div>
        </div>
    );
};

const UsageBar = ({ featureCode, used, limit }) => {
    const isUnlimited = limit === -1 || limit >= 999999;
    const percentage = isUnlimited ? 0 : (used / limit) * 100;
    const featureName = getFeatureName(featureCode);

    return (
        <div className="usage-bar-item">
            <div className="usage-bar-header">
                <span className="feature-name">{featureName}</span>
                <span className="usage-text">
                    {isUnlimited ? `${used} / ∞` : `${used} / ${limit}`}
                </span>
            </div>
            <div className="progress-bar">
                <div
                    className={`progress-fill ${getBarColor(percentage)}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                />
            </div>
        </div>
    );
};

const PlanComparison = ({ currentPlan }) => {
    const plans = [
        {
            code: 'EXPLORE',
            name: 'Explore',
            price: 'Free',
            features: ['10 Tasks', '5 Forms', 'Basic Support', '1 User']
        },
        {
            code: 'PLAN',
            name: 'Plan',
            price: '₹999/mo',
            features: ['100 Tasks', '50 Forms', '50 Approvals', 'Email Support', '10 Users']
        },
        {
            code: 'EXECUTE',
            name: 'Execute',
            price: '₹2,999/mo',
            features: ['1000 Tasks', '500 Forms', '500 Approvals', 'Phone Support', '50 Users', 'API Access']
        },
        {
            code: 'OPTIMIZE',
            name: 'Optimize',
            price: '₹9,999/mo',
            features: ['Unlimited Tasks', 'Unlimited Forms', 'Unlimited Approvals', 'Dedicated Support', 'Unlimited Users', 'SSO', 'Custom Roles']
        }
    ];

    return (
        <div className="plan-comparison-grid">
            {plans.map((plan) => (
                <div
                    key={plan.code}
                    className={`plan-card ${plan.code === currentPlan ? 'current' : ''}`}
                >
                    {plan.code === currentPlan && (
                        <div className="current-badge">Current Plan</div>
                    )}
                    <h3>{plan.name}</h3>
                    <div className="plan-price">{plan.price}</div>
                    <ul className="plan-features">
                        {plan.features.map((feature, index) => (
                            <li key={index}>
                                <span className="check-icon">✓</span>
                                {feature}
                            </li>
                        ))}
                    </ul>
                    {plan.code !== currentPlan && (
                        <Button variant="outline" className="h-9">
                            {getTierLevel(plan.code) > getTierLevel(currentPlan) ? 'Upgrade' : 'Downgrade'}
                        </Button>
                    )}
                </div>
            ))}
        </div>
    );
};

const UpgradeModal = ({ currentPlan, onClose, onSuccess }) => {
    const [selectedPlan, setSelectedPlan] = useState('EXECUTE');
    const [billingCycle, setBillingCycle] = useState('MONTHLY');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { showSuccessToast, showErrorToast } = useShowToast();

    const handleUpgrade = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.post(`${API_BASE_URL}/api/license/upgrade`, {
                targetLicense: selectedPlan,
                billingCycle: billingCycle
            });

            if (response.data.errorCode === 'DOWNGRADE_BLOCKED') {
                setError(`Cannot downgrade: Current usage exceeds target plan limits.`);
                return;
            }

            showSuccessToast('License upgraded');
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to upgrade license');
            showErrorToast(err.response?.data?.message || 'Failed to upgrade license');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Upgrade License</h2>
                    <Button variant="ghost" size="icon" className="close-btn" onClick={onClose}>×</Button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label>Select Plan</label>
                        <select
                            value={selectedPlan}
                            onChange={(e) => setSelectedPlan(e.target.value)}
                            className="form-control"
                        >
                            <option value="PLAN">Plan - ₹999/mo</option>
                            <option value="EXECUTE">Execute - ₹2,999/mo</option>
                            <option value="OPTIMIZE">Optimize - ₹9,999/mo</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Billing Cycle</label>
                        <div className="radio-group">
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    value="MONTHLY"
                                    checked={billingCycle === 'MONTHLY'}
                                    onChange={(e) => setBillingCycle(e.target.value)}
                                />
                                Monthly
                            </label>
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    value="YEARLY"
                                    checked={billingCycle === 'YEARLY'}
                                    onChange={(e) => setBillingCycle(e.target.value)}
                                />
                                Yearly (Save 20%)
                            </label>
                        </div>
                    </div>

                    {error && (
                        <div className="error-message">{error}</div>
                    )}
                </div>

                <div className="modal-footer">
                    <Button variant="outline" className="h-9" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        className="h-9"
                        onClick={handleUpgrade}
                        disabled={loading}
                    >
                        {loading ? 'Processing...' : 'Upgrade Now'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getBarColor = (percentage) => {
    if (percentage >= 95) return 'danger';
    if (percentage >= 80) return 'warning';
    if (percentage >= 50) return 'caution';
    return 'success';
};

const getFeatureName = (code) => {
    const names = {
        'TASK_BASIC': 'Tasks',
        'TASK_APPROVAL': 'Approvals',
        'TASK_MSTONE': 'Milestones',
        'FORM_CREATE': 'Forms',
        'PROC_CREATE': 'Procedures',
        'COLLAB_COMMENT': 'Comments',
        'SSO_LOGIN': 'SSO Login'
    };
    return names[code] || code;
};

const getTierLevel = (code) => {
    return LICENSE_TIER_LEVELS[code] || 0;
};

export default LicensePage;
