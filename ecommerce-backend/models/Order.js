const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        items: [
            {
                product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
                name: String,
                price: Number,
                quantity: Number,
            },
        ],
        total: { type: Number, required: true },
        status: { type: String, default: 'pending' },
        reference: String,
        references: [String],
        fulfillment: { type: String, enum: ['processing', 'shipped', 'delivered'], default: 'processing' },
        stockIssue: { type: Boolean, default: false },
        delivery: {
            name: String,
            phone: String,
            address: String,
            city: String,
        },
    },
    { timestamps: true }
);

orderSchema.set('toJSON', {
    versionKey: false,
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
    },
});

module.exports = mongoose.model('Order', orderSchema);