// models/Feed.js
const mongoose = require('mongoose');

const FeedSchema = new mongoose.Schema({
  type: { type: String, required: true },
  date: { type: Date, required: true },
  bagsIn: { type: Number, default: 0 },
  kgIn: { type: Number, default: 0 },
  kgOut: { type: Number, default: 0 },
  flockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Flock' }
});

module.exports = mongoose.model('Feed', FeedSchema);
