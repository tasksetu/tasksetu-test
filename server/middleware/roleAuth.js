import jwt from "jsonwebtoken";
import { storage } from "../mongodb-storage.js";
const JWT_SECRET = process.env.JWT_SECRET;

// Role hierarchy: super_admin > org_admin > employee > individual
const ROLE_HIERARCHY = {
  super_admin: 4,
  org_admin: 3,
  employee: 2,
  individual: 1,
};

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      console.log("Auth middleware - No token provided");
      return res.status(401).json({ error: "Access token required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    console.log("🔐 Token decoded, user ID:", decoded.id);

    // Get fresh user data to ensure role/organization info is current
    const user = await storage.getUser(decoded.id);

    if (!user || !user.isActive) {
      console.log("Auth middleware - User invalid or inactive");
      return res.status(401).json({ error: "Invalid or inactive user" });
    }

    console.log("🔍 Auth middleware - User from DB:", {
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    });

    console.log("✅ User authenticated:", {
      id: user._id,
      _id: user._id,
      email: user.email,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      role: user.role,
      orgId: user.organization_id
    });

    req.user = {
      id: user._id,
      userId: user._id,
      _id: user._id,    
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      role: user.role,
      phone: user.phone || "",
      phoneVerified: user.phoneVerified || false,
      organizationId: user.organization_id,
      permissions: user.permissions || [],
      isPrimaryAdmin: user.isPrimaryAdmin || false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    console.log("✅ Auth middleware - req.user:", req.user);

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.log("Auth middleware - Token expired at:", error.expiredAt);
      return res.status(401).json({
        error: "Token expired",
        message: "Your session has expired. Please login again.",
        expiredAt: error.expiredAt
      });
    } else if (error.name === 'JsonWebTokenError') {
      console.log("Auth middleware - Invalid token:", error.message);
      return res.status(403).json({ error: "Invalid token" });
    } else {
      console.log("Auth middleware - Error:", error.message);
      return res.status(403).json({ error: "Authentication failed" });
    }
  }
};

export const roleAuth = (allowedRoles) => (req, res, next) => {
  const userRole = req.user?.role;
  if (!userRole) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  // Support both string and array roles
  if (Array.isArray(userRole)) {
    if (!userRole.some(role => allowedRoles.includes(role))) {
      return res.status(403).json({ message: 'Forbidden' });
    }
  } else {
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
  }
  next();
};
export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = req.user.role;

    console.log('allowed role', userRole, allowedRoles)
    if (userRole.some(role => allowedRoles.includes(role))) {
      return next();
    }

    return res.status(403).json({ error: "Insufficient permissions debuger 2" });
  };
};

export const requireSuperAdmin = requireRole(["super_admin"]);

export const requireOrgAdminOrAbove = requireRole([
  "super_admin",
  "org_admin",
  "admin",
  "manager",
]);

export const requireEmployee = requireRole([
  "super_admin",
  "org_admin",
  "employee",
]);

// Strict middleware for org_admin only access (excludes superadmin)
export const requireOrgAdminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  // Allow 'org_admin', 'admin', and 'manager' roles for organization management
  if (req.user.role !== "org_admin" && req.user.role !== "admin" && req.user.role !== "manager") {
    return res.status(403).json({
      error:
        "Access denied. This feature is only available to organization administrators.",
    });
  }

  next();
};

// New middleware for organization management features
export const requireOrganizationManagement = (req, res, next) => {
  // Explicitly block individual users from organization management
  if (req.user && req.user.role === "individual") {
    return res
      .status(403)
      .json({
        error:
          "Individual users cannot access organization management features",
      });
  }

  // Allow super_admin, org_admin, admin, and manager roles
  return requireRole(["super_admin", "org_admin", "admin", "manager"])(req, res, next);
};

export const requireOrganizationAccess = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const user = req.user;

    // Individual users should not access organization features
    if (user.role === "individual") {
      return res
        .status(403)
        .json({
          error: "Individual users cannot access organization features",
        });
    }

    // Super admins have access to all organizations
    if (user.role === "super_admin") {
      return next();
    }

    // Admins and employees can only access their own organization
    if (
      user.organizationId &&
      user.organizationId.toString() === organizationId
    ) {
      return next();
    }

    return res
      .status(403)
      .json({ error: "Access denied to this organization" });
  } catch (error) {
    return res.status(500).json({ error: "Authorization check failed" });
  }
};

export const getRedirectRoute = (role) => {
  switch (role) {
    case "super_admin":
      return "/super-admin";
    case "admin":
      return "/dashboard";
    case "employee":
      return "/dashboard";
    default:
      return "/dashboard";
  }
};
