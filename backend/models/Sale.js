const mongoose = require('mongoose');

const SaleSchema = new mongoose.Schema({
  batch_no: { type: String, required: true, index: true },
  date: { type: Date, required: true },
  vehicle_no: { type: String, default: '' },   // optional
  cages: { type: Number, required: true },      // number of cages (int)
  birds: { type: Number, required: true },      // number of birds sold in this record
  total_weight: { type: Number, required: true }, // kg (can be fractional)
  remarks: { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.model('Sale', SaleSchema);
