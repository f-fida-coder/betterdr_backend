/**
 * Database Verification Script
 * 
 * Check:
 * - Database connection
 * - All tables exist
 * - Table schemas
 * - Row counts
 * - Relationships
 */

require('dotenv').config();
const sequelize = require('../config/database');
const db = require('../models');

async function verifyDatabase() {
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║          DATABASE VERIFICATION REPORT                  ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    try {
        // Step 1: Check Connection
        console.log('🔗 Checking database connection...');
        await sequelize.authenticate();
        console.log('✅ Database connection: ACTIVE\n');

        // Step 2: List all tables
        console.log('📊 Tables in database:');
        const [tables] = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);
        
        if (tables.length === 0) {
            console.log('❌ No tables found!\n');
        } else {
            tables.forEach((t, i) => {
                console.log(`   ${i + 1}. ${t.table_name}`);
            });
            console.log();
        }

        // Step 3: Check each model
        console.log('📋 Model Information:\n');
        
        const models = [
            { name: 'Users', model: db.User },
            { name: 'Matches', model: db.Match },
            { name: 'Bets', model: db.Bet },
            { name: 'Transactions', model: db.Transaction }
        ];

        for (const { name, model } of models) {
            console.log(`${name}:`);
            
            try {
                // Get columns
                const [columns] = await sequelize.query(`
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = '${name}'
                    ORDER BY ordinal_position;
                `);

                if (columns.length > 0) {
                    console.log(`   ✅ Table exists with ${columns.length} columns:`);
                    columns.forEach(col => {
                        console.log(`      • ${col.column_name} (${col.data_type})`);
                    });
                } else {
                    console.log(`   ❌ Table does not exist`);
                }

                // Get row count
                const count = await model.count();
                console.log(`   📈 Row count: ${count}\n`);
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}\n`);
            }
        }

        // Step 4: Check relationships
        console.log('🔗 Relationships:\n');
        try {
            // Sample relationship test
            const user = await db.User.findOne();
            if (user) {
                console.log(`   ✅ User model works`);
                const bets = await user.getBets();
                console.log(`   ✅ User.getBets() works (found ${bets.length} bets)`);
            } else {
                console.log(`   ℹ️  No users in database to test relationships`);
            }
        } catch (error) {
            console.log(`   ⚠️  Could not test relationships: ${error.message}`);
        }

        console.log('\n╔═══════════════════════════════════════════════════════╗');
        console.log('║            ✅ VERIFICATION COMPLETE                    ║');
        console.log('╚═══════════════════════════════════════════════════════╝\n');

    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        console.log('\n📋 Troubleshooting:');
        console.log('   1. Is PostgreSQL running? brew services start postgresql');
        console.log('   2. Check .env configuration');
        console.log('   3. Run setup: npm run setup-db\n');
    } finally {
        await sequelize.close();
    }
}

verifyDatabase();
