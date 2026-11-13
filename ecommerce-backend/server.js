require('dotenv').config();

const required = [
    'MONGO_URI',
    'JWT_SECRET',
    'PAYSTACK_SECRET_KEY',
    'FRONTEND_URL',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
];
for (const name of required) {
    if (!process.env[name]) {
        console.error(`Missing environment variable: ${name}`);
        process.exit(1);
    }
}

const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet'); // NEW
const rateLimit = require('express-rate-limit'); // NEW
const Product = require('./models/Product');

const app = express();

// NEW: on a host like Render, requests arrive through one proxy. Tell Express to
// trust it so the rate limiter sees each visitor's real IP address.
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

const allowedOrigins = process.env.FRONTEND_URL
    .split(',')
    .map(url => url.trim().replace(/\/+$/, ''))
    .filter(Boolean);

console.log('Allowed origins:', allowedOrigins);

app.use(helmet()); // NEW: safer HTTP headers on every response
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '100kb' }));

// NEW: rate limits. Messages use { message } so the frontend shows them as it does other errors.
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many requests. Please slow down and try again shortly.' },
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true, // only failed logins count
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many accounts created from this connection. Please try again later.' },
});

app.use('/api', apiLimiter); // NEW
app.use('/api/auth/login', loginLimiter); // NEW
app.use('/api/auth/register', registerLimiter); // NEW

app.get('/', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(product);
    } catch (err) {
        res.status(404).json({ message: 'Product not found' });
    }
});

app.use('/api/auth', require('./Routes/auth'));
app.use('/api/orders', require('./Routes/orders'));
app.use('/api/admin', require('./Routes/admin'));

app.use((req, res) => {
    res.status(404).json({ message: 'Not found' });
});

app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ message: 'Invalid JSON' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
});

const PORT = process.env.PORT || 5000;

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log('MongoDB connected');
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('MongoDB connection error:', err.message);
        process.exit(1);
    });