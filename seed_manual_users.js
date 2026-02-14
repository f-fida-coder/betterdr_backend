const { User } = require('./models');
const bcrypt = require('bcrypt');
const { connectDB, mongoose } = require('./config/database');
require('dotenv').config();

const seedAdmin = async () => {
    try {
        await connectDB();
        console.log('Database connected...');

        // Check if admin exists
        const adminExists = await User.findOne({ role: 'admin' });

        if (adminExists) {
            console.log('Admin already exists:', adminExists.username);
            console.log('Password is likely "admin123" if you haven\'t changed it.');
        } else {
            const admin = new User({
                username: 'admin',
                email: 'admin@example.com',
                password: 'admin123',
                role: 'admin',
                status: 'active',
                balance: 1000000
            });
            await admin.save();
            console.log('Admin created successfully.');
            console.log('Username: admin');
            console.log('Password: admin123');
        }
        process.exit(0);
    } catch (error) {
        console.error('Error seeding admin:', error);
        process.exit(1);
    }
};

seedAdmin();
