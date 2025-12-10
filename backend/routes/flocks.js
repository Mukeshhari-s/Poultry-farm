const express = require('express');
const router = express.Router();
const Flock = require('../models/Flock');
const DailyMonitoring = require('../models/DailyMonitoring');
const Feed = require('../models/Feed');
const Sale = require('../models/Sale');
const closingReportRouter = require('./closingReport');
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

function safeNum(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
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

// Reopen a previously closed flock (admin-style undo)
router.patch('/:id/reopen', async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = req.user._id;

    const flock = await Flock.findOne({ _id: id, owner: ownerId });
    if (!flock) return res.status(404).json({ error: 'Flock not found' });

    if (flock.status !== 'closed') {
      return res.status(400).json({ error: 'Batch is not closed' });
    }

    // Ensure only one active flock at a time
    const otherActive = await Flock.findOne({ owner: ownerId, status: 'active', _id: { $ne: id } });
    if (otherActive) {
      const label = otherActive.batch_no || 'another active batch';
      return res.status(400).json({ error: `Close ${label} before reopening this batch.` });
    }

    flock.status = 'active';
    flock.closedAt = undefined;
    flock.closeRemarks = undefined;

    const saved = await flock.save();
    res.json(saved);
  } catch (err) {
    console.error('Reopen flock error', err);
    res.status(500).json({ error: err.message });
  }
});

const KG_PER_BAG = 60;

router.get('/dashboard/summary', async (req, res) => {
  try {
    const ownerId = req.user._id;
    const flocks = await Flock.find({ owner: ownerId }).sort({ createdAt: -1 }).lean();
    if (!flocks.length) return res.json([]);
    const summary = [];

    // Reuse closing report calculations so dashboard feed values
    // and final amount exactly match Performance and Feed pages
    for (const flock of flocks) {
      const report = await closingReportRouter.buildClosingReport(ownerId, flock._id);
      if (!report) continue;

      const feedUsedKg = safeNum(report.netFeedKg);
      const feedUsedBags = feedUsedKg > 0 ? safeNum(feedUsedKg / KG_PER_BAG) : 0;
      const chicksOut = safeNum(report.totalBirdsSold);
      const totalWeightKg = safeNum(report.totalWeightSold);
      const perf = report.performance || {};
      const finalAmount = safeNum(perf.finalAmount ?? perf.netGc ?? 0);

      summary.push({
        batch_no: flock.batch_no,
        chicksIn: safeNum(flock.totalChicks),
        chicksOut,
        totalFeedKg: feedUsedKg,
        totalFeedBags: Number(feedUsedBags.toFixed(2)),
        totalWeightKg: Number(totalWeightKg.toFixed(3)),
        finalAmount,
        status: flock.status,
      });
    }

    res.json(summary);
  } catch (err) {
    console.error('dashboard summary error', err);
    res.status(500).json({ error: 'Unable to load batch summary', details: err.message });
  }
});

module.exports = router;
