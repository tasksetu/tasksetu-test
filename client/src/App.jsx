import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch, useLocation, Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryClient } from "@/lib/queryClient";
import { RoleProvider } from "./components/RoleSwitcher";
import TrashTaskPage from "@/components/tasks/TrashTaskPage";
import { useInactivityLogout } from "./hooks/useInactivityLogout";
import { useTokenCleanup } from "./hooks/useTokenCleanup";
import InactivityWarningModal from "./components/InactivityWarningModal";
import ExpiredLicenseAlert from "./components/ExpiredLicenseAlert";

// Role-based Dashboards
import SuperAdminDashboard from "./dashboard/SuperAdminDashboard";
import AdminDashboard from "./pages/dashboards/AdminDashboard";
import EmployeeDashboard from "./pages/dashboards/EmployeeDashboard";

// Legacy Admin Components (for reference)
import Dashboard from "./pages/admin/CompactDashboard";
import Tasks from "./pages/admin/Tasks";
import Users from "./pages/admin/Users";
import UserManagement from "./pages/admin/UserManagement";
import TeamMembers from "./pages/admin/TeamMembers";
import SettingsUserManagement from "./pages/settings/UserManagement";
import Projects from "./pages/admin/Projects";
import Integrations from "./pages/admin/Integrations";
import Roles from "./pages/admin/Roles";
import Reports from "./pages/admin/Reports";
import { RoleManagement } from "./pages/RoleManagement";
import { OrganizationHierarchy } from "./pages/OrganizationHierarchy";
import { PlansLicenses } from "./pages/admin/PlansLicenses";
import { AdminLayout } from "./components/admin/AdminLayout";
import SettingsLayout from "./components/settings/SettingsLayout";
import GeneralSettings from "./pages/settings/GeneralSettings";
import SettingsRoles from "./pages/settings/Roles";
import Subscription from "./pages/settings/Subscription";
import SettingsPlaceholder from "./pages/settings/SettingsPlaceholder";

// Super Admin Components
import SuperAdminLayout from "./components/super-admin/SuperAdminLayout";
import LegacySuperAdminDashboard from "./pages/super-admin/SuperAdminDashboard";
import CompaniesManagement from "./pages/super-admin/CompaniesManagement";
import UsersManagement from "./pages/super-admin/UsersManagement";
import UserDetail from "./pages/super-admin/UserDetail";
import SystemLogs from "./pages/super-admin/SystemLogs";
import AdminManagement from "./pages/super-admin/AdminManagement";
import LoginCustomization from "./pages/super-admin/LoginCustomization";
import SystemConfiguration from "./pages/super-admin/SystemConfiguration";
import NotificationSystem from "./pages/super-admin/NotificationSystem";
import ComplianceCenter from "./pages/super-admin/ComplianceCenter";
import SupportOps from "./pages/super-admin/SupportOps";
import AdminSupportTickets from "./pages/super-admin/AdminSupportTickets";
import PlatformDashboard from "./pages/super-admin/PlatformDashboard";
import PlatformHealth from "./pages/super-admin/PlatformHealth";
import CompanyStatus from "./pages/super-admin/CompanyStatus";

import { Toaster } from "./components/ui/toaster";
import { SubtaskProvider } from "./contexts/SubtaskContext";
import { ViewProvider } from "./contexts/ViewContext";
import GlobalSubtaskDrawer from "./components/forms/GlobalSubtaskDrawer";
import GlobalViewModal from "./components/modals/GlobalViewModal";

// Authentication Components
import Register from "./pages/auth/Register";
import Login from "./pages/auth/Login";
import SuperAdminLogin from "./pages/super-admin/SuperAdminLogin";

import CreatePassword from "./pages/auth/CreatePassword";
import ResetPassword from "./pages/auth/ResetPassword";

import { SimpleAcceptInvite } from "./pages/SimpleAcceptInvite";
import VerifyAndSetPassword from "./pages/auth/VerifyAndSetPassword";
import VerifyEmail from "./pages/auth/VerifyEmail";
import VerifySuperAdmin from "./pages/auth/VerifySuperAdmin";
import RegistrationSuccess from "./pages/auth/RegistrationSuccess";

// Licensing & Subscription Components
import LicenseManagementPage from "./features/licensing/pages/LicenseManagementPage";
import BillingPage from "./features/licensing/pages/BillingPage";
import PricingPage from "./features/licensing/pages/PricingPage";
import PurchaseUpgradePage from "./features/licensing/pages/PurchaseUpgradePage";
import UpgradePage from "./features/licensing/pages/UpgradePage";

// New License Module Components
import LicensePage from "./pages/settings/LicensePage";
import LicensePlansManagement from "./components/super-admin/LicensePlansManagement";
import LicenseManagement from "./components/super-admin/LicenseManagement";
import { AdminLicenseControl } from "./components/super-admin/AdminLicenseControl";

// Role Protection Components
import {
  RoleProtectedRoute,
  RequireSuperAdmin,
  RequireAdmin,
  RequireEmployee,
} from "./components/auth/RoleProtectedRoute";
import RoleBasedRedirect from "./components/RoleBasedRedirect";
import SecureRoute from "./components/ProtectedRoute";
import ForbiddenPage from "./pages/ForbiddenPage";
import TaskDetail from "./pages/taskview/TaskDetail";
import AdminSettings from "./pages/admin/Admin-settings";
import AdminNotification from "./pages/admin/AdminNotification";
import RecurringTaskManager from "./pages/newComponents/RecurringTaskManager";

import CreateTask from "./pages/newComponents/CreateTask";
import AllTasks from "./pages/newComponents/AllTasks";
import OverdueTasks from "./pages/newComponents/OverdueTasks";
// import QuickTask from "./pages/newComponents/QuickTask"; // Component doesn't exist yet
import QuickTask from "./pages/newComponents/QuickTask";
import CalendarView from "./features/calendar/pages/CalendarView";
import GoogleCalendarCallback from "./components/GoogleCalendarCallback";
import ApprovalManager from "./pages/newComponents/ApprovalManager";

// Reports & Analytics Components
import {
  ManagerProductivityPage,
  ManagerTeamAnalyticsPage,
  OrganizationAnalyticsPage,
  ReportsDashboard,
} from "./features/reports";
import MilestoneManager from "./pages/newComponents/MilestoneManager";
import StatusManager from "./pages/newComponents/StatusManager";
import PriorityManager from "./pages/newComponents/PriorityManager";
import ActivityFeed from "./pages/newComponents/ActivityFeed";
import TaskAnalytics from "./pages/newComponents/TaskAnalytics";
import DeadlinesFromNew from "./pages/newComponents/Deadlines";
import Deadlines from "./pages/Deadlines";
import NotificationCenter from "./pages/newComponents/NotificationCenter";
import SidebarDemo from "./layout/sidebar/SidebarDemo";
import MemberDashboard from "./layout/sidebar/MemberDashboard";
import CurrentUserSidebar from "./pages/CurrentUserSidebar";
import DynamicDashboard from "./pages/Dashboard";
import QuickAddBar from "./components/tasks/QuickAddBar";
import { useUserRole } from "./utils/auth";
import UpgradeSuccessPage from "./features/licensing/pages/UpgradeSuccessPage";
import RegularTaskManager from "./pages/newComponents/RegularTaskManager";
import FormLibrary from "./components/forms/FormLibrary";
import FormBuilder from "./components/forms/FormBuilder";
import FormVersionHistory from "./components/forms/FormVersionHistory";
import PublicForm from "./pages/PublicForm";
import EditProfile from "./pages/EditProfile";
import HelpSupport from "./pages/HelpSupport";
import Documentation from "./pages/Documentation";
import SuperAdminCompanyDetails from "./pages/super-admin/SuperAdminCompanyDetails";
// import RecurringTaskEdit from "./pages/newComponents/RecurringTaskEdit";

// Using the properly configured queryClient from lib/queryClient.js

// User Role Check Component

// ✅ Billing Page Wrapper - Checks isPrimaryAdmin for org_admins
function BillingPageWrapper() {
  const { user, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Allow individual users always
  if (user?.role?.includes("individual")) {
    return <BillingPage />;
  }

  // Allow org_admin only if isPrimaryAdmin === true
  if (user?.role?.includes("org_admin") && user?.isPrimaryAdmin === true) {
    return <BillingPage />;
  }

  // Deny access for all others
  return <ForbiddenPage />;
}

// Route protection wrapper
function ProtectedRoute({ component: Component, allowedRoles = [], ...props }) {
  const { user, isLoading, error } = useUserRole();

  const [, setLocation] = useLocation();
  const token = localStorage.getItem("token");

  useEffect(() => {
    // Only redirect if we have no token at all
    if (!token) {
      // Save the current URL so user can be redirected back after login
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath && currentPath !== "/login" && currentPath !== "/") {
        sessionStorage.setItem("returnUrl", currentPath);
      }
      setLocation("/login");
      return;
    }

    // If we have a token but query failed and we're not loading, redirect
    if (!isLoading && !user && token) {
      localStorage.removeItem("token");
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath && currentPath !== "/login" && currentPath !== "/") {
        sessionStorage.setItem("returnUrl", currentPath);
      }
      setLocation("/login");
    }
  }, [user, isLoading, token, setLocation]);

  // ✅ Hydrate React Query from localStorage on app init
  useEffect(() => {
    const cachedUser = localStorage.getItem("user");
    if (cachedUser) {
      queryClient.setQueryData(["/api/auth/verify"], JSON.parse(cachedUser));
    }
  }, []);
  // Show loading while we have a token and are fetching user data
  if (token && isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Don't render if no token or no user
  if (!token || !user) {
    return null;
  }

  // Check if user is in allowed roles
  const hasAccess = () => {
    // Get the current active role from localStorage, context, or default to highest privilege role
    const activeRoleFromStorage = localStorage.getItem("activeRole");

    // Try to get user roles from user object or fallback to localStorage
    let userRoles = user.role || [];

    // Fallback: If user.role is not available, try to get from localStorage
    if (!userRoles || userRoles.length === 0) {
      try {
        const storedRole = localStorage.getItem("role");
        if (storedRole) {
          userRoles = JSON.parse(storedRole);
        }
      } catch (e) {
        console.error("Error parsing stored role:", e);
      }
    }

    // Ensure userRoles is an array
    if (!Array.isArray(userRoles)) {
      userRoles = [userRoles];
    }

    // Normalize role names to super_admin format
    const normalizeRole = (role) => {
      if (!role) return role;
      return role;
    };

    // Normalize user roles
    const normalizedUserRoles = userRoles.map(normalizeRole);

    // Determine active role: stored > highest privilege > first role
    let activeRole;
    if (
      activeRoleFromStorage &&
      normalizedUserRoles.includes(normalizeRole(activeRoleFromStorage))
    ) {
      activeRole = normalizeRole(activeRoleFromStorage);
    } else {
      // Default to highest privilege role instead of first role
      const roleOrder = [
        "employee",
        "individual",
        "manager",
        "org_admin",
        "super_admin",
      ];
      activeRole =
        normalizedUserRoles.sort((a, b) => {
          const indexA = roleOrder.indexOf(a?.toLowerCase());
          const indexB = roleOrder.indexOf(b?.toLowerCase());
          return indexB - indexA; // Descending - highest first
        })[0] || normalizedUserRoles[0];
    }

    // Normalize allowed roles
    const normalizedAllowedRoles = allowedRoles.map(normalizeRole);

    console.log("activeRole:", activeRole);
    console.log("allowedRoles:", allowedRoles);
    console.log("normalizedAllowedRoles:", normalizedAllowedRoles);
    console.log("userRoles:", userRoles);
    console.log("normalizedUserRoles:", normalizedUserRoles);
    console.log(
      "normalizedAllowedRoles.some:",
      normalizedAllowedRoles.some((role) => normalizedUserRoles.includes(role)),
    );
    console.log(
      "normalizedAllowedRoles.includes(activeRole):",
      normalizedAllowedRoles.includes(activeRole),
    );
    if (normalizedAllowedRoles.length > 0) {
      return normalizedAllowedRoles.includes(activeRole);
    }
    return true; // No role requirement
  };

  if (!hasAccess()) {
    const isIndividualUser = user.role && user.role.includes("individual");
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center max-w-md mx-auto p-7 bg-white rounded-sm shadow-lg">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Access Restricted
          </h2>
          <p className="text-slate-600 mb-3">
            {isIndividualUser
              ? "This feature is only available for organizational users. Individual accounts don't have access to team management features."
              : "You don't have permission to access this area."}
          </p>
          <div className="space-y-3">
            <button
              onClick={() => setLocation("/dashboard")}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Return to Dashboard
            </button>
            {isIndividualUser && (
              <p className="text-xs text-slate-500 mt-3">
                To access team features, you need an organizational account.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (Component) {
    return <Component {...props} />;
  }

  return props.children || null;
}

// Public-only route wrapper: if authenticated, redirect to appropriate dashboard
function PublicOnlyRoute({ component: Component, ...props }) {
  const { user, isLoading } = useUserRole();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const cachedUser =
      user ||
      (localStorage.getItem("user")
        ? JSON.parse(localStorage.getItem("user"))
        : null);
    if (!token) return; // not logged in

    if (!isLoading && token && cachedUser) {
      const roles = Array.isArray(cachedUser.role)
        ? cachedUser.role
        : cachedUser.role
          ? [cachedUser.role]
          : [];
      if (roles.includes("super_admin")) {
        setLocation("/superadmin");
      } else {
        setLocation("/dashboard");
      }
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) return null;

  if (Component) {
    return <Component {...props} />;
  }
  return props.children || null;
}

function App() {
  const [location] = useLocation();
  const isSuperAdminRoute = location.startsWith("/super-admin");
  const isAuthRoute =
    [
      "/register",
      "/login",
      "/verify",
      "/registration-success",
      "/reset-password",
      "/accept-invitation",
      "/create-password",
    ].includes(location) || location.startsWith("/register/");

  // 🔒 Auto-logout after 30 minutes of inactivity
  console.log("🔐 App.jsx - Calling useInactivityLogout hook");
  const { showWarning, remainingTime, formatTime } = useInactivityLogout();
  console.log("🔐 App.jsx - Hook returned:", { showWarning, remainingTime });

  // 🔒 Token expiry (24h) + browser close cleanup
  useTokenCleanup();

  return (
    <QueryClientProvider client={queryClient}>
      <RoleProvider>
        <SubtaskProvider>
          <ViewProvider>
            {/* Inactivity Warning Modal - Auto-logout, No dismiss option */}
            {console.log(
              "🎨 App.jsx - Rendering InactivityWarningModal, showWarning:",
              showWarning,
            )}
            <InactivityWarningModal
              show={showWarning}
              remainingTime={remainingTime}
              formatTime={formatTime}
            />

            {/* Expired license alert for org admins */}
            <ExpiredLicenseAlert />

            <Switch>
              {/* Public Form Submission Route - No Authentication Required */}
              <Route path="/forms/public/:token" component={PublicForm} />

              {/* Root Route - Role-based redirect */}
              <Route path="/" component={RoleBasedRedirect} />

              {/* Public Authentication Routes - No Layout */}
              <Route path="/register" component={Register} />

              <Route path="/login">
                <PublicOnlyRoute component={Login} />
              </Route>
              <Route path="/super-admin/login">
                <PublicOnlyRoute component={SuperAdminLogin} />
              </Route>

              <Route path="/verify" component={VerifyEmail} />
              <Route path="/verify-super-admin" component={VerifySuperAdmin} />
              <Route
                path="/registration-success"
                component={RegistrationSuccess}
              />
              <Route path="/create-password" component={CreatePassword} />
              <Route path="/reset-password" component={ResetPassword} />
              <Route path="/accept-invitation" component={SimpleAcceptInvite} />
              <Route path="/accept-invite" component={SimpleAcceptInvite} />
              <Route
                path="/register/invite/:token"
                component={SimpleAcceptInvite}
              />
              <Route path="/forbidden" component={ForbiddenPage} />

              {/* Role-based Dashboard Routes */}
              <Route path="/superadmin">
                <SuperAdminLayout>
                  <RequireSuperAdmin>
                    <SuperAdminDashboard />
                  </RequireSuperAdmin>
                </SuperAdminLayout>
              </Route>

              {/* Legacy Super Admin Route - Redirect to new dashboard */}
              <Route path="/super-admin">
                <Redirect to="/superadmin" />
              </Route>

              {/* New Platform Overview Routes */}
              <Route path="/super-admin/dashboard">
                <SuperAdminLayout>
                  <ProtectedRoute
                    component={PlatformDashboard}
                    allowedRoles={["super_admin"]}
                  />
                </SuperAdminLayout>
              </Route>
              <Route path="/super-admin/health">
                <SuperAdminLayout>
                  <ProtectedRoute
                    component={PlatformHealth}
                    allowedRoles={["super_admin"]}
                  />
                </SuperAdminLayout>
              </Route>
              <Route path="/super-admin/company-status">
                <SuperAdminLayout>
                  <ProtectedRoute
                    component={CompanyStatus}
                    allowedRoles={["super_admin"]}
                  />
                </SuperAdminLayout>
              </Route>

              <Route path="/super-admin/companies">
                <SuperAdminLayout>
                  <ProtectedRoute
                    component={CompaniesManagement}
                    allowedRoles={["super_admin"]}
                  />
                </SuperAdminLayout>
              </Route>
              <Route path="/super-admin/companies/:id">
                <SuperAdminLayout>
                  <ProtectedRoute
                    component={SuperAdminCompanyDetails}
                    allowedRoles={["super_admin"]}
                  />
                </SuperAdminLayout>
              </Route>
              <Route path="/super-admin/users">
                <SuperAdminLayout>
                  <ProtectedRoute
                    component={UsersManagement}
                    allowedRoles={["super_admin"]}
                  />
                </SuperAdminLayout>
              </Route>
              <Route path="/super-admin/users/:id">
                <SuperAdminLayout>
                  <ProtectedRoute
                    component={UserDetail}
                    allowedRoles={["super_admin"]}
                  />
                </SuperAdminLayout>
              </Route>
              <Route path="/super-admin/logs">
                <SuperAdminLayout>
                  <ProtectedRoute
                    component={SystemLogs}
                    allowedRoles={["super_admin"]}
                  />
                </SuperAdminLayout>
              </Route>
              <Route path="/super-admin/admins">
                <SuperAdminLayout>
                  <ProtectedRoute
                    component={AdminManagement}
                    allowedRoles={["super_admin"]}
                  />
                </SuperAdminLayout>
              </Route>
              <Route path="/super-admin/analytics">
                <SuperAdminLayout>
                  <ProtectedRoute
                    component={TaskAnalytics}
                    allowedRoles={["super_admin"]}
                  />
                </SuperAdminLayout>
              </Route>
              <Route path="/super-admin/settings">
                <SuperAdminLayout>
                  <ProtectedRoute
                    component={AdminSettings}
                    allowedRoles={["super_admin"]}
                  ></ProtectedRoute>
                </SuperAdminLayout>
              </Route>
              <Route path="/super-admin/login-customization">
                <SuperAdminLayout>
                  <ProtectedRoute
                    component={LoginCustomization}
                    allowedRoles={["super_admin"]}
                  />
                </SuperAdminLayout>
              </Route>

              <Route path="/super-admin/licenses">
                <SuperAdminLayout>
                  <ProtectedRoute
                    component={AdminLicenseControl}
                    allowedRoles={["super_admin"]}
                  />
                </SuperAdminLayout>
              </Route>

              <Route path="/super-admin/license-management">
                <SuperAdminLayout>
                  <ProtectedRoute
                    component={LicenseManagement}
                    allowedRoles={["super_admin"]}
                  />
                </SuperAdminLayout>
              </Route>

              <Route path="/super-admin/license-plans">
                <SuperAdminLayout>
                  <ProtectedRoute
                    component={LicensePlansManagement}
                    allowedRoles={["super_admin"]}
                  />
                </SuperAdminLayout>
              </Route>

              {/* New Super Admin System Routes */}
              <Route path="/super-admin/feature-flags">
                <SuperAdminLayout>
                  <ProtectedRoute
                    component={SystemConfiguration}
                    allowedRoles={["super_admin"]}
                  />
                </SuperAdminLayout>
              </Route>
              <Route path="/super-admin/notification-triggers">
                <SuperAdminLayout>
                  <ProtectedRoute
                    component={NotificationSystem}
                    allowedRoles={["super_admin"]}
                  />
                </SuperAdminLayout>
              </Route>
              <Route path="/super-admin/audit-logs">
                <SuperAdminLayout>
                  <ProtectedRoute
                    component={ComplianceCenter}
                    allowedRoles={["super_admin"]}
                  />
                </SuperAdminLayout>
              </Route>
              <Route path="/super-admin/support-tickets">
                <SuperAdminLayout>
                  <ProtectedRoute
                    component={AdminSupportTickets}
                    allowedRoles={["super_admin"]}
                  />
                </SuperAdminLayout>
              </Route>
              <Route path="/super-admin/error-logs">
                <SuperAdminLayout>
                  <ProtectedRoute
                    component={SupportOps}
                    allowedRoles={["super_admin"]}
                  />
                </SuperAdminLayout>
              </Route>

              {/* Main Dashboard Route - Home Dashboard with Sidebar */}
              {/* Note: super_admin should use /superadmin route, not /dashboard */}
              <Route path="/dashboard">
                <AdminLayout>
                  <ProtectedRoute
                    component={DynamicDashboard}
                    allowedRoles={[
                      "org_admin",
                      "employee",
                      "manager",
                      "individual",
                    ]}
                  />
                </AdminLayout>
              </Route>
              <Route path="/organization-hierarchy">
                <AdminLayout>
                  <ProtectedRoute
                    component={OrganizationHierarchy}
                    allowedRoles={["org_admin"]}
                  />
                </AdminLayout>
              </Route>
              <Route path="/super-admin/edit-profile">
                <SuperAdminLayout>
                  <ProtectedRoute
                    component={EditProfile}
                    allowedRoles={["super_admin"]}
                  />
                </SuperAdminLayout>
              </Route>
              <Route path="/edit-profile">
                <AdminLayout>
                  <ProtectedRoute
                    component={EditProfile}
                    allowedRoles={[
                      "org_admin",
                      "individual",
                      "manager",
                      "employee",
                    ]}
                  />
                </AdminLayout>
              </Route>
              {/* Form Library Route */}
              <Route path="/form-library">
                <AdminLayout>
                  <ProtectedRoute component={FormLibrary} />
                </AdminLayout>
              </Route>
              <Route path="/form-builder">
                <AdminLayout>
                  <ProtectedRoute component={FormBuilder} />
                </AdminLayout>
              </Route>
              <Route path="/form-version-history">
                <AdminLayout>
                  <ProtectedRoute component={FormVersionHistory} />
                </AdminLayout>
              </Route>
              {/* Individual User Task Pages */}
              <Route path="/recurring">
                <AdminLayout>
                  <ProtectedRoute
                    component={RecurringTaskManager}
                    allowedRoles={[
                      "individual",
                      "employee",
                      "manager",
                      "org_admin",
                    ]}
                  />
                </AdminLayout>
              </Route>

              <Route path="/tasks/create">
                <AdminLayout>
                  <ProtectedRoute
                    component={CreateTask}
                    allowedRoles={[
                      "individual",
                      "employee",
                      "manager",
                      "org_admin",
                    ]}
                  />
                </AdminLayout>
              </Route>

              <Route path="/quick-tasks">
                <AdminLayout>
                  <ProtectedRoute
                    component={QuickTask}
                    allowedRoles={[
                      "individual",
                      "employee",
                      "manager",
                      "org_admin",
                    ]}
                  />
                </AdminLayout>
              </Route>

              <Route path="/milestones">
                <AdminLayout>
                  <ProtectedRoute
                    component={MilestoneManager}
                    allowedRoles={[
                      "individual",
                      "employee",
                      "manager",
                      "org_admin",
                    ]}
                  />
                </AdminLayout>
              </Route>
              <Route path="/regular-tasks">
                <AdminLayout>
                  <ProtectedRoute
                    component={RegularTaskManager}
                    allowedRoles={[
                      "individual",
                      "employee",
                      "manager",
                      "org_admin",
                    ]}
                  />
                </AdminLayout>
              </Route>
              <Route path="/approvals">
                <AdminLayout>
                  <ProtectedRoute
                    component={ApprovalManager}
                    allowedRoles={[
                      "individual",
                      "employee",
                      "manager",
                      "org_admin",
                    ]}
                  />
                </AdminLayout>
              </Route>

              <Route path="/calendar">
                <AdminLayout>
                  <ProtectedRoute
                    component={CalendarView}
                    allowedRoles={["individual", "employee", "org_admin"]}
                  />
                </AdminLayout>
              </Route>

              <Route path="/google-calendar-callback">
                <GoogleCalendarCallback />
              </Route>

              <Route path="/analytics">
                <AdminLayout>
                  <ProtectedRoute component={TaskAnalytics} />
                </AdminLayout>
              </Route>
              <Route path="/admin/upgrade-success">
                <AdminLayout>
                  <ProtectedRoute component={UpgradeSuccessPage} />
                </AdminLayout>
              </Route>
              <Route path="/deadlines">
                <AdminLayout>
                  <ProtectedRoute component={Deadlines} />
                </AdminLayout>
              </Route>
              <Route path="/overdue-tasks">
                <AdminLayout>
                  <ProtectedRoute
                    component={OverdueTasks}
                    allowedRoles={[
                      "employee",
                      "individual",
                      "manager",
                      "org_admin",
                    ]}
                  />
                </AdminLayout>
              </Route>

              <Route path="/tasks">
                <AdminLayout>
                  <ProtectedRoute component={AllTasks} />
                </AdminLayout>
              </Route>

              <Route path="/tasks/trash">
                <AdminLayout>
                  <TrashTaskPage />
                </AdminLayout>
              </Route>

              <Route path="/tasks/:taskId">
                <AdminLayout>
                  <ProtectedRoute
                    component={TaskDetail}
                    allowedRoles={[
                      "individual",
                      "employee",
                      "manager",
                      "org_admin",
                    ]}
                  />
                </AdminLayout>
              </Route>

              <Route path="/tasks/:taskId/snooze">
                <AdminLayout>
                  <ProtectedRoute
                    component={() => (
                      <div className="p-4">
                        <h1 className="text-2xl font-bold">Snooze Task</h1>
                        <p>Configure when to resume this task</p>
                      </div>
                    )}
                  />
                </AdminLayout>
              </Route>

              <Route path="/tasks/:taskId/mark-risk">
                <AdminLayout>
                  <ProtectedRoute
                    component={() => (
                      <div className="p-4">
                        <h1 className="text-2xl font-bold">Mark as Risk</h1>
                        <p>Mark this task as at risk and provide details</p>
                      </div>
                    )}
                  />
                </AdminLayout>
              </Route>

              <Route path="/tasks/:taskId/mark-done">
                <AdminLayout>
                  <ProtectedRoute
                    component={() => (
                      <div className="p-4">
                        <h1 className="text-2xl font-bold">Mark as Done</h1>
                        <p>Complete this task and update status</p>
                      </div>
                    )}
                  />
                </AdminLayout>
              </Route>

              <Route path="/tasks/:taskId/delete">
                <AdminLayout>
                  <ProtectedRoute
                    component={() => (
                      <div className="p-4">
                        <h1 className="text-2xl font-bold">Delete Task</h1>
                        <p>Permanently remove this task</p>
                      </div>
                    )}
                  />
                </AdminLayout>
              </Route>

              <Route path="/tasks/:taskId/subtasks/create">
                <AdminLayout>
                  <ProtectedRoute
                    component={() => (
                      <div className="p-4">
                        <h1 className="text-2xl font-bold">Create Subtask</h1>
                        <p>Add a new subtask to this task</p>
                      </div>
                    )}
                  />
                </AdminLayout>
              </Route>
              <Route path="/setting">
                <AdminLayout>
                  <ProtectedRoute component={AdminSettings} />
                </AdminLayout>
              </Route>

              <Route path="/task/view/:taskId?">
                <AdminLayout>
                  <ProtectedRoute
                    component={TaskDetail}
                    allowedRoles={[
                      "individual",
                      "employee",
                      "manager",
                      "org_admin",
                    ]}
                  />
                </AdminLayout>
              </Route>

              <Route path="/users">
                <AdminLayout>
                  <ProtectedRoute component={Users} />
                </AdminLayout>
              </Route>
              <Route path="/user-management">
                <AdminLayout>
                  <ProtectedRoute
                    component={UserManagement}
                    allowedRoles={["org_admin"]}
                  />
                </AdminLayout>
              </Route>
              <Route path="/team-members">
                <AdminLayout>
                  <ProtectedRoute
                    component={TeamMembers}
                    allowedRoles={["org_admin", "org_admin"]}
                  />
                </AdminLayout>
              </Route>
              <Route path="/admin/team-members">
                <AdminLayout>
                  <ProtectedRoute
                    component={TeamMembers}
                    allowedRoles={["org_admin", "org_admin"]}
                  />
                </AdminLayout>
              </Route>

              <Route path="/admin/users">
                <AdminLayout>
                  <ProtectedRoute
                    component={Users}
                    allowedRoles={["org_admin"]}
                  />
                </AdminLayout>
              </Route>
              <Route path="/admin/plans">
                <AdminLayout>
                  <ProtectedRoute
                    component={PlansLicenses}
                    allowedRoles={["org_admin"]}
                  />
                </AdminLayout>
              </Route>
              <Route path="/roles">
                <AdminLayout>
                  <ProtectedRoute
                    component={RoleManagement}
                    allowedRoles={["org_admin"]}
                  />
                </AdminLayout>
              </Route>
              <Route path="/admin/role-management">
                <AdminLayout>
                  <ProtectedRoute
                    component={RoleManagement}
                    allowedRoles={["org_admin"]}
                  />
                </AdminLayout>
              </Route>
              <Route path="/admin/recurring">
                <AdminLayout>
                  <ProtectedRoute
                    component={RecurringTaskManager}
                    allowedRoles={["org_admin"]}
                  />
                </AdminLayout>
              </Route>

              <Route path="/admin/approval">
                <AdminLayout>
                  <ProtectedRoute
                    component={ApprovalManager}
                    allowedRoles={["org_admin"]}
                  />
                </AdminLayout>
              </Route>
              <Route path="/admin/milestone">
                <AdminLayout>
                  <ProtectedRoute
                    component={MilestoneManager}
                    allowedRoles={["org_admin"]}
                  />
                </AdminLayout>
              </Route>
              <Route path="/admin/StatusManager">
                <AdminLayout>
                  <ProtectedRoute
                    component={StatusManager}
                    allowedRoles={["org_admin"]}
                  />
                </AdminLayout>
              </Route>
              <Route path="/admin/PriorityManager">
                <AdminLayout>
                  <ProtectedRoute
                    component={PriorityManager}
                    allowedRoles={["org_admin"]}
                  />
                </AdminLayout>
              </Route>
              <Route path="/admin/status">
                <AdminLayout>
                  <ProtectedRoute
                    component={StatusManager}
                    allowedRoles={["org_admin"]}
                  />
                </AdminLayout>
              </Route>
              <Route path="/admin/priority">
                <AdminLayout>
                  <ProtectedRoute
                    component={PriorityManager}
                    allowedRoles={["org_admin"]}
                  />
                </AdminLayout>
              </Route>
              <Route path="/admin/activity-feed">
                <AdminLayout>
                  <ProtectedRoute
                    component={ActivityFeed}
                    allowedRoles={["org_admin"]}
                  />
                </AdminLayout>
              </Route>

              <Route path="/projects">
                <AdminLayout>
                  <ProtectedRoute component={Projects} />
                </AdminLayout>
              </Route>
              <Route path="/forms">
                <AdminLayout>
                  <ProtectedRoute component={FormBuilder} />
                </AdminLayout>
              </Route>
              <Route path="/integrations">
                <AdminLayout>
                  <ProtectedRoute component={Integrations} />
                </AdminLayout>
              </Route>
              {/* Reports & Analytics Routes */}
              <Route path="/reports/productivity">
                <AdminLayout>
                  <ProtectedRoute
                    component={ManagerProductivityPage}
                    allowedRoles={[
                      "employee",
                      "individual",
                      "manager",
                      "org_admin",
                      "admin",
                    ]}
                  />
                </AdminLayout>
              </Route>
              <Route path="/reports/team">
                <AdminLayout>
                  <ProtectedRoute
                    component={ManagerTeamAnalyticsPage}
                    allowedRoles={["manager", "org_admin", "admin"]}
                  />
                </AdminLayout>
              </Route>
              <Route path="/reports/organization">
                <AdminLayout>
                  <ProtectedRoute
                    component={OrganizationAnalyticsPage}
                    allowedRoles={[
                      "individual",
                      "employee",
                      "manager",
                      "org_admin",
                      "admin",
                    ]}
                  />
                </AdminLayout>
              </Route>
              <Route path="/reports">
                <AdminLayout>
                  <ProtectedRoute
                    component={OrganizationAnalyticsPage}
                    allowedRoles={[
                      "individual",
                      "employee",
                      "manager",
                      "org_admin",
                      "admin",
                    ]}
                  />
                </AdminLayout>
              </Route>
              <Route path="/notification-center">
                <AdminLayout>
                  <ProtectedRoute
                    component={NotificationCenter}
                    allowedRoles={["org_admin"]}
                  />
                </AdminLayout>
              </Route>
              <Route path="/notifications">
                <AdminLayout>
                  <ProtectedRoute component={NotificationCenter} />
                </AdminLayout>
              </Route>
              {/* Superadmin Notifications Route */}
              <Route path="/super-admin/notifications">
                <SuperAdminLayout>
                  <ProtectedRoute
                    component={NotificationCenter}
                    allowedRoles={["super_admin"]}
                  />
                </SuperAdminLayout>
              </Route>
              <Route path="/notification">
                <AdminLayout>
                  <ProtectedRoute component={AdminNotification} />
                </AdminLayout>
              </Route>
              <Route path="/sidebar-demo">
                <SidebarDemo />
              </Route>
              <Route path="/member-dashboard">
                <MemberDashboard />
              </Route>
              <Route path="/current-user-sidebar">
                <CurrentUserSidebar />
              </Route>
              {/* Settings Routes */}
              <Route path="/settings">
                <SettingsLayout>
                  <ProtectedRoute allowedRoles={["org_admin"]}>
                    <div className="p-4">
                      <script>
                        window.location.href = '/settings/user-management';
                      </script>
                      <p>Redirecting to User Management...</p>
                    </div>
                  </ProtectedRoute>
                </SettingsLayout>
              </Route>
              <Route path="/settings/general">
                <SettingsLayout>
                  <ProtectedRoute
                    component={GeneralSettings}
                    allowedRoles={["org_admin"]}
                  />
                </SettingsLayout>
              </Route>
              <Route path="/settings/user-management">
                <SettingsLayout>
                  <ProtectedRoute
                    component={SettingsUserManagement}
                    allowedRoles={["org_admin", "org_admin"]}
                  />
                </SettingsLayout>
              </Route>
              <Route path="/settings/subscription">
                <SettingsLayout>
                  <ProtectedRoute
                    component={Subscription}
                    allowedRoles={["org_admin"]}
                  />
                </SettingsLayout>
              </Route>
              <Route path="/settings/license">
                <SettingsLayout>
                  <ProtectedRoute
                    component={LicensePage}
                    allowedRoles={["org_admin", "manager", "employee"]}
                  />
                </SettingsLayout>
              </Route>

              {/* Licensing & Subscription Routes */}
              <Route path="/admin/subscription">
                <AdminLayout>
                  <ProtectedRoute
                    component={LicenseManagementPage}
                    allowedRoles={[
                      "org_admin",
                      "manager",
                      "individual",
                      "employee",
                    ]}
                  />
                </AdminLayout>
              </Route>
              <Route path="/admin/billing">
                <AdminLayout>
                  <ProtectedRoute
                    component={BillingPageWrapper}
                    allowedRoles={["org_admin", "individual"]}
                  />
                </AdminLayout>
              </Route>
              <Route path="/admin/upgrade">
                <AdminLayout>
                  <ProtectedRoute
                    component={PurchaseUpgradePage}
                    allowedRoles={["org_admin", "individual"]}
                  />
                </AdminLayout>
              </Route>
              <Route path="/pricing">
                <PricingPage />
              </Route>
              <Route path="/settings/roles">
                <SettingsLayout>
                  <ProtectedRoute
                    component={SettingsRoles}
                    allowedRoles={["org_admin"]}
                  />
                </SettingsLayout>
              </Route>

              {/* Help & Support Page */}
              <Route path="/help">
                <AdminLayout>
                  <ProtectedRoute
                    component={HelpSupport}
                    allowedRoles={[
                      "org_admin",
                      "manager",
                      "individual",
                      "employee",
                    ]}
                  />
                </AdminLayout>
              </Route>

              {/* Documentation Page */}
              <Route path="/documentation">
                <AdminLayout>
                  <ProtectedRoute
                    component={Documentation}
                    allowedRoles={[
                      "org_admin",
                      "manager",
                      "individual",
                      "employee",
                    ]}
                  />
                </AdminLayout>
              </Route>

              {/* 404 Not Found */}
              <Route>
                <div className="flex items-center justify-center h-screen">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      Page Not Found
                    </h2>
                    <p className="text-gray-600">
                      The page you're looking for doesn't exist.
                    </p>
                  </div>
                </div>
              </Route>
            </Switch>
            <Toaster />
            <GlobalSubtaskDrawer />
            <GlobalViewModal />
          </ViewProvider>
        </SubtaskProvider>
      </RoleProvider>
    </QueryClientProvider>
  );
}

export default App;
