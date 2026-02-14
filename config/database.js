const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

// Fallback to parent directory if .env not found in current (for unified structure)
if (!process.env.MONGODB_URI) {
    const path = require('path');
    dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
}

console.log('Loaded MONGODB_URI:', process.env.MONGODB_URI ? 'FOUND' : 'NOT FOUND');
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/sports_betting';

const connectDB = async () => {
    try {
        await mongoose.connect(mongoUri);
        console.log('✅ MongoDB connected successfully');
        console.log(`   URI: ${mongoUri.replace(/mongodb\+srv:\/\/.*:.*@/, 'mongodb+srv://***:***@')}`);
        return mongoose.connection;
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        throw error;
    }
};

module.exports = { mongoose, connectDB };
