const mongoose = require('mongoose');

const DailyMonitoringSchema = new mongoose.Schema({
  batch_no: { type: String, required: true, index: true },
  date: { type: Date, required: true },
  age: { type: Number, required: true },            // 0 .. 55
  mortality: { type: Number, default: 0 },          // integer >= 0
  feedBags: { type: Number, default: 0 },           // bags (can be fractional)
  feedKg: { type: Number, default: 0 },             // kg (can be fractional)
  avgWeight: { type: Number, default: 0 },          // average weight per bird
  remarks: { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.model('DailyMonitoring', DailyMonitoringSchema);
