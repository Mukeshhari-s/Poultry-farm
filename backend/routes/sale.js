const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Flock = require('../models/Flock');
const DailyMonitoring = require('../models/DailyMonitoring');

// helper: strip time
function strip(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }

function roundWeight(value) {
  return Math.round(value * 1000) / 1000;
}

// compute remaining birds for a batch
async function getRemainingBirds(batch_no, ownerId) {
  const batch = await Flock.findOne({ batch_no, owner: ownerId });
  if (!batch) throw new Error('batch_not_found');

  // sum mortality from daily monitoring
  const mortAgg = await DailyMonitoring.aggregate([
    { $match: { batch_no, owner: ownerId } },
    { $group: { _id: null, totalMort: { $sum: '$mortality' } } }
  ]);
  const totalMort = mortAgg[0] ? mortAgg[0].totalMort : 0;

  // sum birds sold
  const soldAgg = await Sale.aggregate([
    { $match: { batch_no, owner: ownerId } },
    { $group: { _id: null, totalSold: { $sum: '$birds' } } }
  ]);
  const totalSold = soldAgg[0] ? soldAgg[0].totalSold : 0;

  const remaining = (batch.totalChicks || 0) - (totalMort || 0) - (totalSold || 0);
  return { batch, totalMort: totalMort || 0, totalSold: totalSold || 0, remaining: Math.max(0, remaining) };
}

// Create sale
router.post('/', async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { batch_no, date, vehicle_no = '', cages, birds, remarks, empty_weight, load_weight } = req.body;

    if (!batch_no) return res.status(400).json({ error: 'batch_no is required' });
    if (!date) return res.status(400).json({ error: 'date is required' });
    if (cages == null) return res.status(400).json({ error: 'cages is required' });
    if (birds == null) return res.status(400).json({ error: 'birds is required' });
    if (empty_weight == null) return res.status(400).json({ error: 'empty_weight is required' });
    if (load_weight == null) return res.status(400).json({ error: 'load_weight is required' });

    const inputDate = strip(date);
    const today = strip(new Date());
    if (inputDate > today) return res.status(400).json({ error: 'date cannot be in the future' });

    // ensure batch exists & is active (or we may allow sales from closed batches depending on requirement)
    const batch = await Flock.findOne({ batch_no, owner: ownerId });
    if (!batch) return res.status(400).json({ error: 'batch_no not found' });

    // optional: reject sale before batch start_date
    const startDate = strip(batch.start_date);
    if (inputDate < startDate) return res.status(400).json({ error: 'sale date cannot be before batch start_date' });

    // numeric validations
    if (!Number.isFinite(cages) || cages < 0) return res.status(400).json({ error: 'cages must be >= 0' });
    if (!Number.isFinite(birds) || birds <= 0) return res.status(400).json({ error: 'birds must be > 0' });
    const emptyWeightValue = Number(empty_weight);
    const loadWeightValue = Number(load_weight);
    if (!Number.isFinite(emptyWeightValue) || emptyWeightValue < 0) return res.status(400).json({ error: 'empty_weight must be >= 0' });
    if (!Number.isFinite(loadWeightValue) || loadWeightValue <= 0) return res.status(400).json({ error: 'load_weight must be > 0' });
    const computedTotal = roundWeight(loadWeightValue - emptyWeightValue);
    if (computedTotal <= 0) return res.status(400).json({ error: 'load_weight must be greater than empty_weight' });

    // compute remaining
    const { remaining } = await getRemainingBirds(batch_no, ownerId);
    if (birds > remaining) {
      return res.status(400).json({ error: `not enough birds. Remaining: ${remaining}` });
    }

    // create sale record
    const sale = new Sale({
      owner: ownerId,
      batch_no,
      date: inputDate,
      vehicle_no,
      cages,
      birds,
      empty_weight: emptyWeightValue,
      load_weight: loadWeightValue,
      total_weight: computedTotal,
      remarks
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
    const ownerId = req.user._id;
    const { batch_no } = req.query;
    const q = { owner: ownerId };
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
    const info = await getRemainingBirds(req.params.batch_no, req.user._id);
    return res.json(info);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Update sale entry
router.patch('/:id', async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { id } = req.params;
    const { date, vehicle_no, cages, birds, total_weight, remarks, empty_weight, load_weight } = req.body || {};

    const sale = await Sale.findOne({ _id: id, owner: ownerId });
    if (!sale) return res.status(404).json({ error: 'Sale entry not found' });

    if (date !== undefined) {
      if (!date) return res.status(400).json({ error: 'date is required' });
      const parsed = strip(date);
      const today = strip(new Date());
      if (parsed > today) return res.status(400).json({ error: 'date cannot be in the future' });
      const batch = await Flock.findOne({ batch_no: sale.batch_no, owner: ownerId });
      if (!batch) return res.status(400).json({ error: 'batch_no not found' });
      if (parsed < strip(batch.start_date)) return res.status(400).json({ error: 'sale date cannot be before batch start_date' });
      sale.date = parsed;
    }

    if (vehicle_no !== undefined) sale.vehicle_no = vehicle_no;
    if (remarks !== undefined) sale.remarks = remarks;

    if (cages !== undefined) {
      const value = Number(cages);
      if (!Number.isFinite(value) || value < 0) return res.status(400).json({ error: 'cages must be >= 0' });
      sale.cages = value;
    }

    if (birds !== undefined) {
      const value = Number(birds);
      if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ error: 'birds must be > 0' });
      const { remaining } = await getRemainingBirds(sale.batch_no, ownerId);
      const available = remaining + sale.birds; // add back previous value
      if (value > available) {
        return res.status(400).json({ error: `not enough birds. Remaining: ${available}` });
      }
      sale.birds = value;
    }

    let nextEmptyWeight = typeof sale.empty_weight === 'number' ? sale.empty_weight : 0;
    let nextLoadWeight = typeof sale.load_weight === 'number' ? sale.load_weight : 0;
    let shouldRecomputeTotal = false;

    if (empty_weight !== undefined) {
      const value = Number(empty_weight);
      if (!Number.isFinite(value) || value < 0) return res.status(400).json({ error: 'empty_weight must be >= 0' });
      sale.empty_weight = value;
      nextEmptyWeight = value;
      shouldRecomputeTotal = true;
    }

    if (load_weight !== undefined) {
      const value = Number(load_weight);
      if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ error: 'load_weight must be > 0' });
      sale.load_weight = value;
      nextLoadWeight = value;
      shouldRecomputeTotal = true;
    }

    if (shouldRecomputeTotal) {
      const computedTotal = roundWeight(nextLoadWeight - nextEmptyWeight);
      if (computedTotal <= 0) return res.status(400).json({ error: 'load_weight must be greater than empty_weight' });
      sale.total_weight = computedTotal;
    } else if (total_weight !== undefined) {
      const value = Number(total_weight);
      if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ error: 'total_weight must be > 0' });
      sale.total_weight = value;
    }

    const saved = await sale.save();
    res.json(saved);
  } catch (err) {
    console.error(err);
    if (err.message === 'batch_not_found') return res.status(400).json({ error: 'batch_no not found' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
