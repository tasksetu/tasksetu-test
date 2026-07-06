/**
 * Reports Dashboard with Role-Based Access Control
 * Implements Section 6.0 - Reporting & Analytics Module permissions
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  BarChart3, AlertTriangle, TrendingUp, Users, Target, Clock,
  CheckSquare, UserCheck, Building2, BarChart4, Shield, Info,
  Download, Calendar, Filter, RefreshCw, Eye, Lock
} from 'lucide-react';
import {
  getUserAccessLevel,
  getAvailableReports,
  canAccessReport,
  getReportScopeMessage,
  validateReportAccess,
  getExportPermissions
} from '../utils/rolePermissions';
import { useLicense } from '../../../hooks/useLicense';

// Import report components
import MyProductivityReport from './MyProductivityReport';
import OverdueTasksReport from './OverdueTasksReport';
import MilestoneAchievementReport from './MilestoneAchievementReport';
import RecurringTaskAdherenceReport from './RecurringTaskAdherenceReport';
import QuickTaskConversionReport from './QuickTaskConversionReport';
import ActivityEngagementReport from './ActivityEngagementReport';
import TeamAnalyticsReport from './TeamAnalyticsReport';
import ProductivityEfficiencyReport from './ProductivityEfficiencyReport';
import WorkloadDistributionReport from './WorkloadDistributionReport';
import OrganizationAnalyticsReport from './OrganizationAnalyticsReport';

const ReportsDashboard = () => {
  const [user, setUser] = useState(null);
  const [activeReport, setActiveReport] = useState(null);
  const [availableReports, setAvailableReports] = useState([]);
  const { features, isLoading: licenseLoading } = useLicense();
  const [location] = useLocation();
  const [filters, setFilters] = useState({
    dateRange: '30',
    startDate: '',
    endDate: '',
    status: '',
    priority: ''
  });

  // Get user from localStorage or context
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);

        // Get available reports based on user role and license features
        const reports = getAvailableReports(parsedUser.role, features);
        setAvailableReports(reports);

        // Handle initial report selection from URL or default
        if (reports.length > 0) {
          // Check if there's a specific report in URL (e.g. #team-analytics)
          const hash = window.location.hash.replace('#', '');
          if (hash && reports.find(r => r.id === hash)) {
            setActiveReport(hash);
          } else if (!activeReport || !reports.find(r => r.id === activeReport)) {
            setActiveReport(reports[0].id);
          }
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, [activeReport, features, location]);

  // Role-based access level and permissions
  const accessLevel = user ? getUserAccessLevel(user.role) : 'individual';
  const exportPermissions = user ? getExportPermissions(user.role) : {};

  // Icon mapping
  const iconMap = {
    BarChart3,
    AlertTriangle,
    TrendingUp,
    Users,
    Target,
    Clock,
    CheckSquare,
    UserCheck,
    Building2,
    BarChart4
  };

  // Report component mapping
  const reportComponents = {
    'my-productivity': MyProductivityReport,
    'overdue-tasks': OverdueTasksReport,
    'milestone-achievement': MilestoneAchievementReport,
    'recurring-task-adherence': RecurringTaskAdherenceReport,
    'quick-task-conversion': QuickTaskConversionReport,
    'activity-engagement': ActivityEngagementReport,
    'team-analytics': TeamAnalyticsReport,
    'productivity-efficiency': ProductivityEfficiencyReport,
    'workload-distribution': WorkloadDistributionReport,
    'organization-analytics': OrganizationAnalyticsReport
  };

  // Handle report selection with access validation
  const handleReportSelect = (reportId) => {
    if (!user) return;

    const validation = validateReportAccess(reportId, user.role, features);
    if (validation.hasAccess) {
      setActiveReport(reportId);
      // Update URL hash without reload
      window.location.hash = reportId;
    } else {
      alert(validation.message);
    }
  };

  // Handle export with permission check
  const handleExport = (format, scope = 'current') => {
    const activeReportConfig = availableReports.find(r => r.id === activeReport);

    // Check export permissions
    if (scope === 'team' && !exportPermissions.canExportTeamReports) {
      alert('You do not have permission to export team reports.');
      return;
    }

    if (scope === 'org' && !exportPermissions.canExportOrgReports) {
      alert('You do not have permission to export organization reports.');
      return;
    }

    // Implementation would trigger actual export
    console.log(`Exporting ${activeReport} as ${format}`);
  };

  // Get current report component
  const getCurrentReportComponent = () => {
    if (!activeReport || !reportComponents[activeReport]) {
      return (
        <div className="text-center py-12 text-gray-500">
          <Info className="w-12 h-12 mx-auto mb-3" />
          <p>Select a report to view analytics</p>
        </div>
      );
    }

    const ReportComponent = reportComponents[activeReport];
    return <ReportComponent filters={filters} userRole={user?.role} />;
  };

  // Access level badge
  const AccessLevelBadge = () => {
    const levelConfig = {
      individual: { label: 'Personal View', color: 'bg-blue-100 text-blue-800', icon: Eye },
      manager: { label: 'Manager View', color: 'bg-green-100 text-green-800', icon: Users },
      admin: { label: 'Admin View', color: 'bg-purple-100 text-purple-800', icon: Shield }
    };

    const config = (user && levelConfig[accessLevel]) || levelConfig.individual;
    const Icon = config.icon;

    return (
      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        <Icon className="w-4 h-4 mr-1" />
        {config.label}
      </div>
    );
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Lock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-600">Please log in to access reports</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
              <AccessLevelBadge />
            </div>

            <div className="flex items-center space-x-3">
              {/* Export Options */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleExport('csv')}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Export CSV
                </button>

                <button
                  onClick={() => handleExport('pdf')}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Export PDF
                </button>
              </div>

              {/* Refresh */}
              <button
                onClick={() => window.location.reload()}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex overflow-hidden h-[calc(100vh-73px)]">
        {/* Sidebar - Available Reports */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <div className="mb-3">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Available Reports</h2>
              <p className="text-sm text-gray-600">
                You have access to ${availableReports.length} report(s) based on your role.
              </p>
            </div>

            {/* Report Categories */}
            {['individual', 'operational', 'efficiency', 'team', 'strategic', 'engagement'].map(category => {
              const categoryReports = availableReports.filter(report => report.category === category);

              if (categoryReports.length === 0) return null;

              return (
                <div key={category} className="mb-3 last:mb-0">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    {category} Reports
                  </h3>

                  <div className="space-y-1">
                    {categoryReports.map(report => {
                      const Icon = iconMap[report.icon] || BarChart3;
                      const isActive = activeReport === report.id;

                      return (
                        <button
                          key={report.id}
                          onClick={() => handleReportSelect(report.id)}
                          className={`w-full text-left px-3 py-2 rounded-md transition-all ${isActive
                            ? 'bg-indigo-50 text-indigo-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                          <div className="flex items-center space-x-3">
                            <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
                            <div className="flex-1 truncate">
                              <h4 className="text-sm font-medium leading-none mb-1">{report.title}</h4>
                              <p className={`text-[10px] truncate ${isActive ? 'text-indigo-400' : 'text-gray-400'}`}>
                                {report.description}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Content - Active Report */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {activeReport && (
            <div className="mb-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {availableReports.find(r => r.id === activeReport)?.title}
                  </h2>
                  <p className="text-sm text-indigo-600 font-medium mt-0.5">
                    {user && getReportScopeMessage(activeReport, user.role)}
                  </p>
                </div>

                {/* Quick Filters */}
                <div className="flex items-center space-x-3">
                  <div className="flex items-center bg-white border border-gray-200 rounded-md px-2 py-1">
                    <Calendar className="w-3.5 h-3.5 text-gray-400 mr-2" />
                    <select
                      value={filters.dateRange}
                      onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                      className="text-xs font-medium text-gray-700 bg-transparent border-none focus:ring-0 p-0 pr-6"
                    >
                      <option value="7">Last 7 days</option>
                      <option value="30">Last 30 days</option>
                      <option value="90">Last 90 days</option>
                    </select>
                  </div>
                  <button className="p-1.5 bg-white border border-gray-200 rounded-md text-gray-400 hover:text-gray-600">
                    <Filter className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Report Content */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-h-[500px]">
            {getCurrentReportComponent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsDashboard;
