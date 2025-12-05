// models/Feed.js
const mongoose = require('mongoose');

const FeedSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true },
  typeKey: { type: String, index: true },
  date: { type: Date, required: true },
  bagsIn: { type: Number, default: 0 },
  bagsOut: { type: Number, default: 0 },
  kgPerBag: { type: Number, default: 0 },
  kgIn: { type: Number, default: 0 },
  kgOut: { type: Number, default: 0 },
  dailyRecord: { type: mongoose.Schema.Types.ObjectId, ref: 'DailyMonitoring', index: true },
  flockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Flock' },
  batch_no: { type: String, index: true }
});

module.exports = mongoose.model('Feed', FeedSchema);
