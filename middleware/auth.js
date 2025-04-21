import { supabase } from '../utils/db.js';

/**
 * Middleware to verify JWT token
 */
export const verifyToken = async (req, res, next) => {
    try {
        let token = req.header("Authorization");

        if (!token) {
            return res.status(403).json({ message: "You need to login." });
        }

        if (token.startsWith("Bearer ")) {
            token = token.slice(7, token.length).trimLeft();
        }

        // Verify token with Supabase Auth
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
            if (error?.message?.includes('expired')) {
                return res.status(401).json({ message: "Token has expired. Please login again." });
            } else {
                return res.status(401).json({ message: "Invalid token. Please login again." });
            }
        }

        // Add user data to request
        req.user = {
            id: user.id,
            email: user.email,
            role: user.user_metadata?.role || 'user'
        };
        
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(500).json({ message: "Authentication error. Please try again later." });
    }
};

/**
 * Check if user has required role
 * @param {string|string[]} roles - Required role(s)
 */
export const requireRole = (roles) => {
    return (req, res, next) => {
        try {
            // Verify user exists on request (set by verifyToken)
            if (!req.user) {
                return res.status(403).json({ message: "Authentication required." });
            }
            
            const userRole = req.user.role || 'user';
            
            // Check if user has required role
            if (Array.isArray(roles)) {
                if (!roles.includes(userRole)) {
                    return res.status(403).json({ 
                        message: "You don't have permission to access this resource." 
                    });
                }
            } else {
                if (roles !== userRole) {
                    return res.status(403).json({ 
                        message: "You don't have permission to access this resource." 
                    });
                }
            }
            
            next();
        } catch (error) {
            console.error('Role verification error:', error);
            res.status(500).json({ message: "Authorization error. Please try again later." });
        }
    };
};

/**
 * Middleware to get user data if available but not require authentication
 * Useful for routes that work for both authenticated and unauthenticated users
 */
export const getOptionalUser = async (req, res, next) => {
    try {
        let token = req.header("Authorization");

        if (!token) {
            // No token, continue without user data
            return next();
        }

        if (token.startsWith("Bearer ")) {
            token = token.slice(7, token.length).trimLeft();
        }

        // Verify token with Supabase Auth
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (!error && user) {
            // Add user data to request
            req.user = {
                id: user.id,
                email: user.email,
                role: user.user_metadata?.role || 'user'
            };
        }
        
        next();
    } catch (error) {
        // Don't block the request, just continue without user data
        next();
    }
};

export default {
    verifyToken,
    requireRole,
    getOptionalUser
}; 