const LOOPBACK_IPV4 = '127.0.0.1';
const LOOPBACK_IPV6 = '::1';

const toStr = (value) => (value == null ? '' : String(value).trim());

const normalizeIp = (input) => {
    let value = toStr(input);
    if (!value) return '';

    if (value.includes(',')) {
        value = value.split(',')[0].trim();
    }

    if (value.startsWith('[') && value.includes(']')) {
        value = value.slice(1, value.indexOf(']'));
    }

    value = value.replace(/%[0-9A-Za-z._-]+$/, '');
    value = value.toLowerCase();

    if (value.startsWith('::ffff:')) {
        value = value.slice(7);
    }

    const ipv4WithPort = value.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/);
    if (ipv4WithPort) {
        value = ipv4WithPort[1];
    }

    return value;
};

const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const candidate = forwarded || req.ip || req.socket?.remoteAddress || '';
    return normalizeIp(candidate) || 'unknown';
};

const parseAllowlist = (rawAllowlist) => {
    const set = new Set(
        String(rawAllowlist || '')
            .split(',')
            .map((entry) => normalizeIp(entry))
            .filter(Boolean)
    );

    if (set.has(LOOPBACK_IPV4) || set.has(LOOPBACK_IPV6)) {
        set.add(LOOPBACK_IPV4);
        set.add(LOOPBACK_IPV6);
    }

    return set;
};

const getOwnerModelForRole = (role) => {
    if (role === 'admin') return 'Admin';
    if (role === 'agent' || role === 'master_agent' || role === 'super_agent') return 'Agent';
    return 'User';
};

module.exports = {
    getClientIp,
    getOwnerModelForRole,
    normalizeIp,
    parseAllowlist,
};
