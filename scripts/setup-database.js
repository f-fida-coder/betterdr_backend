/**
 * Database Setup and Initialization Script
 * 
 * This script:
 * 1. Checks if PostgreSQL is running
 * 2. Creates the sports_betting database if it doesn't exist
 * 3. Syncs all Sequelize models to create tables
 * 4. Verifies all tables were created successfully
 * 5. Provides detailed logging of the entire process
 */

require('dotenv').config();
const { Client } = require('pg');
const sequelize = require('../config/database');
const db = require('../models');

const DB_NAME = process.env.DB_NAME || 'sports_betting';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_HOST = process.env.DB_HOST || 'localhost';

const TABLES_TO_CREATE = ['Users', 'Matches', 'Bets', 'Transactions'];

async function createDatabaseIfNotExists() {
    console.log('\n📦 STEP 1: Checking if database exists...');
    
    const adminClient = new Client({
        user: DB_USER,
        password: DB_PASSWORD,
        host: DB_HOST,
        port: 5432,
        database: 'postgres', // Connect to default postgres database
    });

    try {
        await adminClient.connect();
        console.log('✅ Connected to PostgreSQL server');

        // Check if database exists
        const result = await adminClient.query(
            `SELECT datname FROM pg_database WHERE datname = '${DB_NAME}';`
        );

        if (result.rows.length > 0) {
            console.log(`✅ Database '${DB_NAME}' already exists`);
        } else {
            console.log(`⚠️  Database '${DB_NAME}' not found. Creating...`);
            await adminClient.query(`CREATE DATABASE "${DB_NAME}";`);
            console.log(`✅ Database '${DB_NAME}' created successfully`);
        }
    } catch (error) {
        console.error('❌ Error creating database:', error.message);
        throw error;
    } finally {
        await adminClient.end();
    }
}

async function syncModels() {
    console.log('\n📋 STEP 2: Syncing Sequelize models...');
    
    try {
        // Test connection
        await sequelize.authenticate();
        console.log('✅ Connected to sports_betting database');

        // Sync all models (this creates/updates tables)
        console.log('⏳ Synchronizing models...');
        await sequelize.sync({ alter: true });
        console.log('✅ All models synced successfully');
    } catch (error) {
        console.error('❌ Error syncing models:', error.message);
        throw error;
    }
}

async function verifyTables() {
    console.log('\n🔍 STEP 3: Verifying tables were created...');
    
    try {
        const result = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        `);

        const tables = result[0].map(row => row.table_name);
        
        if (tables.length === 0) {
            console.warn('⚠️  No tables found in database');
            return false;
        }

        console.log(`✅ Found ${tables.length} table(s):`);
        tables.forEach(table => {
            const status = TABLES_TO_CREATE.some(t => t.toLowerCase() === table.toLowerCase()) 
                ? '✅' 
                : 'ℹ️ ';
            console.log(`   ${status} ${table}`);
        });

        // Check for required tables
        const requiredTables = ['Users', 'Matches', 'Bets', 'Transactions'];
        const missingTables = requiredTables.filter(required => 
            !tables.some(t => t.toLowerCase() === required.toLowerCase())
        );

        if (missingTables.length > 0) {
            console.warn(`\n⚠️  Missing tables: ${missingTables.join(', ')}`);
            return false;
        }

        console.log('\n✅ All required tables present');
        return true;
    } catch (error) {
        console.error('❌ Error verifying tables:', error.message);
        throw error;
    }
}

async function getTableDetails() {
    console.log('\n📊 STEP 4: Table Details...');
    
    try {
        const tables = ['Users', 'Matches', 'Bets', 'Transactions'];
        
        for (const table of tables) {
            try {
                const result = await sequelize.query(`
                    SELECT 
                        column_name, 
                        data_type, 
                        is_nullable,
                        column_default
                    FROM information_schema.columns 
                    WHERE table_name = '${table}'
                    ORDER BY ordinal_position;
                `);

                if (result[0].length > 0) {
                    console.log(`\n📋 ${table} columns:`);
                    result[0].forEach(col => {
                        const nullable = col.is_nullable === 'YES' ? '(nullable)' : '(not null)';
                        console.log(`   • ${col.column_name}: ${col.data_type} ${nullable}`);
                    });
                }
            } catch (err) {
                console.warn(`   ⚠️  Could not get column details for ${table}`);
            }
        }
    } catch (error) {
        console.error('❌ Error getting table details:', error.message);
    }
}

async function getRowCounts() {
    console.log('\n📈 STEP 5: Row Counts...');
    
    try {
        const tables = ['Users', 'Matches', 'Bets', 'Transactions'];
        
        for (const table of tables) {
            try {
                const result = await sequelize.query(`SELECT COUNT(*) FROM "${table}";`);
                const count = result[0][0].count;
                const status = count > 0 ? '✅' : '🔵';
                console.log(`   ${status} ${table}: ${count} row(s)`);
            } catch (err) {
                console.warn(`   ⚠️  Could not count ${table}`);
            }
        }
    } catch (error) {
        console.error('❌ Error getting row counts:', error.message);
    }
}

async function testConnections() {
    console.log('\n🔗 STEP 6: Testing API Endpoints...');
    
    try {
        // Test basic model access
        const userCount = await db.User.count();
        console.log(`✅ User model accessible - ${userCount} users in database`);

        const matchCount = await db.Match.count();
        console.log(`✅ Match model accessible - ${matchCount} matches in database`);

        const betCount = await db.Bet.count();
        console.log(`✅ Bet model accessible - ${betCount} bets in database`);

        const transactionCount = await db.Transaction.count();
        console.log(`✅ Transaction model accessible - ${transactionCount} transactions in database`);
    } catch (error) {
        console.error('❌ Error testing models:', error.message);
    }
}

async function runSetup() {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║       Sports Betting Database Setup & Verification      ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    
    console.log(`\n🔧 Configuration:`);
    console.log(`   Host: ${DB_HOST}`);
    console.log(`   Database: ${DB_NAME}`);
    console.log(`   User: ${DB_USER}`);

    try {
        await createDatabaseIfNotExists();
        await syncModels();
        const tablesVerified = await verifyTables();
        await getTableDetails();
        await getRowCounts();
        await testConnections();

        console.log('\n╔════════════════════════════════════════════════════════╗');
        if (tablesVerified) {
            console.log('║            ✅ DATABASE SETUP SUCCESSFUL!               ║');
        } else {
            console.log('║         ⚠️  DATABASE SETUP COMPLETED WITH ISSUES        ║');
        }
        console.log('╚════════════════════════════════════════════════════════╝\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Setup failed:', error.message);
        console.log('\n📋 Troubleshooting:');
        console.log('   1. Ensure PostgreSQL is running: brew services start postgresql');
        console.log('   2. Check .env file has correct DB_HOST, DB_USER, DB_PASSWORD');
        console.log('   3. Verify user "postgres" exists: psql -U postgres -c "SELECT 1"');
        console.log('   4. Create postgres user if needed: createuser postgres -s\n');
        
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

// Run setup
runSetup();
