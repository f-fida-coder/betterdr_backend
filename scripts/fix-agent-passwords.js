const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Agent } = require('../models');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function fixAgentPasswords() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/betterdr');
        console.log('✅ Connected to MongoDB\n');

        // Find all agents without rawPassword
        // Also check if rawPassword is null or empty string
        const agents = await Agent.find({
            $or: [
                { rawPassword: null },
                { rawPassword: '' },
                { rawPassword: { $exists: false } }
            ]
        });

        console.log(`Found ${agents.length} agents without rawPassword\n`);

        if (agents.length === 0) {
            console.log('All agents already have rawPassword set!');
            process.exit(0);
        }

        console.log('Agents needing password sync:');
        agents.forEach((agent, index) => {
            console.log(`${index + 1}. ${agent.username} (${agent.role}) - Phone: ${agent.phoneNumber}`);
        });

        console.log('\n🔄 Syncing passwords to match display logic...');

        for (const agent of agents) {
            // Replicate frontend display logic exactly
            const f3 = (agent.firstName || '').slice(0, 3).toUpperCase();
            const l3 = (agent.lastName || '').slice(0, 3).toUpperCase();
            // Remove non-digits from phone, take last 4
            const cleanPhone = (agent.phoneNumber || '').replace(/\D/g, '');
            const last4 = cleanPhone.slice(-4);

            let newPassword = `${f3}${l3}${last4}`;

            // Fallback if password is empty (e.g. no phone??)
            if (!newPassword || newPassword.length < 4) {
                newPassword = 'TEMP1234';
                console.log(`⚠️  Could not generate formula password for ${agent.username}, using fallback: ${newPassword}`);
            } else {
                console.log(`💡 Generated mimic password for ${agent.username}: ${newPassword}`);
            }

            // Update both hash and raw
            agent.password = newPassword; // Will be hashed by pre-save hook
            agent.rawPassword = newPassword;

            // We need to mark password as modified to trigger pre-save hook
            agent.markModified('password');

            await agent.save();
            console.log(`✅ Fixed ${agent.username} -> Password: ${newPassword}`);
        }

        console.log(`\n✅ Successfully updated ${agents.length} agents!`);
        console.log(`Existing agents can now login with the password displayed in the Admin panel.`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fixAgentPasswords();
