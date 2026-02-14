const mongoose = require('mongoose');
const { User } = require('./models');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/betterdr';

async function migratePasswords() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const users = await User.find({ role: 'user' });
        console.log(`Found ${users.length} users to update.`);

        for (const user of users) {
            let newRaw = 'dummy123';
            if (user.username === 'user') newRaw = 'User47';
            else if (user.username === 'user1') newRaw = 'User147';

            user.rawPassword = newRaw;
            // Use updateOne to avoid pre-save hooks that hash the password again (just in case)
            await User.updateOne({ _id: user._id }, { $set: { rawPassword: newRaw } });
            console.log(`Updated user: ${user.username} with rawPassword: ${newRaw}`);
        }

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migratePasswords();
