import express from 'express';
import { getDashboardStats } from '../controller/taskfeedController.js';
import { authenticateToken } from '../middleware/roleAuth.js';
import { checkFeatureAccess } from '../middleware/licenseMiddleware.js';

const router = express.Router();

// Get dashboard stats (protected route)
router.get('/dashboard-stats', authenticateToken, getDashboardStats);

export default router;
