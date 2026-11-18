const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

async function verifyTurnstile(token, ip) {
    if (typeof token !== 'string' || !token || token.length > 2048) return false;
    try {
        const body = new URLSearchParams({
            secret: process.env.TURNSTILE_SECRET_KEY,
            response: token,
        });
        if (ip) body.append('remoteip', ip);

        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body,
            signal: AbortSignal.timeout(10000),
        });
        const data = await res.json();
        return data.success === true;
    } catch (err) {
        console.error('Turnstile check error:', err.message);
        return false;
    }
}

const router = express.Router();

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createToken(user) {
    return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

router.post('/register', async (req, res) => {
    try {
        if (!(await verifyTurnstile(req.body && req.body.turnstileToken, req.ip))) {
            return res.status(400).json({ message: 'Human check failed. Please try again.' });
        }
        const { name, email, password } = req.body || {};

        if (
            typeof name !== 'string' ||
            typeof email !== 'string' ||
            typeof password !== 'string'
        ) {
            return res.status(400).json({ message: 'Name, email and password are required' });
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (!cleanName || !cleanEmail || !password) {
            return res.status(400).json({ message: 'Name, email and password are required' });
        }
        if (cleanName.length > 100) {
            return res.status(400).json({ message: 'Name is too long' });
        }
        if (!EMAIL_PATTERN.test(cleanEmail)) {
            return res.status(400).json({ message: 'Enter a valid email address' });
        }
        if (password.length < 8 || password.length > 72) {
            return res.status(400).json({ message: 'Password must be 8 to 72 characters' });
        }

        const existing = await User.findOne({ email: cleanEmail });
        if (existing) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({
            name: cleanName,
            email: cleanEmail,
            password: hashed,
        });

        res.status(201).json({ token: createToken(user), user });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Email already registered' });
        }
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (typeof email !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
        const valid = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);

        if (!user || !valid) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        res.json({ token: createToken(user), user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;