// backend/routes/currentReport.js
const express = require('express');
const router = express.Router();

const Flock = require('../models/Flock');
const DailyMonitoring = require('../models/DailyMonitoring');
const Feed = require('../models/Feed');
const Medicine = require('../models/Medicine');
const Sale = require('../models/Sale');

const safeNum = v => {
  if (v === undefined || v === null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function formatPct(n) {
  return (Number(n) || 0);
}

// GET /api/current-report?flockId=<id>&batch_no=<batch_no>
router.get('/', async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { flockId, batch_no } = req.query;

    // 1) resolve flock
    let flock;
    if (flockId) flock = await Flock.findOne({ _id: flockId, owner: ownerId }).lean();
    else if (batch_no) flock = await Flock.findOne({ batch_no, owner: ownerId }).lean();
    else flock = await Flock.findOne({ status: 'active', owner: ownerId }).sort({ start_date: -1 }).lean();

    if (!flock) return res.status(404).json({ error: 'Flock/batch not found' });

    const totalChicks = safeNum(flock.totalChicks || flock.total || flock.count || 0);

    // 2) fetch daily monitoring ordered by date asc
    const dmQuery = { batch_no: flock.batch_no, owner: ownerId };
    const daily = await DailyMonitoring.find(dmQuery).sort({ date: 1 }).lean();

    // 3) compute day-wise rows with cumulative mortality, feed per bird etc.
    let cumulativeMort = 0;
    let cumulativeFeedKg = 0;
    const rows = daily.map((d) => {
      const mort = safeNum(d.mortality);
      const prevCumulative = cumulativeMort;
      cumulativeMort += mort;

      const birdsAtStart = Math.max(0, totalChicks - prevCumulative);
      const feedKg = safeNum(d.feedKg || d.feed_kg || d.feed_intake_kg || d.feedKgToday || d.feedKgToday || d.feedKg || d.feed || 0);
      const feedBags = safeNum(d.feedBags || d.feed_bags || d.bags || 0);

      const feedPerBird = birdsAtStart > 0 ? feedKg / birdsAtStart : 0;
      cumulativeFeedKg += feedKg;
      const cumulativeFeedPerBird = birdsAtStart > 0 ? (cumulativeFeedKg / Math.max(1, totalChicks - 0)) : 0; // cumulative per original chicks

      return {
        _id: d._id,
        date: d.date ? d.date.toISOString().slice(0,10) : null,
        age: d.age ?? null,
        mortality: mort,
        cumulativeMortality: cumulativeMort,
        mortalityPercent: totalChicks > 0 ? Number(((cumulativeMort / totalChicks) * 100).toFixed(2)) : 0,
        birdsAtStart,
        feedKg: Number(feedKg.toFixed ? feedKg.toFixed(3) : feedKg),
        feedBags,
        feedPerBird: Number(feedPerBird.toFixed(4)),
        cumulativeFeedKg: Number(cumulativeFeedKg.toFixed(3)),
        cumulativeFeedPerBird: Number(cumulativeFeedPerBird.toFixed(4)),
        avgWeight: safeNum(d.avgWeight || d.avg_weight || d.averageWeight) || null,
        remarks: d.remarks || null
      };
    });

    // 4) feed totals (in / out / remaining)
    const feedQuery = flock._id
      ? { owner: ownerId, $or: [{ flockId: flock._id }, { batch_no: flock.batch_no }] }
      : { owner: ownerId, batch_no: flock.batch_no };
    const feedRecords = await Feed.find(feedQuery).lean();
    let totalFeedIn = 0;
    let totalFeedOut = 0;        // feed route withdrawals
    let totalFeedUsed = 0;       // daily monitoring usage
    feedRecords.forEach((f) => {
      totalFeedIn += safeNum(f.kgIn || f.in_kg || f.qty_kg || f.qty || f.inKg || 0);
      const outKg = safeNum(f.kgOut || f.out_kg || f.out || f.used_kg || 0);
      if (outKg > 0) {
        if (f.dailyRecord) totalFeedUsed += outKg;
        else totalFeedOut += outKg;
      }
    });
    const feedRemaining = totalFeedIn - totalFeedOut - totalFeedUsed;

    // 5) medicine grouped by date
    const meds = await Medicine.find({ batch_no: flock.batch_no, owner: ownerId }).lean();
    const medicineByDate = {};
    meds.forEach(m => {
      const key = m.date ? m.date.toISOString().slice(0,10) : 'unknown';
      if (!medicineByDate[key]) medicineByDate[key] = [];
      medicineByDate[key].push({
        medicine_name: m.medicine_name || m.name || m.drug,
        quantity: safeNum(m.quantity || m.qty),
        dose: m.dose || null,
        batch_no: m.batch_no || null,
        _id: m._id
      });
    });

    // 6) sales summary
    const sales = await Sale.find({ batch_no: flock.batch_no, owner: ownerId }).lean();
    const totalBirdsSold = sales.reduce((s, x) => s + safeNum(x.birds || x.count || x.qty), 0);
    const totalWeightSold = sales.reduce((s, x) => s + safeNum(x.weight || x.total_weight || x.kg), 0);

    // final remaining chicks (consider mortality + sold)
    const lastCumulativeMort = cumulativeMort;
    const remainingChicks = Math.max(0, totalChicks - lastCumulativeMort - totalBirdsSold);

    const result = {
      flock: {
        _id: flock._id,
        batch_no: flock.batch_no,
        start_date: flock.start_date,
        totalChicks
      },
      summary: {
        remainingChicks,
        totalFeedIn,
        totalFeedOut,
        totalFeedUsed,
        feedRemaining,
        totalBirdsSold,
        totalWeightSold,
        cumulativeMortality: lastCumulativeMort,
        cumulativeMortalityPercent: totalChicks > 0 ? Number(((lastCumulativeMort / totalChicks) * 100).toFixed(2)) : 0
      },
      rows,
      medicineByDate,
      meta: {
        dailyCount: daily.length,
        feedRecords: feedRecords.length,
        meds: meds.length,
        sales: sales.length
      }
    };

    return res.json(result);
  } catch (err) {
    console.error('current-report error', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
