const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Flock = require('../models/Flock');
const DailyMonitoring = require('../models/DailyMonitoring');

// helper: strip time
function strip(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }

// compute remaining birds for a batch
async function getRemainingBirds(batch_no) {
  const batch = await Flock.findOne({ batch_no });
  if (!batch) throw new Error('batch_not_found');

  // sum mortality from daily monitoring
  const mortAgg = await DailyMonitoring.aggregate([
    { $match: { batch_no } },
    { $group: { _id: null, totalMort: { $sum: '$mortality' } } }
  ]);
  const totalMort = mortAgg[0] ? mortAgg[0].totalMort : 0;

  // sum birds sold
  const soldAgg = await Sale.aggregate([
    { $match: { batch_no } },
    { $group: { _id: null, totalSold: { $sum: '$birds' } } }
  ]);
  const totalSold = soldAgg[0] ? soldAgg[0].totalSold : 0;

  const remaining = (batch.totalChicks || 0) - (totalMort || 0) - (totalSold || 0);
  return { batch, totalMort: totalMort || 0, totalSold: totalSold || 0, remaining: Math.max(0, remaining) };
}

// Create sale
router.post('/', async (req, res) => {
  try {
    const { batch_no, date, vehicle_no = '', cages, birds, total_weight, remarks } = req.body;

    if (!batch_no) return res.status(400).json({ error: 'batch_no is required' });
    if (!date) return res.status(400).json({ error: 'date is required' });
    if (cages == null) return res.status(400).json({ error: 'cages is required' });
    if (birds == null) return res.status(400).json({ error: 'birds is required' });
    if (total_weight == null) return res.status(400).json({ error: 'total_weight is required' });

    const inputDate = strip(date);
    const today = strip(new Date());
    if (inputDate > today) return res.status(400).json({ error: 'date cannot be in the future' });

    // ensure batch exists & is active (or we may allow sales from closed batches depending on requirement)
    const batch = await Flock.findOne({ batch_no });
    if (!batch) return res.status(400).json({ error: 'batch_no not found' });

    // optional: reject sale before batch start_date
    const startDate = strip(batch.start_date);
    if (inputDate < startDate) return res.status(400).json({ error: 'sale date cannot be before batch start_date' });

    // numeric validations
    if (!Number.isFinite(cages) || cages < 0) return res.status(400).json({ error: 'cages must be >= 0' });
    if (!Number.isFinite(birds) || birds <= 0) return res.status(400).json({ error: 'birds must be > 0' });
    if (!Number.isFinite(total_weight) || total_weight <= 0) return res.status(400).json({ error: 'total_weight must be > 0' });

    // compute remaining
    const { remaining } = await getRemainingBirds(batch_no);
    if (birds > remaining) {
      return res.status(400).json({ error: `not enough birds. Remaining: ${remaining}` });
    }

    // create sale record
    const sale = new Sale({
      batch_no, date: inputDate, vehicle_no, cages, birds, total_weight, remarks
    });
    const saved = await sale.save();

    return res.status(201).json({ sale: saved, remaining_after: remaining - birds });
  } catch (err) {
    console.error(err);
    if (err.message === 'batch_not_found') return res.status(400).json({ error: 'batch_no not found' });
    return res.status(500).json({ error: err.message });
  }
});

// List sales (optionally filter by batch_no)
router.get('/', async (req, res) => {
  try {
    const { batch_no } = req.query;
    const q = {};
    if (batch_no) q.batch_no = batch_no;
    const list = await Sale.find(q).sort({ date: -1, createdAt: -1 });
    return res.json(list);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Get remaining summary for a batch
router.get('/remaining/:batch_no', async (req, res) => {
  try {
    const info = await getRemainingBirds(req.params.batch_no);
    return res.json(info);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
