import {logger} from '../config/logger';
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(`User ${req.user.username} attempted to access ${req.path} without proper role. Required: ${roles.join(', ')}, Has: ${req.user.role}`);
      
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        requiredRoles: roles,
        userRole: req.user.role
      });
    }

    next();
  };
};

const requireAdmin = requireRole('admin');

const requireOwnershipOrAdmin = (userIdParam = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Admin can access anything
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId = req.params[userIdParam] || req.body[userIdParam];
    
    if (req.user.id === resourceUserId) {
      return next();
    }

    logger.warn(`User ${req.user.username} attempted to access resource owned by ${resourceUserId}`);
    
    return res.status(403).json({
      success: false,
      message: 'You can only access your own resources'
    });
  };
};

const requireSelfOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Admin can access any profile
  if (req.user.role === 'admin') {
    return next();
  }

  // Users can only access their own profile
  const targetUserId = req.params.userId || req.params.id;
  
  if (req.user.id === targetUserId) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'You can only access your own profile'
  });
};

const identifyUserType = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Add convenience flags
  req.isAdmin = req.user.role === 'admin';
  req.isRegularUser = req.user.role === 'user';
  
  next();
};

export {
  requireRole,
  requireAdmin,
  requireOwnershipOrAdmin,
  requireSelfOrAdmin,
  identifyUserType
};