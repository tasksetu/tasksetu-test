/**
 * 🔑 LICENSE SYSTEM - EXPORTS
 * 
 * Central export file for all license-related functionality
 */

// Models
export { CompanyLicense } from './modals/companyLicenseModal.js';

// Controllers
export {
  purchaseBulkLicenses,
  getLicenseInventory,
  getAvailableLicenses,
  getAssignedLicenses,
  getLicenseDetails,
} from './controllers/licensePoolManagementController.js';

export {
  assignUserLicense,
  getUserLicense,
  bulkAssignLicenses,
} from './controllers/userLicenseController.js';

// Middleware
export {
  getUserEffectiveLicense,
  requireLicense,
  checkFeatureAccess,
  getFeatureAccessSummary,
  trackFeatureUsage,
} from './middleware/newLicenseMiddleware.js';

// Routes
import licensePoolRoutes from './routes/licensePoolRoutes.js';
export { licensePoolRoutes };
