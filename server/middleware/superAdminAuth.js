// Super Admin Authentication Middleware
import { storage } from '../mongodb-storage.js';

export const requireSuperAdmin = async (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Get user details
    const user = await storage.getUser(req.user.id);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Check if user has super admin role (array or string)
    const isSuperAdmin = Array.isArray(user.role)
      ? user.role.includes('super_admin')
      : user.role === 'super_admin';
    if (!isSuperAdmin) {
      return res.status(403).json({
        message: 'Super admin access required',
        userRole: user.role
      });
    }

    // Attach user info to request
    req.superAdmin = user;
    next();
  } catch (error) {
    console.error('Super admin auth error:', error);
    res.status(500).json({ message: 'Authentication error' });
  }
};

export const requireSuperAdminOrCompanyAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const user = await storage.getUser(req.user.id);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Allow both super admin and company admin (handle role as array)
    const roles = Array.isArray(user.role) ? user.role : [user.role];
    const isAdmin = roles.includes('super_admin') || roles.includes('admin') || roles.includes('org_admin');
    
    if (!isAdmin) {
      return res.status(403).json({
        message: 'Admin access required',
        userRole: user.role
      });
    }

    req.adminUser = user;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ message: 'Authentication error' });
  }
};