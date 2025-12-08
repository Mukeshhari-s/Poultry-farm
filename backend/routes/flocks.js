const express = require('express');
const router = express.Router();
const Flock = require('../models/Flock');
const DailyMonitoring = require('../models/DailyMonitoring');
const Feed = require('../models/Feed');
const Sale = require('../models/Sale');
const { parseDateOnly } = require('../utils/date');

const MIN_CLOSING_AGE = 40;

// Helper: format YYYYMMDD
function ymd(d) {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

// Create new flock (chicks entry)
router.post('/', async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { start_date, totalChicks, remarks, pricePerChick } = req.body;

    // basic presence check
    if (!start_date) return res.status(400).json({ error: "start_date is required" });
    if (totalChicks == null) return res.status(400).json({ error: "totalChicks is required" });
    if (pricePerChick == null) return res.status(400).json({ error: "pricePerChick is required" });

    const inputDate = parseDateOnly(start_date);
    if (!inputDate) return res.status(400).json({ error: "Invalid start_date" });
    const today = new Date();
    // strip time in UTC for consistent comparisons
    today.setUTCHours(0,0,0,0);

    // No future dates
    if (inputDate > today) {
      return res.status(400).json({ error: "start_date cannot be in the future" });
    }

    // totalChicks positive
    if (!Number.isFinite(totalChicks) || totalChicks <= 0) {
      return res.status(400).json({ error: "totalChicks must be a number > 0" });
    }

    const priceValue = Number(pricePerChick);
    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      return res.status(400).json({ error: "pricePerChick must be a number > 0" });
    }

    const activeFlock = await Flock.findOne({ owner: ownerId, status: 'active' });
    if (activeFlock) {
      const label = activeFlock.batch_no || 'the current batch';
      return res.status(400).json({ error: `Close ${label} before creating a new batch.` });
    }

    // create base document (without batch_no)
    const f = new Flock({
      owner: ownerId,
      start_date: inputDate,
      totalChicks,
      pricePerChick: priceValue,
      remarks
    });

    const saved = await f.save();

    // generate batch_no using date + last 6 chars of _id (guaranteed unique)
    // format: BATCH-YYYYMMDD-<hex>
    const idHex = saved._id.toString().slice(-6).toUpperCase();
    const batchNo = `BATCH-${ymd(saved.start_date)}-${idHex}`;

    // update document with batch_no
    saved.batch_no = batchNo;
    await saved.save();

    return res.status(201).json(saved);
  } catch (err) {
    // handle duplicate key (rare) or other errors
    if (err.code === 11000) {
      return res.status(500).json({ error: "Batch number collision. Try again." });
    }
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// List all flocks (newest first)
router.get('/', async (req, res) => {
  try {
    const list = await Flock.find({ owner: req.user._id }).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update flock details
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, totalChicks, remarks, pricePerChick } = req.body || {};

    const flock = await Flock.findOne({ _id: id, owner: req.user._id });
    if (!flock) return res.status(404).json({ error: 'Flock not found' });

    if (start_date !== undefined) {
      if (!start_date) return res.status(400).json({ error: 'start_date is required' });
      const inputDate = parseDateOnly(start_date);
      if (!inputDate) {
        return res.status(400).json({ error: 'Invalid start_date' });
      }
      const today = new Date();
      today.setUTCHours(0,0,0,0);
      if (inputDate > today) return res.status(400).json({ error: 'start_date cannot be in the future' });
      flock.start_date = inputDate;
    }

    if (totalChicks !== undefined) {
      const parsedTotal = Number(totalChicks);
      if (!Number.isFinite(parsedTotal) || parsedTotal <= 0) {
        return res.status(400).json({ error: 'totalChicks must be a number > 0' });
      }
      flock.totalChicks = parsedTotal;
    }

    if (remarks !== undefined) {
      flock.remarks = remarks;
    }

    if (pricePerChick !== undefined) {
      const priceValue = Number(pricePerChick);
      if (!Number.isFinite(priceValue) || priceValue <= 0) {
        return res.status(400).json({ error: 'pricePerChick must be a number > 0' });
      }
      flock.pricePerChick = priceValue;
    }

    const saved = await flock.save();
    res.json(saved);
  } catch (err) {
    console.error('Update flock error', err);
    res.status(500).json({ error: err.message });
  }
});

// Close a flock (mark batch completed)
router.patch('/:id/close', async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body || {};

    const flock = await Flock.findOne({ _id: id, owner: req.user._id });
    if (!flock) return res.status(404).json({ error: 'Flock not found' });
    if (flock.status === 'closed') {
      return res.status(400).json({ error: 'Batch already closed' });
    }

    const latestDaily = await DailyMonitoring.findOne({ batch_no: flock.batch_no, owner: req.user._id }).sort({ age: -1, date: -1 });
    const latestAge = typeof latestDaily?.age === 'number' ? latestDaily.age : null;
    if (latestAge === null || latestAge < MIN_CLOSING_AGE) {
      return res.status(400).json({
        error: `Minimum ${MIN_CLOSING_AGE} day monitoring entry required before closing this batch`,
        latestAge,
      });
    }

    flock.status = 'closed';
    flock.closedAt = new Date();
    if (remarks) flock.closeRemarks = remarks;

    const saved = await flock.save();
    res.json(saved);
  } catch (err) {
    console.error('Close flock error', err);
    res.status(500).json({ error: err.message });
  }
});

const KG_PER_BAG = 60;

router.get('/dashboard/summary', async (req, res) => {
  try {
    const ownerId = req.user._id;
    const flocks = await Flock.find({ owner: ownerId }).sort({ createdAt: -1 }).lean();
    if (!flocks.length) return res.json([]);

    const batchNos = flocks.map((f) => f.batch_no).filter(Boolean);
    const flockIds = flocks.map((f) => f._id);
    const flockIdToBatch = new Map(flocks.map((f) => [f._id.toString(), f.batch_no]));

    const feedQuery = { owner: ownerId };
    if (batchNos.length || flockIds.length) {
      feedQuery.$or = [];
      if (batchNos.length) feedQuery.$or.push({ batch_no: { $in: batchNos } });
      if (flockIds.length) feedQuery.$or.push({ flockId: { $in: flockIds } });
    }

    const [feedLogs, sales] = await Promise.all([
      Feed.find(feedQuery).lean(),
      Sale.find({ owner: ownerId, batch_no: { $in: batchNos } }).lean(),
    ]);

    const feedByBatch = {};
    feedLogs.forEach((entry) => {
      const batchNo = entry.batch_no || (entry.flockId ? flockIdToBatch.get(entry.flockId.toString()) : null);
      if (!batchNo) return;
      const bucket = feedByBatch[batchNo] || { kgOut: 0 };
      bucket.kgOut += Number(entry.kgOut || 0);
      feedByBatch[batchNo] = bucket;
    });

    const salesByBatch = {};
    sales.forEach((entry) => {
      const batchNo = entry.batch_no;
      if (!batchNo) return;
      const bucket = salesByBatch[batchNo] || { birds: 0, weight: 0 };
      bucket.birds += Number(entry.birds || 0);
      bucket.weight += Number(entry.total_weight || 0);
      salesByBatch[batchNo] = bucket;
    });

    const summary = flocks.map((flock) => {
      const feedStats = feedByBatch[flock.batch_no] || { kgOut: 0 };
      const saleStats = salesByBatch[flock.batch_no] || { birds: 0, weight: 0 };
      const feedUsedKg = Number(feedStats.kgOut.toFixed(3));
      const feedUsedBags = Number((feedUsedKg / KG_PER_BAG).toFixed(2));
      const chicksOut = Math.round(saleStats.birds);
      const totalWeightKg = Number(saleStats.weight.toFixed(3));
      return {
        batch_no: flock.batch_no,
        chicksIn: Number(flock.totalChicks || 0),
        chicksOut,
        totalFeedKg: feedUsedKg,
        totalFeedBags: feedUsedBags,
        totalWeightKg,
        finalAmount: null,
        status: flock.status,
      };
    });

    res.json(summary);
  } catch (err) {
    console.error('dashboard summary error', err);
    res.status(500).json({ error: 'Unable to load batch summary', details: err.message });
  }
});

module.exports = router;
