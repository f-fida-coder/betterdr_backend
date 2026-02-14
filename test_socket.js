const io = require('socket.io-client');

const socket = io('http://localhost:5000');

console.log('--- Client connecting to socket ---');

socket.on('connect', () => {
    console.log('Connected! ID:', socket.id);
});

socket.on('matchUpdate', (data) => {
    console.log('Received matchUpdate:', data.id, data.homeTeam, 'vs', data.awayTeam, 'Score:', data.score);
    // We can exit after receiving one update to prove it works
    // process.exit(0);
});

socket.on('disconnect', () => {
    console.log('Disconnected');
});

// Keep alive for a bit to wait for cron
setTimeout(() => {
    console.log('Test finished waiting.');
    process.exit(0);
}, 70000); // Wait > 60s for cron
