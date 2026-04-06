const express = require('express');
const router  = express.Router();
const Session = require('../models/Session');
const Message = require('../models/Message');

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// POST /session/create
router.post('/create', async (req, res) => {
  try {
    const { name, hostName, isPrivate, password, rooms } = req.body;
    if (!name || !hostName || !rooms?.length)
      return res.status(400).json({ error: 'name, hostName, and rooms are required' });
    if (isPrivate && !password?.trim())
      return res.status(400).json({ error: 'Password is required for private sessions' });

    let code, exists = true;
    while (exists) { code = generateCode(); exists = await Session.findOne({ code }); }

    const session = await Session.create({
      code, name, hostName, isPrivate,
      password: isPrivate ? password.trim() : '',
      rooms,
    });
    res.json({ code: session.code, name: session.name, rooms: session.rooms, isPrivate: session.isPrivate });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// GET /session/:code — metadata only; rooms withheld for private sessions until verified
router.get('/:code', async (req, res) => {
  try {
    const session = await Session.findOne({ code: req.params.code.toUpperCase(), isActive: true });
    if (!session) return res.status(404).json({ error: 'Session not found or expired' });
    if (session.isPrivate)
      return res.json({ code: session.code, name: session.name, isPrivate: true, rooms: null });
    res.json({ code: session.code, name: session.name, isPrivate: false, rooms: session.rooms });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /session/:code/verify — validate password for private session, returns rooms
router.post('/:code/verify', async (req, res) => {
  try {
    const session = await Session.findOne({ code: req.params.code.toUpperCase(), isActive: true });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!session.isPrivate)
      return res.json({ ok: true, code: session.code, name: session.name, rooms: session.rooms });
    if (session.password !== req.body.password?.trim())
      return res.status(401).json({ error: 'Incorrect password' });
    res.json({ ok: true, code: session.code, name: session.name, rooms: session.rooms });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /session/:code/history?username=X — message history for a returning user
router.get('/:code/history', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'username required' });
    const sessionCode = req.params.code.toUpperCase();

    const session = await Session.findOne({ code: sessionCode, isActive: true });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Find all roomIds this username participated in
    const userRooms = await Message.distinct('roomId', { sessionCode, username });
    if (!userRooms.length) return res.json({ history: {} });

    const messages = await Message.find({ sessionCode, roomId: { $in: userRooms } })
      .sort({ timestamp: 1 }).limit(500).lean();

    // Group by roomId
    const history = {};
    for (const msg of messages) {
      if (!history[msg.roomId]) history[msg.roomId] = [];
      history[msg.roomId].push({
        username:  msg.username,
        text:      msg.text,
        timestamp: new Date(msg.timestamp).getTime(),
      });
    }
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
