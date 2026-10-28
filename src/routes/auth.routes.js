const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
});

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);

module.exports = router;
