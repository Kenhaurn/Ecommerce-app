require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

const sampleProducts = [
    { name: 'Wireless Earbuds', price: 15000, description: 'Bluetooth earbuds with a charging case and 20 hours of battery life.' },
    { name: 'Phone Case', price: 3500, description: 'Shockproof case with a slim, grippy finish.' },
    { name: 'Power Bank', price: 12000, description: '10,000mAh power bank that charges two devices at once.' },
];

async function seed() {
    await mongoose.connect(process.env.MONGO_URI);
    await Product.deleteMany({});
    await Product.insertMany(sampleProducts);
    console.log('Database seeded');
    await mongoose.disconnect();
}

seed().catch(err => {
    console.error(err.message);
    process.exit(1);
});