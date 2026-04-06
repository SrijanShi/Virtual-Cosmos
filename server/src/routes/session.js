const express = require('express');
const router  = express.Router();
const Session = require('../models/Session');

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// POST /session/create
router.post('/create', async (req, res) => {
  try {
    const { name, hostName, isPrivate, rooms } = req.body;
    if (!name || !hostName || !rooms?.length) {
      return res.status(400).json({ error: 'name, hostName, and rooms are required' });
    }

    // Generate unique code
    let code, exists = true;
    while (exists) {
      code = generateCode();
      exists = await Session.findOne({ code });
    }

    const session = await Session.create({ code, name, hostName, isPrivate, rooms });
    res.json({ code: session.code, name: session.name, rooms: session.rooms, isPrivate: session.isPrivate });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// GET /session/:code
router.get('/:code', async (req, res) => {
  try {
    const session = await Session.findOne({ code: req.params.code.toUpperCase(), isActive: true });
    if (!session) return res.status(404).json({ error: 'Session not found or expired' });
    res.json({ code: session.code, name: session.name, rooms: session.rooms, isPrivate: session.isPrivate });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
