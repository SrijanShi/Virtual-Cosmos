const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  code:      { type: String, required: true, unique: true, uppercase: true },
  name:      { type: String, required: true },
  hostName:  { type: String, required: true },
  isPrivate: { type: Boolean, default: false },
  password:  { type: String, default: '' }, // only used when isPrivate: true
  rooms:     [{ type: String }],
  isActive:  { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Session', sessionSchema);
