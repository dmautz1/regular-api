import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
    try {
        let token = req.header("Authorization");

        if (!token) return res.status(403).json({ message: "You need to login." });

        if (token.startsWith("Bearer ")) {
            token = token.slice(7, token.length).trimLeft();
        }

        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: "Token has expired. Please login again." });
            } else if (error.name === 'NotBeforeError') {
                return res.status(401).json({ message: "Token not yet valid. Please try again." });
            } else {
                return res.status(401).json({ message: "Invalid token. Please login again." });
            }
        }
        
        res.status(500).json({ message: "Authentication error. Please try again later." });
    }
};