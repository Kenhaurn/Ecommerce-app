const express = require('express');
const crypto = require('crypto');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

const SITE_URL = (process.env.SITE_URL || (process.env.FRONTEND_URL || '').split(',')[0])
    .trim()
    .replace(/\/+$/, '');

async function paystackRequest(path, options = {}) {
    const res = await fetch(`https://api.paystack.co${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
    });
    return res.json();
}

function cleanDelivery(input) {
    const d = input || {};
    const name = typeof d.name === 'string' ? d.name.trim() : '';
    const phone = typeof d.phone === 'string' ? d.phone.trim() : '';
    const address = typeof d.address === 'string' ? d.address.trim() : '';
    const city = typeof d.city === 'string' ? d.city.trim() : '';

    if (!name || !phone || !address || !city) return null;
    if (name.length > 100 || address.length > 200 || city.length > 100) return null;
    if (!/^[0-9+\s-]{7,15}$/.test(phone)) return null;
    return { name, phone, address, city };
}

function paymentMatches(data, order) {
    return Boolean(
        data &&
        data.status &&
        data.data &&
        data.data.status === 'success' &&
        data.data.amount === Math.round(order.total * 100)
    );
}

async function markPaid(order) {
    // Only one caller can flip pending -> paid, so stock is reduced once.
    const claimed = await Order.findOneAndUpdate(
        { _id: order._id, status: 'pending' },
        { status: 'paid' }
    );
    if (!claimed) {
        const fresh = await Order.findById(order._id);
        return !!fresh && fresh.status === 'paid';
    }

    let stockIssue = false;
    for (const item of order.items) {
        const result = await Product.updateOne(
            { _id: item.product, stock: { $gte: item.quantity } },
            { $inc: { stock: -item.quantity } }
        );
        if (result.modifiedCount === 0) stockIssue = true;
    }

    if (stockIssue) {
        await Order.updateOne({ _id: order._id }, { stockIssue: true });
    }
    return true;
}

async function findShortItem(items) {
    for (const item of items) {
        const product = await Product.findById(item.product);
        if (!product || product.stock < item.quantity) return item.name;
    }
    return null;
}

async function settleIfPaid(order) {
    if (order.status !== 'pending') return order.status === 'paid';

    const refs = new Set(order.references);
    if (order.reference) refs.add(order.reference);

    for (const ref of refs) {
        const data = await paystackRequest(
            `/transaction/verify/${encodeURIComponent(ref)}`
        );
        if (paymentMatches(data, order)) {
            return await markPaid(order);
        }
    }
    return false;
}

router.post('/', auth, async (req, res) => {
    try {
        const { items } = req.body || {};

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Cart is empty' });
        }
        const delivery = cleanDelivery(req.body.delivery);
        if (!delivery) {
            return res
                .status(400)
                .json({ message: 'Please enter a valid name, phone number, address and city' });
        }

        const wanted = new Map();
        for (const item of items) {
            const productId = item && item.productId;
            const quantity = Number(item && item.quantity);
            if (
                typeof productId !== 'string' ||
                !Number.isInteger(quantity) ||
                quantity < 1 ||
                quantity > 100
            ) {
                return res.status(400).json({ message: 'Invalid item in cart' });
            }
            wanted.set(productId, (wanted.get(productId) || 0) + quantity);
        }

        const orderItems = [];
        let total = 0;

        for (const [productId, quantity] of wanted) {
            const product = await Product.findById(productId);

            if (!product) {
                return res.status(400).json({ message: 'Invalid item in cart' });
            }
            if (product.stock < quantity) {
                return res.status(400).json({
                    message:
                        product.stock === 0
                            ? `${product.name} is out of stock`
                            : `Only ${product.stock} of ${product.name} left`,
                });
            }

            orderItems.push({
                product: product._id,
                name: product.name,
                price: product.price,
                quantity,
            });
            total += product.price * quantity;
        }

        const order = await Order.create({ user: req.userId, items: orderItems, total, delivery });
        res.status(201).json(order);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid item in cart' });
        }
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/mine', auth, async (req, res) => {
    try {
        const orders = await Order.find({ user: req.userId })
            .select('-stockIssue -paidAfterCancel -paidAfterCancelRef -refunded')
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/:id/pay', auth, async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, user: req.userId });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        if (order.status === 'paid') {
            return res.status(400).json({ message: 'Order already paid' });
        }
        if (order.status === 'cancelled') {
            return res.status(400).json({ message: 'This order was cancelled' });
        }

        // An earlier attempt may already have succeeded: never charge twice.
        if (await settleIfPaid(order)) {
            return res.json({ alreadyPaid: true });
        }

        const short = await findShortItem(order.items);
        if (short) {
            return res.status(400).json({
                message: `${short} is out of stock or has fewer left than you ordered. Cancel this order and reorder.`,
            });
        }

        const user = await User.findById(req.userId);

        const data = await paystackRequest('/transaction/initialize', {
            method: 'POST',
            body: JSON.stringify({
                email: user.email,
                amount: Math.round(order.total * 100),
                callback_url: `${SITE_URL}/payment/callback`,
                metadata: { orderId: order._id.toString() },
            }),
        });

        if (!data.status || !data.data) {
            console.error(data);
            return res.status(502).json({ message: 'Could not start payment' });
        }

        order.reference = data.data.reference;
        order.references.push(data.data.reference);
        await order.save();

        res.json({ authorizationUrl: data.data.authorization_url });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ message: 'Order not found' });
        }
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/verify', auth, async (req, res) => {
    try {
        const { reference } = req.body || {};
        if (typeof reference !== 'string' || !reference) {
            return res.status(400).json({ message: 'Reference is required' });
        }

        const order = await Order.findOne({
            $or: [{ reference }, { references: reference }],
            user: req.userId,
        });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        if (order.status === 'paid') {
            return res.json(order);
        }
        if (order.status === 'cancelled') {
            return res.status(400).json({ message: 'This order was cancelled' });
        }

        const data = await paystackRequest(
            `/transaction/verify/${encodeURIComponent(reference)}`
        );
        if (!paymentMatches(data, order)) {
            return res.status(400).json({ message: 'Payment not completed' });
        }

        if (!(await markPaid(order))) {
            return res.status(400).json({ message: 'This order was cancelled' });
        }
        res.json(await Order.findById(order._id));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Paystack calls this directly when a payment succeeds, with no browser involved.
// No `auth` here: Paystack proves who it is with a signature instead.
router.post('/webhook', async (req, res) => {
    try {
        const signature = req.get('x-paystack-signature');
        const raw = req.body;

        if (!signature || !Buffer.isBuffer(raw)) {
            console.error('Webhook rejected: missing signature or raw body');
            return res.sendStatus(400);
        }

        const expected = crypto
            .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
            .update(raw)
            .digest('hex');
        const a = Buffer.from(expected);
        const b = Buffer.from(signature);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
            console.error('Webhook rejected: bad signature');
            return res.sendStatus(401);
        }

        const event = JSON.parse(raw.toString('utf8'));
        const reference = event.data && event.data.reference;
        console.log('Paystack webhook:', event.event, reference);

        if (event.event === 'charge.success' && typeof reference === 'string') {
            const order = await Order.findOne({
                $or: [{ reference }, { references: reference }],
            });

            if (order && order.status === 'pending') {
                // Ask Paystack ourselves instead of trusting the message body
                const data = await paystackRequest(
                    `/transaction/verify/${encodeURIComponent(reference)}`
                );
                if (paymentMatches(data, order)) {
                    await markPaid(order);
                }
            } else if (order && order.status === 'cancelled') {
                // Money arrived for an order that was cancelled: flag it for a refund
                const data = await paystackRequest(
                    `/transaction/verify/${encodeURIComponent(reference)}`
                );
                if (paymentMatches(data, order)) {
                    await Order.updateOne(
                        { _id: order._id, refunded: { $ne: true } },
                        { paidAfterCancel: true, paidAfterCancelRef: reference }
                    );
                }
            }
        }

        res.sendStatus(200);
    } catch (err) {
        console.error('Webhook error:', err);
        res.sendStatus(500); // a 500 tells Paystack to try again later
    }
});

router.post('/:id/check', auth, async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, user: req.userId });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        if (order.status === 'pending') {
            await settleIfPaid(order);
        }
        res.json(await Order.findById(order._id));
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ message: 'Order not found' });
        }
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/:id/cancel', auth, async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, user: req.userId });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        if (order.status === 'cancelled') {
            return res.json(order);
        }
        if (order.status === 'paid') {
            return res
                .status(400)
                .json({ message: 'This order is already paid and cannot be cancelled' });
        }
        if (await settleIfPaid(order)) {
            return res.status(400).json({
                message: 'We found a completed payment for this order, so it cannot be cancelled',
            });
        }

        const cancelled = await Order.findOneAndUpdate(
            { _id: order._id, status: 'pending' },
            { status: 'cancelled' },
            { returnDocument: 'after' }
        );
        if (!cancelled) {
            return res
                .status(400)
                .json({ message: 'This order was just paid and cannot be cancelled' });
        }
        res.json(cancelled);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ message: 'Order not found' });
        }
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;