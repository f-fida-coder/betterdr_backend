const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { User, Agent, Admin } = require('../models');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('MONGODB_URI is not defined in .env');
    process.exit(1);
}

const generateDummyPhone = (index) => {
    // Generate a simple dummy phone number: +1234567000 + index
    return `+1234567${String(index).padStart(4, '0')}`;
};

const migrate = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const models = [
            { name: 'User', model: User },
            { name: 'Agent', model: Agent },
            { name: 'Admin', model: Admin }
        ];

        let totalUpdated = 0;

        for (const { name, model } of models) {
            const records = await model.find({ $or: [{ phoneNumber: { $exists: false } }, { phoneNumber: '' }] });
            console.log(`Found ${records.length} ${name} records missing phone number`);

            for (let i = 0; i < records.length; i++) {
                const record = records[i];
                // Try to use email if it exists from raw document, otherwise dummy
                const raw = record.toObject();
                let phone = generateDummyPhone(totalUpdated + i + 1);

                // We'll use a unique prefix for each model to avoid collisions if possible
                if (name === 'Agent') phone = `+2234567${String(i + 1).padStart(4, '0')}`;
                if (name === 'Admin') phone = `+3234567${String(i + 1).padStart(4, '0')}`;

                record.phoneNumber = phone;
                await record.save();
                totalUpdated++;
            }
            console.log(`Finished migrating ${name}s`);
        }

        console.log(`Data migration complete. Total records updated: ${totalUpdated}`);
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();
