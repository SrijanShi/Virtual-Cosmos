const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  socketId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  position: {
    x: { type: Number, default: 400 },
    y: { type: Number, default: 300 },
  },
  connectedTo: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', userSchema);
