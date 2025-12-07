// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || '1h';

const normalizeEmail = (value = '') => value.toLowerCase().trim();
const normalizeMobile = (value = '') => value.replace(/\D/g, '');
const isValidMobile = (value = '') => /^\d{7,15}$/.test(value);

// rate limiter for auth
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many requests, try again later.' }
});

// -------------------- REGISTER --------------------
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, email, mobile, password, role } = req.body;

    if (!name || !email || !mobile || !password)
      return res.status(400).json({ error: 'name, email, mobile and password required' });

    const normalizedEmail = normalizeEmail(email);
    const normalizedMobile = normalizeMobile(mobile);

    if (!validator.isEmail(normalizedEmail)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    if (!isValidMobile(normalizedMobile)) {
      return res.status(400).json({ error: 'Invalid mobile number' });
    }

    const existing = await User.findOne({
      $or: [{ email: normalizedEmail }, { mobile: normalizedMobile }]
    });

    if (existing) {
      if (existing.email === normalizedEmail) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      if (existing.mobile === normalizedMobile) {
        return res.status(409).json({ error: 'Mobile number already registered' });
      }
      return res.status(409).json({ error: 'User already exists' });
    }

    const user = new User({
      name,
      email: normalizedEmail,
      mobile: normalizedMobile,
      password,
      role
    });

    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    res.status(201).json({ message: 'User created', user: user.toJSON(), token });

  } catch (err) {
    console.error('Register error:', err);
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join(', ');
      return res.status(400).json({ error: message || 'Invalid data supplied' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// -------------------- LOGIN --------------------
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { identifier, email, mobile, password } = req.body;
    const candidates = [identifier, email, mobile]
      .map((value) => (value ?? '').toString().trim())
      .filter((value) => value.length > 0);
    const credential = candidates[0] || '';

    if (!credential || !password)
      return res.status(400).json({ error: 'login identifier and password required' });

    let query;
    if (validator.isEmail(credential)) {
      query = { email: normalizeEmail(credential) };
    } else {
      const normalizedMobile = normalizeMobile(credential);
      if (!isValidMobile(normalizedMobile)) {
        return res.status(400).json({ error: 'Invalid email or mobile number' });
      }
      query = { mobile: normalizedMobile };
    }

    const user = await User.findOne(query);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    res.json({ message: 'Login successful', user: user.toJSON(), token });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// -------------------- FORGOT PASSWORD --------------------
router.post('/forgot', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) {
      // security: don't reveal if user exists
      return res.json({ message: "If email exists, reset link sent" });
    }

    // create reset token
    const token = crypto.randomBytes(32).toString('hex');

    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();

    // In production you send the email here
    // const link = `https://yourfrontend/reset/${token}`

    return res.json({
      message: "Password reset token generated",
      resetToken: token, // for development only
      expires: "15 minutes"
    });

  } catch (err) {
    console.error('Forgot error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// -------------------- RESET PASSWORD --------------------
router.post('/reset/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password)
      return res.status(400).json({ error: "New password required" });

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() } // not expired
    });

    if (!user)
      return res.status(400).json({ error: "Invalid or expired token" });

    // Set new password (will auto-hash via pre('save'))
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.json({ message: "Password reset successful. You can now login." });

  } catch (err) {
    console.error('Reset error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
