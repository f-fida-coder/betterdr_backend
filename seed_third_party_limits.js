const { ThirdPartyLimit } = require('./models');
const { connectDB } = require('./config/database');
require('dotenv').config();

const seedThirdPartyLimit = async () => {
    try {
        await connectDB();

        const existing = await ThirdPartyLimit.findOne({ provider: 'Demo Provider' });
        if (existing) {
            console.log('Demo Provider already exists.');
            process.exit(0);
        }

        const limit = new ThirdPartyLimit({
            provider: 'Demo Provider',
            dailyLimit: 0,
            monthlyLimit: 0,
            used: 0,
            status: 'active'
        });

        await limit.save();
        console.log('Inserted Demo Provider with 0 limits.');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding third party limit:', error);
        process.exit(1);
    }
};

seedThirdPartyLimit();
