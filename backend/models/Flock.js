const mongoose = require('mongoose');

const FlockSchema = new mongoose.Schema({
  name: { type: String, required: true },
  batchNumber: { type: String, required: true },
  breed: String,
  startDate: { type: Date, default: Date.now },
  totalChicks: { type: Number, default: 0 },
  status: { type: String, enum: ['active','sold','culled'], default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Flock', FlockSchema);
