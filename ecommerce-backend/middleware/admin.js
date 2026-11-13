const User = require('../models/User');

module.exports = async function admin(req, res, next) {
    try {
        const user = await User.findById(req.userId).select('role');
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: 'Admins only' });
        }
        next();
    } catch (err) {
        console.error('admin middleware error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
};