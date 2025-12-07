const mongoose = require('mongoose');

const MedicineSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  batch_no: {
    type: String,
    required: true
  },

  date: {
    type: Date,           // DATEONLY → Date
    required: true
  },

  medicine_name: {
    type: String,
    required: true
  },

  quantity: {
    type: Number,         // FLOAT → Number
    required: true
  },

  dose: {
    type: String,
    required: true
  },

  unitPrice: {
    type: Number,
    default: 0
  },

  totalCost: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true       // adds createdAt + updatedAt
});

module.exports = mongoose.model('Medicine', MedicineSchema);
