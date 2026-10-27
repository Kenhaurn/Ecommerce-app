const express = require('express');
const Product = require('../models/Product');
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

async function paystackRequest(path, options = {}) {
    const res = await fetch(`https://api.paystack.co${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    return res.json();
};

function cleanDelivery(input) {
    const d = input || {};
    const name = typeof d.name === 'string' ? d.name.trim() : '';
    const phone = typeof d.phone === 'string' ? d.phone.trim() : '';
    const address = typeof d.address === 'string' ? d.address.trim() : '';
    const city = typeof d.city === 'string' ? d.city.trim() : '';

    if (!name || !phone || !address || !city) return null;
    if (!/^[0-9+\s-]{7,15}$/.test(phone)) return null;
    return { name, phone, address, city };
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

    order.status = 'paid';
    if (stockIssue) {
        order.stockIssue = true;
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
        const success =
            data.status &&
            data.data &&
            data.data.status === 'success' &&
            data.data.amount === Math.round(order.total * 100);

        if (success) {
            return await markPaid(order);
        }
    }
    return false;
}

router.post('/', auth, async (req, res) => {
    try {
        const { items } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Cart is empty' });
        }
        const delivery = cleanDelivery(req.body.delivery);
        if (!delivery) {
            return res
                .status(400)
                .json({ message: 'Please enter a valid name, phone number, address and city' });
        }
        const orderItems = [];
        let total = 0;

        for (const item of items) {
            const quantity = Number(item.quantity);
            const product = await Product.findById(item.productId);

            if (!product || !Number.isInteger(quantity) || quantity < 1) {
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
    const orders = await Order.find({ user: req.userId }).sort({ createdAt: -1 });
    res.json(orders);
});

router.post('/:id/pay', auth, async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, user: req.userId });
        const short = await findShortItem(order.items);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        if (order.status === 'paid') {
            return res.status(400).json({ message: 'Order already paid' });
        }
        if (order.status === 'cancelled') {
            return res.status(400).json({ message: 'This order was cancelled' });
        }
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
                callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
                metadata: { orderId: order._id.toString() },
            }),
        });

        if (!data.status) {
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
        const { reference } = req.body;
        if (!reference) {
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
            if (await settleIfPaid(order)) {
                return res.json({ alreadyPaid: true });
            }
            return res.json(order);
        }
        if (order.status === 'cancelled') {
            return res.status(400).json({ message: 'This order was cancelled' });
        }

        const data = await paystackRequest(
            `/transaction/verify/${encodeURIComponent(reference)}`
        );

        const success =
            data.status &&
            data.data.status === 'success' &&
            data.data.amount === Math.round(order.total * 100);

        if (!success) {
            return res.status(400).json({ message: 'Payment not completed' });
        }

        if (!(await markPaid(order))) {
            return res.status(400).json({ message: 'This order was cancelled' });
        }
        res.json(order);
    } catch (err) {
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

        order.status = 'cancelled';
        await order.save();
        res.json(order);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ message: 'Order not found' });
        }
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;