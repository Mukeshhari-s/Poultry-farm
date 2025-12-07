const express = require("express");
const router = express.Router();

const DailyMonitoring = require("../models/DailyMonitoring");
const Flock = require("../models/Flock");
const Feed = require("../models/Feed");
const { parseDateOnly, getDateLabel, computeNextRequiredDate } = require("../utils/date");

const FEED_EPSILON = 1e-6;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const getAvailableFeedForFlock = async (ownerId, flockId) => {
  if (!flockId) return 0;
  const totals = await Feed.aggregate([
    { $match: { owner: ownerId, flockId } },
    {
      $group: {
        _id: null,
        totalIn: { $sum: '$kgIn' },
        totalOut: { $sum: '$kgOut' }
      }
    }
  ]);
  const [stats] = totals;
  const inKg = stats?.totalIn || 0;
  const outKg = stats?.totalOut || 0;
  return inKg - outKg;
};

// Create a daily monitoring entry (age auto-calculated)
router.post('/', async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { batch_no, date, mortality = 0, feedBags = 0, kgPerBag = 0, avgWeight = 0, remarks } = req.body;

    if (!batch_no) return res.status(400).json({ error: "batch_no is required" });
    if (!date) return res.status(400).json({ error: "date is required" });
    const dateLabel = getDateLabel(date);
    if (!dateLabel) return res.status(400).json({ error: "Invalid date" });

    const mortalityValue = Number(mortality ?? 0);
    const feedBagsValue = Number(feedBags ?? 0);
    const kgPerBagValue = Number(kgPerBag ?? 0);
    const avgWeightValue = Number(avgWeight ?? 0);
    if (!Number.isFinite(mortalityValue) || mortalityValue < 0) return res.status(400).json({ error: "mortality must be >= 0" });
    if (!Number.isFinite(feedBagsValue) || feedBagsValue < 0) return res.status(400).json({ error: "feedBags must be >= 0" });
    if (!Number.isFinite(kgPerBagValue) || kgPerBagValue < 0) return res.status(400).json({ error: "kgPerBag must be >= 0" });
    if (feedBagsValue > 0 && kgPerBagValue === 0) return res.status(400).json({ error: "kgPerBag must be provided when feedBags is set" });
    if (!Number.isFinite(avgWeightValue) || avgWeightValue < 0) return res.status(400).json({ error: "avgWeight must be >= 0" });

    // ensure batch exists and is active for this owner
    const batch = await Flock.findOne({ batch_no, owner: ownerId });
    if (!batch) return res.status(400).json({ error: "batch_no not found" });
    if (batch.status !== 'active') return res.status(400).json({ error: "batch is not active" });

    // normalize dates
    const inputDate = parseDateOnly(date);
    if (!inputDate) return res.status(400).json({ error: "Invalid date" });
    const today = parseDateOnly(new Date());
    if (inputDate > today) return res.status(400).json({ error: "date cannot be in the future" });

    const startDate = parseDateOnly(batch.start_date);
    if (!startDate) return res.status(400).json({ error: "Batch start_date invalid" });
    if (inputDate < startDate) return res.status(400).json({ error: "date cannot be before batch start_date" });

    const existingRecords = await DailyMonitoring.find({ owner: ownerId, batch_no })
      .sort({ date: 1 })
      .select('date dateLabel')
      .lean();
    const nextRequiredDate = computeNextRequiredDate(startDate, existingRecords);
    if (!nextRequiredDate) {
      return res.status(400).json({ error: "Unable to determine next required date for this batch" });
    }

    if (nextRequiredDate.getTime() > today.getTime()) {
      return res.status(400).json({ error: "Daily entries are already recorded through today. Come back tomorrow." });
    }

    if (inputDate.getTime() !== nextRequiredDate.getTime()) {
      return res.status(400).json({
        error: `Next required date is ${getDateLabel(nextRequiredDate)}. Please record entries sequentially.`,
        nextRequiredDate: getDateLabel(nextRequiredDate),
      });
    }

    const computedAge = Math.round((inputDate - startDate) / MS_PER_DAY);

    if (computedAge < 0 || computedAge > 55) {
      return res.status(400).json({ error: `computed age ${computedAge} out of range (0-55)` });
    }

    const totalFeedKg = Number.isFinite(feedBagsValue * kgPerBagValue)
      ? Math.round(feedBagsValue * kgPerBagValue * 1000) / 1000
      : 0;

    if (totalFeedKg > 0) {
      const feedAvailable = await getAvailableFeedForFlock(ownerId, batch._id);
      if (totalFeedKg > feedAvailable + FEED_EPSILON) {
        const formatted = Math.max(feedAvailable, 0).toFixed(2);
        return res.status(400).json({ error: `Only ${formatted} kg feed available for batch ${batch.batch_no}. Add feed before recording daily usage.` });
      }
    }

    const rec = new DailyMonitoring({
      owner: ownerId,
      batch_no,
      date: inputDate,
      dateLabel,
      age: computedAge,
      mortality: mortalityValue,
      feedBags: feedBagsValue,
      kgPerBag: kgPerBagValue,
      feedKg: totalFeedKg,
      avgWeight: avgWeightValue,
      remarks
    });

    const saved = await rec.save();

    if (totalFeedKg > 0) {
      try {
        await Feed.create({
          owner: ownerId,
          type: 'Daily Usage',
          typeKey: 'daily usage',
          date: inputDate,
          bagsOut: feedBagsValue,
          kgPerBag: kgPerBagValue,
          kgOut: totalFeedKg,
          flockId: batch._id,
          batch_no: batch.batch_no,
          dailyRecord: saved._id,
        });
      } catch (feedLogErr) {
        await DailyMonitoring.deleteOne({ _id: saved._id });
        throw feedLogErr;
      }
    }

    return res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Update daily monitoring entry (limited fields)
router.patch('/:id', async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { id } = req.params;
    const { mortality, feedBags, kgPerBag, avgWeight, remarks } = req.body || {};

    const rec = await DailyMonitoring.findOne({ _id: id, owner: ownerId });
    if (!rec) return res.status(404).json({ error: 'Daily record not found' });
    if (!rec.dateLabel && rec.date) {
      rec.dateLabel = getDateLabel(rec.date);
    }

    const originalSnapshot = {
      mortality: rec.mortality,
      feedBags: rec.feedBags,
      kgPerBag: rec.kgPerBag,
      avgWeight: rec.avgWeight,
      remarks: rec.remarks,
      feedKg: rec.feedKg,
    };

    const updateNumber = (field, value, options = { min: 0 }) => {
      if (value === undefined) return;
      const num = Number(value);
      if (!Number.isFinite(num) || num < options.min) {
        throw new Error(`${field} must be >= ${options.min}`);
      }
      rec[field] = num;
    };

    try {
      updateNumber('mortality', mortality);
      updateNumber('feedBags', feedBags);
      updateNumber('kgPerBag', kgPerBag);
      updateNumber('avgWeight', avgWeight);
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }

    if (rec.feedBags > 0 && rec.kgPerBag <= 0) {
      return res.status(400).json({ error: 'kgPerBag must be > 0 when feedBags is set' });
    }

    rec.feedKg = Math.round((rec.feedBags || 0) * (rec.kgPerBag || 0) * 1000) / 1000;

    if (remarks !== undefined) rec.remarks = remarks;

    const batch = await Flock.findOne({ batch_no: rec.batch_no, owner: ownerId });
    if (!batch) return res.status(400).json({ error: 'batch_no not found' });

    const totalFeedKg = rec.feedKg;
    const feedUsageLog = await Feed.findOne({ owner: ownerId, dailyRecord: rec._id });
    const previousUsage = feedUsageLog?.kgOut || 0;

    if (totalFeedKg > 0) {
      const feedAvailable = await getAvailableFeedForFlock(ownerId, batch._id);
      const effectiveAvailable = feedAvailable + previousUsage;
      if (totalFeedKg > effectiveAvailable + FEED_EPSILON) {
        const formatted = Math.max(effectiveAvailable, 0).toFixed(2);
        return res.status(400).json({ error: `Only ${formatted} kg feed available for batch ${batch.batch_no}. Add feed before updating daily usage.` });
      }
    }

    const saved = await rec.save();

    try {
      if (totalFeedKg > 0) {
        if (feedUsageLog) {
          feedUsageLog.set({
            type: 'Daily Usage',
            typeKey: 'daily usage',
            date: rec.date,
            bagsOut: rec.feedBags,
            kgPerBag: rec.kgPerBag,
            kgOut: totalFeedKg,
            flockId: batch._id,
            batch_no: batch.batch_no,
          });
          await feedUsageLog.save();
        } else {
          await Feed.create({
            owner: ownerId,
            type: 'Daily Usage',
            typeKey: 'daily usage',
            date: rec.date,
            bagsOut: rec.feedBags,
            kgPerBag: rec.kgPerBag,
            kgOut: totalFeedKg,
            flockId: batch._id,
            batch_no: batch.batch_no,
            dailyRecord: rec._id,
          });
        }
      } else if (feedUsageLog) {
        await feedUsageLog.deleteOne();
      }
    } catch (feedLogErr) {
      await DailyMonitoring.findByIdAndUpdate(rec._id, originalSnapshot);
      throw feedLogErr;
    }

    res.json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
