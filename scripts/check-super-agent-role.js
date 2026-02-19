const mongoose = require('mongoose');
const { Agent } = require('../models');

async function checkSuperAgentRole() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/betterdr');
        console.log('Connected to MongoDB\n');

        // Find NGJ247MA
        const agent = await Agent.findOne({ username: /^NGJ247MA$/i });

        if (!agent) {
            console.log('❌ Agent NGJ247MA not found');
            process.exit(0);
        }

        console.log('✅ Found agent NGJ247MA');
        console.log('   Username:', agent.username);
        console.log('   Role:', agent.role);
        console.log('   Created By:', agent.createdBy);
        console.log('   Created By Model:', agent.createdByModel);
        console.log('   Status:', agent.status);

        // Check all agents with super_agent role
        const superAgents = await Agent.find({ role: 'super_agent' });
        console.log(`\n📊 Found ${superAgents.length} agent(s) with role 'super_agent'`);

        // Check all agents with master_agent role
        const masterAgents = await Agent.find({ role: 'master_agent' });
        console.log(`📊 Found ${masterAgents.length} agent(s) with role 'master_agent'`);

        if (masterAgents.length > 0) {
            console.log('\nMaster Agents:');
            masterAgents.forEach(a => {
                console.log(`  - ${a.username} (${a.role})`);
            });
        }

        if (superAgents.length > 0) {
            console.log('\nSuper Agents:');
            superAgents.forEach(a => {
                console.log(`  - ${a.username} (${a.role})`);
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkSuperAgentRole();
