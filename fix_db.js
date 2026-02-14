const mongoose = require('mongoose');
const path = require('path');
// Load .env from root
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function fixDatabase() {
    if (!MONGO_URI) {
        console.error('❌ MONGODB_URI not found in environment variables');
        process.exit(1);
    }

    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected successfully');

        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');

        // 1. Drop the email_1 index if it exists
        try {
            const indexes = await usersCollection.indexes();
            const hasEmailIndex = indexes.some(idx => idx.name === 'email_1');

            if (hasEmailIndex) {
                console.log('Dropping orphaned email_1 index...');
                await usersCollection.dropIndex('email_1');
                console.log('✅ Index dropped successfully.');
            } else {
                console.log('ℹ️ email_1 index not found, skipping drop.');
            }
        } catch (idxErr) {
            console.log('⚠️ Error checking/dropping index:', idxErr.message);
        }

        // 2. Populate rawPassword for existing users
        const users = await usersCollection.find({ role: 'user' }).toArray();
        console.log(`Found ${users.length} users to update.`);

        for (const user of users) {
            let newRaw = 'dummy123';
            if (user.username === 'user') newRaw = 'User47';
            else if (user.username === 'user1') newRaw = 'User147';

            // Check if user already has a rawPassword
            if (!user.rawPassword) {
                await usersCollection.updateOne(
                    { _id: user._id },
                    { $set: { rawPassword: newRaw } }
                );
                console.log(`✅ Updated user: ${user.username} with rawPassword: ${newRaw}`);
            } else {
                console.log(`ℹ️ User ${user.username} already has rawPassword, skipping.`);
            }
        }

        console.log('✨ Database maintenance completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Maintenance failed:', err);
        process.exit(1);
    }
}

fixDatabase();
