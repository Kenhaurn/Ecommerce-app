const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 100 },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            maxlength: 254,
        },
        password: { type: String, required: true, select: false },
        role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    },
    { timestamps: true }
);

userSchema.set('toJSON', {
    versionKey: false,
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.password;
    },
});

module.exports = mongoose.model('User', userSchema);