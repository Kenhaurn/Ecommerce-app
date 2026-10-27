const express = require('express');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const Order = require('../models/Order');

const router = express.Router();
router.use(auth, admin);

function cleanProduct(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const price = Number(body.price);
  const stock = Number(body.stock);
  const description =
    typeof body.description === 'string' ? body.description.trim() : '';

  if (!name || !Number.isFinite(price) || price < 0) return null;
  if (!Number.isInteger(stock) || stock < 0) return null;
  return { name, price, description, stock };
}

router.post('/products', async (req, res) => {
  try {
    const data = cleanProduct(req.body);
    if (!data) {
      return res.status(400).json({ message: 'A name and a valid price are required' });
    }
    const product = await Product.create(data);
    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/products/:id', async (req, res) => {
  try {
    const data = cleanProduct(req.body);
    if (!data) {
      return res.status(400).json({ message: 'A name and a valid price are required' });
    }
    const product = await Product.findByIdAndUpdate(req.params.id, data, {
      returnDocument: 'after',
      runValidators: true,
    });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Product not found' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ message: 'Product deleted' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Product not found' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

const STATUSES = ['pending', 'paid', 'cancelled'];
const FULFILLMENTS = ['processing', 'shipped', 'delivered'];

router.get('/orders', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) {
      if (!STATUSES.includes(req.query.status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      filter.status = req.query.status;
    }
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('user', 'name email');
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/orders/:id/fulfillment', async (req, res) => {
  try {
    const { fulfillment } = req.body;
    if (!FULFILLMENTS.includes(fulfillment)) {
      return res.status(400).json({ message: 'Invalid fulfillment status' });
    }
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.status !== 'paid') {
      return res.status(400).json({ message: 'Only paid orders can be shipped or delivered' });
    }
    order.fulfillment = fulfillment;
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

// Looks for a successful Paystack payment on any reference this order has had.
// It only reports; it never changes the order.
router.post('/orders/:id/check-payment', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    const refs = new Set(order.references);
    if (order.reference) refs.add(order.reference);

    for (const ref of refs) {
      const r = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`,
        { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
      );
      const data = await r.json();
      if (data.status && data.data && data.data.status === 'success') {
        return res.json({ paymentFound: true, reference: ref, amount: data.data.amount / 100 });
      }
    }
    res.json({ paymentFound: false });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Order not found' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;