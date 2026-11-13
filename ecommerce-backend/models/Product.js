const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 120 },
        price: { type: Number, required: true, min: 0 },
        description: { type: String, trim: true, maxlength: 2000, default: '' },
        stock: {
            type: Number,
            default: 0,
            min: 0,
            validate: {
                validator: Number.isInteger,
                message: 'Stock must be a whole number',
            },
        },
        image: {
            type: String,
            default: '',
            match: [/^(https:\/\/\S+)?$/, 'Image must be an https link'],
        },
        imageId: { type: String, default: '' },
    },
    { timestamps: true }
);

productSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (doc, ret) => {
        delete ret._id;
        delete ret.imageId;
    },
});

module.exports = mongoose.model('Product', productSchema);