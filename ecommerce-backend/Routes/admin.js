const express = require('express');
const Product = require('../models/Product');
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const uploadImage = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');

const router = express.Router();

router.use(auth, admin);

function cleanProduct(body, { withStock = true } = {}) {
  const b = body || {};
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const description = typeof b.description === 'string' ? b.description.trim() : '';
  const priceText = String(b.price ?? '').trim();
  const price = Number(priceText);

  if (!name || name.length > 120) return null;
  if (description.length > 2000) return null;
  if (!priceText || !Number.isFinite(price) || price < 0) return null;

  const result = { name, price, description };

  if (withStock) {
    const stockText = String(b.stock ?? '').trim();
    const stock = Number(stockText);
    if (!stockText || !Number.isInteger(stock) || stock < 0) return null;
    result.stock = stock;
  }

  return result;
}

function sendError(res, err, notFoundMessage) {
  if (err.name === 'CastError' && notFoundMessage) {
    return res.status(404).json({ message: notFoundMessage });
  }
  if (err.name === 'ValidationError') {
    const first = Object.values(err.errors)[0];
    return res.status(400).json({ message: first ? first.message : 'Invalid data' });
  }
  console.error(err);
  res.status(500).json({ message: 'Server error' });
}

function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'my-store/products',
        transformation: [{ width: 900, height: 900, crop: 'limit', quality: 'auto' }],
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

async function removeFromCloudinary(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Could not delete image from Cloudinary:', err.message);
  }
}

const PRODUCT_ERROR =
  'A name, a valid price and a whole-number stock are required';

/* ---------- Products ---------- */

router.post('/products', uploadImage, async (req, res) => {
  let uploaded = null;
  try {
    const data = cleanProduct(req.body);
    if (!data) {
      return res.status(400).json({ message: PRODUCT_ERROR });
    }

    if (req.file) {
      try {
        uploaded = await uploadToCloudinary(req.file.buffer);
      } catch (err) {
        console.error(err);
        return res.status(502).json({ message: 'Image upload failed. Please try again.' });
      }
      data.image = uploaded.secure_url;
      data.imageId = uploaded.public_id;
    }

    const product = await Product.create(data);
    res.status(201).json(product);
  } catch (err) {
    if (uploaded) await removeFromCloudinary(uploaded.public_id);
    sendError(res, err);
  }
});

router.put('/products/:id', uploadImage, async (req, res) => {
  let uploaded = null;
  try {
    const data = cleanProduct(req.body, { withStock: false });
    if (!data) {
      return res.status(400).json({ message: PRODUCT_ERROR });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const oldImageId = product.imageId;
    let replaceImage = false;

    if (req.file) {
      try {
        uploaded = await uploadToCloudinary(req.file.buffer);
      } catch (err) {
        console.error(err);
        return res.status(502).json({ message: 'Image upload failed. Please try again.' });
      }
      data.image = uploaded.secure_url;
      data.imageId = uploaded.public_id;
      replaceImage = true;
    } else if (req.body && req.body.removeImage === 'true') {
      data.image = '';
      data.imageId = '';
      replaceImage = true;
    }

    Object.assign(product, data);
    await product.save();

    // Only now that the save worked is the old image safe to delete.
    if (replaceImage && oldImageId) await removeFromCloudinary(oldImageId);

    res.json(product);
  } catch (err) {
    if (uploaded) await removeFromCloudinary(uploaded.public_id);
    sendError(res, err, 'Product not found');
  }
});

router.delete('/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    if (product.imageId) await removeFromCloudinary(product.imageId);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    sendError(res, err, 'Product not found');
  }
});

/* ---------- Orders ---------- */

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
    sendError(res, err);
  }
});

router.put('/orders/:id/fulfillment', async (req, res) => {
  try {
    const { fulfillment } = req.body || {};
    if (!FULFILLMENTS.includes(fulfillment)) {
      return res.status(400).json({ message: 'Invalid fulfillment status' });
    }

    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, status: 'paid' },
      { fulfillment },
      { returnDocument: 'after', runValidators: true }
    );

    if (!order) {
      const exists = await Order.exists({ _id: req.params.id });
      if (!exists) {
        return res.status(404).json({ message: 'Order not found' });
      }
      return res
        .status(400)
        .json({ message: 'Only paid orders can be shipped or delivered' });
    }
    res.json(order);
  } catch (err) {
    sendError(res, err, 'Order not found');
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
        {
          headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
          signal: AbortSignal.timeout(15000),
        }
      );
      const data = await r.json();
      if (data.status && data.data && data.data.status === 'success') {
        if (order.status === 'cancelled') {
          await Order.updateOne(
            { _id: order._id },
            { paidAfterCancel: true, paidAfterCancelRef: ref }
          );
        }
        return res.json({
          paymentFound: true,
          reference: ref,
          amount: data.data.amount / 100,
          matchesTotal: data.data.amount === Math.round(order.total * 100),
          orderStatus: order.status,
        });
      }
    }
    res.json({ paymentFound: false, orderStatus: order.status });
  } catch (err) {
    sendError(res, err, 'Order not found');
  }
});

router.put('/orders/:id/mark-refunded', async (req, res) => {
  try {
    const result = await Order.updateOne(
      { _id: req.params.id, paidAfterCancel: true },
      { paidAfterCancel: false, refunded: true }
    );
    if (result.matchedCount === 0) {
      return res.status(400).json({ message: 'This order has no unrefunded payment flag.' });
    }
    res.json({ message: 'Marked as refunded.' });
  } catch (err) {
    sendError(res, err, 'Order not found');
  }
});

router.put('/products/:id/stock', async (req, res) => {
  try {
    const change = Number(req.body.change);
    if (!Number.isInteger(change) || change === 0 || Math.abs(change) > 100000) {
      return res.status(400).json({ message: 'Enter a whole number other than 0.' });
    }

    // Removing stock only matches if there is enough to remove, so it can never go below 0
    const filter = { _id: req.params.id };
    if (change < 0) filter.stock = { $gte: -change };

    const product = await Product.findOneAndUpdate(
      filter,
      { $inc: { stock: change } },
      { returnDocument: 'after' }
    );

    if (!product) {
      const exists = await Product.exists({ _id: req.params.id });
      if (!exists) return res.status(404).json({ message: 'Product not found' });
      return res.status(400).json({ message: 'You cannot remove more than the current stock.' });
    }

    res.json(product);
  } catch (err) {
    sendError(res, err, 'Product not found');
  }
});

module.exports = router;