const { connectDB, mongoose } = require('../config/database');
const { User } = require('../models');

const run = async () => {
  try {
    await connectDB();

    const result = await User.updateMany(
      { role: 'user' },
      { $set: { creditLimit: 1000 } }
    );

    console.log('✅ Updated users:', result.modifiedCount ?? result.nModified ?? 0);
  } catch (error) {
    console.error('❌ Update failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();
