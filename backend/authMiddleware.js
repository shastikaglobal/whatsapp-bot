import jwt from 'jsonwebtoken';

export const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const parts = authHeader.trim().split(' ');
  const tokenValue = parts.length === 2 ? parts[1] : parts[0];
  
  try {
    const secret = process.env.JWT_SECRET || 'shastika_default_jwt_secret_2025';
    const decoded = jwt.verify(tokenValue, secret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
  }
};

export const authorizeAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'Admin') {
    next();
  } else {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
};
