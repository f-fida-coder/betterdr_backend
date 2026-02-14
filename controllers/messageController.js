const { Message } = require('../models');

exports.createMessage = async (req, res) => {
    try {
        const { subject, body } = req.body;
        if (!body || !body.trim()) {
            return res.status(400).json({ message: 'Message body is required' });
        }
        const trimmedBody = body.trim();
        const trimmedSubject = (subject && subject.trim())
            ? subject.trim()
            : trimmedBody.split(' ').slice(0, 6).join(' ');

        const message = await Message.create({
            fromUserId: req.user?._id || null,
            fromName: req.user?.username || 'User',
            subject: trimmedSubject,
            body: trimmedBody,
            read: false,
            status: 'open'
        });

        res.status(201).json(message);
    } catch (error) {
        console.error('Error creating message:', error);
        res.status(500).json({ message: 'Server error creating message' });
    }
};

exports.getMyMessages = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: 'Not authorized' });
        }
        const messages = await Message.find({ fromUserId: userId }).sort({ createdAt: -1 });
        res.json(messages);
    } catch (error) {
        console.error('Error fetching user messages:', error);
        res.status(500).json({ message: 'Server error fetching messages' });
    }
};
