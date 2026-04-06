const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sessionCode: { type: String, required: true },
  roomId:      { type: String, required: true },
  username:    { type: String, required: true },
  text:        { type: String, required: true },
  timestamp:   { type: Date, default: Date.now },
});

messageSchema.index({ sessionCode: 1, roomId: 1, timestamp: 1 });

module.exports = mongoose.model('Message', messageSchema);
