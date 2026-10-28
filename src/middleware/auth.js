const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authorization token is required',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET || 'healthcare_super_secret_jwt_key_2026_change_in_production';
    const decoded = jwt.verify(token, secret);
    req.user = {
      id: parseInt(decoded.sub || decoded.id, 10),
      email: decoded.email,
    };
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid authorization token',
    });
  }
};

module.exports = auth;
