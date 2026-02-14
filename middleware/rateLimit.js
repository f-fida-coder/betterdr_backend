const buckets = new Map();

const rateLimit = ({ windowMs = 60_000, max = 60 } = {}) => (req, res, next) => {
    const key = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();

    const entry = buckets.get(key) || { count: 0, start: now };
    if (now - entry.start > windowMs) {
        entry.count = 0;
        entry.start = now;
    }

    entry.count += 1;
    buckets.set(key, entry);

    if (entry.count > max) {
        return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }

    next();
};

module.exports = rateLimit;
