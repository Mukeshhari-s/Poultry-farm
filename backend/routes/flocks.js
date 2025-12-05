const express = require('express');
const router = express.Router();
const Flock = require('../models/Flock');
const DailyMonitoring = require('../models/DailyMonitoring');

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
    const { start_date, totalChicks, remarks } = req.body;

    // basic presence check
    if (!start_date) return res.status(400).json({ error: "start_date is required" });
    if (totalChicks == null) return res.status(400).json({ error: "totalChicks is required" });

    const inputDate = new Date(start_date);
    const today = new Date();
    // strip time from today for fair compare
    today.setHours(0,0,0,0);
    inputDate.setHours(0,0,0,0);

    // No future dates
    if (inputDate > today) {
      return res.status(400).json({ error: "start_date cannot be in the future" });
    }

    // totalChicks positive
    if (!Number.isFinite(totalChicks) || totalChicks <= 0) {
      return res.status(400).json({ error: "totalChicks must be a number > 0" });
    }

    // create base document (without batch_no)
    const f = new Flock({
      owner: ownerId,
      start_date: inputDate,
      totalChicks,
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
    const { start_date, totalChicks, remarks } = req.body || {};

    const flock = await Flock.findOne({ _id: id, owner: req.user._id });
    if (!flock) return res.status(404).json({ error: 'Flock not found' });

    if (start_date !== undefined) {
      if (!start_date) return res.status(400).json({ error: 'start_date is required' });
      const inputDate = new Date(start_date);
      if (Number.isNaN(inputDate.getTime())) {
        return res.status(400).json({ error: 'Invalid start_date' });
      }
      const today = new Date();
      today.setHours(0,0,0,0);
      inputDate.setHours(0,0,0,0);
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

module.exports = router;
