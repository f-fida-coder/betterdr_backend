const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectDB } = require('./config/database');
const rateLimit = require('./middleware/rateLimit');

dotenv.config();
// Fallback to parent directory if .env not found in current (for unified structure)
if (!process.env.MONGODB_URI) {
    dotenv.config({ path: path.join(__dirname, '..', '.env') });
}

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(v => v.trim()).filter(Boolean);
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.length === 0) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

const publicLimiter = rateLimit({ windowMs: 60_000, max: 120 });

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/wallet', require('./routes/walletRoutes'));
app.use('/api/bets', require('./routes/betRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/agent', require('./routes/agentRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/matches', publicLimiter, require('./routes/matchRoutes'));
app.use('/api/debug', require('./routes/debugRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'public')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
        return res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
    next();
});

const http = require('http');
const socketIo = require('./socket');
const startOddsJob = require('./cron/oddsCron');

const server = http.createServer(app);

// Database connection and server start
const startServer = async () => {
    try {
        console.log('\n📦 Starting Sports Betting Backend...\n');

        // Step 1: Connect to MongoDB
        console.log('🔗 Connecting to MongoDB...');
        await connectDB();
        console.log('');

        // Step 2: Initialize Socket.io
        console.log('⚡ Initializing Socket.io...');
        const io = socketIo.init(server);
        console.log('✅ Socket.io initialized.\n');

        // Step 3: Start Background Jobs
        console.log('⏰ Starting background jobs...');
        if (String(process.env.MANUAL_FETCH_MODE || 'false').toLowerCase() === 'true') {
            console.log('🛑 MANUAL_FETCH_MODE enabled. Skipping odds cron job.');
        } else {
            startOddsJob();
            console.log('✅ Cron jobs started.\n');
        }

        // Step 4: Start server
        server.listen(PORT, () => {
            console.log('╔════════════════════════════════════════════╗');
            console.log('║    ✅ SERVER READY FOR CONNECTIONS!        ║');
            console.log(`║    Port: ${PORT}                                ║`);
            console.log('╚════════════════════════════════════════════╝\n');
        });
    } catch (error) {
        console.error('❌ Unable to connect to MongoDB:', error.message);
        console.log('\n📋 Common fixes:');
        console.log('   1. Start MongoDB: mongod (or via MongoDB Compass)');
        console.log('   2. Check .env file for MONGODB_URI');
        console.log('   3. Default URI: mongodb://localhost:27017/sports_betting\n');
        process.exit(1);
    }
};

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // In production, you might want to perform a graceful shutdown
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception thrown:', error);
    // Graceful shutdown is highly recommended for uncaughtException
    process.exit(1);
});

startServer();

