const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

// Environment variables are loaded in server.js or top-level scripts
console.log('🔗 Database initializing...');
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!mongoUri) {
    console.warn('⚠️  MONGODB_URI not found in process.env. Using local fallback.');
}

const finalUri = mongoUri || 'mongodb://localhost:27017/sports_betting';

const connectDB = async () => {
    try {
        await mongoose.connect(finalUri);
        console.log('✅ MongoDB connected successfully');
        console.log(`   URI: ${finalUri.replace(/mongodb\+srv:\/\/.*:.*@/, 'mongodb+srv://***:***@')}`);
        return mongoose.connection;
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        throw error;
    }
};

module.exports = { mongoose, connectDB };
