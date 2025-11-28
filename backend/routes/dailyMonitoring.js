const express = require("express");
const router = express.Router();

const DailyMonitoring = require("../models/DailyMonitoring");
const Flock = require("../models/Flock");

// Create a daily monitoring entry (age auto-calculated)
router.post('/', async (req, res) => {
  try {
    const { batch_no, date, mortality = 0, feedBags = 0, feedKg = 0, avgWeight = 0, remarks } = req.body;

    if (!batch_no) return res.status(400).json({ error: "batch_no is required" });
    if (!date) return res.status(400).json({ error: "date is required" });

    // ensure batch exists and is active
    const batch = await Flock.findOne({ batch_no });
    if (!batch) return res.status(400).json({ error: "batch_no not found" });
    if (batch.status !== 'active') return res.status(400).json({ error: "batch is not active" });

    // normalize dates
    const inputDate = new Date(date); inputDate.setHours(0,0,0,0);
    const today = new Date(); today.setHours(0,0,0,0);
    if (inputDate > today) return res.status(400).json({ error: "date cannot be in the future" });

    const startDate = new Date(batch.start_date); startDate.setHours(0,0,0,0);
    if (inputDate < startDate) return res.status(400).json({ error: "date cannot be before batch start_date" });

    // compute age automatically
    const lastRec = await DailyMonitoring.findOne({ batch_no }).sort({ date: -1 });
    let computedAge;
    if (lastRec) {
      const prevDate = new Date(lastRec.date); prevDate.setHours(0,0,0,0);
      const gap = Math.round((inputDate - prevDate) / (24*60*60*1000)); 
      if (gap < 0) return res.status(400).json({ error: "date cannot be earlier than last recorded date" });
      computedAge = lastRec.age + gap;
    } else {
      computedAge = Math.round((inputDate - startDate) / (24*60*60*1000));
    }

    if (computedAge < 0 || computedAge > 55)
      return res.status(400).json({ error: `computed age ${computedAge} out of range (0-55)` });

    // numeric validations
    if (mortality < 0) return res.status(400).json({ error: "mortality must be >= 0" });
    if (feedBags < 0) return res.status(400).json({ error: "feedBags must be >= 0" });
    if (feedKg < 0) return res.status(400).json({ error: "feedKg must be >= 0" });
    if (avgWeight < 0) return res.status(400).json({ error: "avgWeight must be >= 0" });

    // create record
    const rec = new DailyMonitoring({
      batch_no,
      date: inputDate,
      age: computedAge,
      mortality,
      feedBags,
      feedKg,
      avgWeight,
      remarks
    });

    const saved = await rec.save();
    return res.status(201).json(saved);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
