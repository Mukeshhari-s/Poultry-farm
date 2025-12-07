const mongoose = require('mongoose');

const SaleSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  batch_no: { type: String, required: true, index: true },
  date: { type: Date, required: true },
  vehicle_no: { type: String, default: '' },   // optional
  cages: { type: Number, required: true },      // number of cages (int)
  birds: { type: Number, required: true },      // number of birds sold in this record
  empty_weight: { type: Number, default: 0 },     // vehicle empty weight in kg
  load_weight: { type: Number, default: 0 },      // vehicle loaded weight in kg
  total_weight: { type: Number, required: true }, // kg (can be fractional)
  remarks: { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.model('Sale', SaleSchema);
