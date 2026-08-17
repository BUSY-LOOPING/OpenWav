import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import { logger } from '../config/logger.js';


/**
 * Throws error when not found or deactivated
 */
const vertifyToken = async (token) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from database
        const userResult = await query(
            'SELECT id, username, email, role, is_active FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (userResult.rows.length === 0) {
            const error = new Error('User not found');
            error.statusCode = 401;
            throw error;
        }

        const user = userResult.rows[0];

        if (!user.is_active) {
            const error = new Error('Account is deactivated');
            error.statusCode = 401;
            throw error;
        }
        query('UPDATE users SET last_seen = NOW() WHERE id = $1', [user.id]).catch(() => { });
        return user
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired'
            });
        }

        logger.error('Authentication error:', error);
        return res.status(500).json({
            success: false,
            message: 'Authentication failed'
        });
    }
}
// Verify JWT token middleware
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1] || req.query.token; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access token required'
            });
        }

        // Verify the token
        const user = await vertifyToken(token)

        req.user = user;
        next();

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired'
            });
        }
        if (error.statusCode && error.message) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        logger.error('Authentication error:', error);
        return res.status(500).json({
            success: false,
            message: 'Authentication failed'
        });
    }
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            req.user = null;
            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const userResult = await query(
            'SELECT id, username, email, role, is_active FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (userResult.rows.length > 0 && userResult.rows[0].is_active) {
            req.user = userResult.rows[0];
        } else {
            req.user = null;
        }

        next();

    } catch (error) {
        // If token is invalid or expired, just continue without user
        req.user = null;
        next();
    }
};

// Generate JWT tokens
const generateTokens = (userId) => {
    const payload = { userId };

    const accessToken = jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    const refreshToken = jwt.sign(
        payload,
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );


    return { accessToken, refreshToken };
};

// Verify refresh token
const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
        throw new Error('Invalid refresh token');
    }
};

export {
    authenticateToken,
    optionalAuth,
    generateTokens,
    verifyRefreshToken,
    vertifyToken
};