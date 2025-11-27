const express = require('express');
const router = express.Router();
const Flock = require('../models/Flock');

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
    const list = await Flock.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
