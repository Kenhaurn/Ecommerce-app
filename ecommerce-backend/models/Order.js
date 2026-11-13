const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        items: [
            {
                product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
                name: String,
                price: { type: Number, min: 0 },
                quantity: { type: Number, min: 1 },
            },
        ],
        total: { type: Number, required: true, min: 0 },
        status: {
            type: String,
            enum: ['pending', 'paid', 'cancelled'],
            default: 'pending',
        },
        reference: String,
        references: [String],
        fulfillment: {
            type: String,
            enum: ['processing', 'shipped', 'delivered'],
            default: 'processing',
        },
        stockIssue: { type: Boolean, default: false },
        paidAfterCancel: { type: Boolean, default: false },
        paidAfterCancelRef: String,
        refunded: { type: Boolean, default: false },
        delivery: {
            name: { type: String, trim: true, maxlength: 100 },
            phone: { type: String, trim: true, maxlength: 20 },
            address: { type: String, trim: true, maxlength: 200 },
            city: { type: String, trim: true, maxlength: 100 },
        },
    },
    { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ reference: 1 });
orderSchema.index({ references: 1 });

orderSchema.set('toJSON', {
    versionKey: false,
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
    },
});

module.exports = mongoose.model('Order', orderSchema);