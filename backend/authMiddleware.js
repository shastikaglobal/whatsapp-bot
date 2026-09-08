export const authenticate = (req, res, next) => {
  const token = req.headers['authorization'];
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const tokenValue = token.split(' ')[1];
  const adminPassword = (process.env.ADMIN_PASSWORD || 'admin123').trim();

  // For simplicity, we just use the raw password as a token (or base64 of it).
  // In a real prod app, use JWT.
  if (tokenValue !== adminPassword) {
    return res.status(403).json({ error: 'Forbidden: Invalid token' });
  }

  next();
};
