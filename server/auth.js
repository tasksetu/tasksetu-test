import { storage } from "./mongodb-storage.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_EXPIRES_IN = "24h"; // Token expires in 24 hours

export function generateToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('❌ Token verification failed:', error.name, error.message);
    // Re-throw TokenExpiredError so callers can handle it specifically
    if (error.name === 'TokenExpiredError') {
      throw error;
    }
    return null;
  }
}

export async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (tokenError) {
      if (tokenError.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token expired',
          message: 'Your session has expired. Please login again.',
          expiredAt: tokenError.expiredAt
        });
      }
      throw tokenError;
    }

    if (!decoded) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    // Verify user still exists and is active
    const user = await storage.getUser(decoded.id);
    if (!user) {
      return res.status(403).json({ message: 'User not found' });
    }

    // Get organization details if user has one
    let organizationName = null;
    const organizationId = decoded.organizationId || user.organization?.toString() || user.organizationId;

    if (organizationId) {
      try {
        const organization = await storage.getOrganization(organizationId);
        organizationName = organization?.name;
      } catch (error) {
        console.log('Failed to fetch organization:', error);
      }
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      organizationId: organizationId,
      organizationName: organizationName,
      role: decoded.role,
      phone: user.phone || "",
      phoneVerified: user.phoneVerified || false,
      permissions: user.permissions || [],
      isPrimaryAdmin: user.isPrimaryAdmin || false,
    };
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(403).json({ error: 'Authentication failed' });
  }
}

export function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions  debuger1' });
    }

    next();
  };
}

export function requireOrganization(req, res, next) {
  if (!req.user?.organizationId) {
    return res.status(403).json({ message: 'Organization membership required' });
  }
  next();
}