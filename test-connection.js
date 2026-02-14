const path = require('path');
const dotenv = require('dotenv');

console.log('--- Environment Loading Test ---');
console.log('Current __dirname:', __dirname);
console.log('Trying to load .env from current dir...');
dotenv.config();
console.log('MONGODB_URI in process.env (1):', process.env.MONGODB_URI ? 'FOUND' : 'NOT FOUND');

if (!process.env.MONGODB_URI) {
    console.log('Falling back to root .env...');
    const rootEnvPath = path.join(__dirname, '..', '.env');
    console.log('Root env path:', rootEnvPath);
    dotenv.config({ path: rootEnvPath });
}
console.log('MONGODB_URI in process.env (final):', process.env.MONGODB_URI ? 'FOUND' : 'NOT FOUND');

const mongoose = require('mongoose');
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sports_betting';

async function test() {
    console.log('\n--- Connection Test ---');
    console.log('URI:', mongoUri.replace(/:.*@/, ':***@'));
    try {
        await mongoose.connect(mongoUri);
        console.log('✅ Connected successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
        process.exit(1);
    }
}

test();
