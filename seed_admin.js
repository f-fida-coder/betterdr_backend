
require('dotenv').config({ path: __dirname + '/.env' });
const { Admin } = require('./models');
const { connectDB } = require('./config/database');

const createAdmin = async () => {
    try {
        await connectDB();

        const adminData = {
            username: 'fida',
            email: 'fida@example.com',
            password: 'Fida47',
            role: 'admin',
            status: 'active',
            isSuperAdmin: true,
            unlimitedBalance: true,
        };

        let adminUser = await Admin.findOne({ username: 'fida' });

        if (adminUser) {
            console.log('Root admin fida already exists. Updating credentials and flags...');
            adminUser.password = 'Fida47';
            adminUser.email = adminData.email;
            adminUser.role = adminData.role;
            adminUser.status = adminData.status;
            adminUser.isSuperAdmin = true;
            adminUser.unlimitedBalance = true;
            adminUser.balance = adminData.balance;
            adminUser.pendingBalance = adminData.pendingBalance;
            adminUser.balanceOwed = adminData.balanceOwed;
            adminUser.creditLimit = adminData.creditLimit;
            await adminUser.save();
            console.log('Root admin updated.');
        } else {
            adminUser = new Admin(adminData);
            await adminUser.save();
            console.log('Root admin created:', adminUser.username);
        }
        process.exit(0);
    } catch (error) {
        console.error('Error creating admin:', error);
        process.exit(1);
    }
};

createAdmin();
