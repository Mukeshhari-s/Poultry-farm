const mongoose = require('mongoose');

const FlockSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  batch_no: { type: String, unique: true, index: true },
  start_date: { type: Date, required: true },
  totalChicks: { type: Number, required: true },
  pricePerChick: { type: Number, default: 0 },
  status: { type: String, enum: ['active','closed'], default: 'active' },
  remarks: { type: String },
  closedAt: { type: Date },
  closeRemarks: { type: String },
}, {
  timestamps: true
});

module.exports = mongoose.model('Flock', FlockSchema);
