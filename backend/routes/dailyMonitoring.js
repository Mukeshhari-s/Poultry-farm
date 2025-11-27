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

    // normalize dates (strip time)
    const inputDate = new Date(date); inputDate.setHours(0,0,0,0);
    const today = new Date(); today.setHours(0,0,0,0);
    if (inputDate > today) return res.status(400).json({ error: "date cannot be in the future" });

    const startDate = new Date(batch.start_date); startDate.setHours(0,0,0,0);
    if (inputDate < startDate) return res.status(400).json({ error: "date cannot be before batch start_date" });

    // compute age automatically:
    // - if there is a previous record, base on that (previous.age + daysBetween)
    // - otherwise base on batch start_date
    const lastRec = await DailyMonitoring.findOne({ batch_no }).sort({ date: -1 });
    let computedAge;
    if (lastRec) {
      const prevDate = new Date(lastRec.date); prevDate.setHours(0,0,0,0);
      const gap = Math.round((inputDate - prevDate) / (24*60*60*1000)); // days between
      if (gap < 0) return res.status(400).json({ error: "date cannot be earlier than last recorded date for this batch" });
      computedAge = lastRec.age + gap;
    } else {
      // no previous record: age = daysBetween(startDate, inputDate)
      computedAge = Math.round((inputDate - startDate) / (24*60*60*1000));
    }

    // validate computed age range
    if (!Number.isInteger(computedAge) || computedAge < 0 || computedAge > 55) {
      return res.status(400).json({ error: `computed age (${computedAge}) out of allowed range (0-55)` });
    }

    // numeric validations for other fields
    if (!Number.isFinite(mortality) || mortality < 0) return res.status(400).json({ error: "mortality must be >= 0" });
    if (!Number.isFinite(feedBags) || feedBags < 0) return res.status(400).json({ error: "feedBags must be >= 0" });
    if (!Number.isFinite(feedKg) || feedKg < 0) return res.status(400).json({ error: "feedKg must be >= 0" });
    if (!Number.isFinite(avgWeight) || avgWeight < 0) return res.status(400).json({ error: "avgWeight must be >= 0" });

    // create record using computedAge (ignore any age sent by client)
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
