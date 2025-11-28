// backend/routes/currentReport.js
const express = require('express');
const router = express.Router();

// import your models (adjust paths if needed)
const DailyMonitoring = require('../models/DailyMonitoring');
const Feed = require('../models/Feed');
const Flock = require('../models/Flock');      // contains total chicks info
const Medicine = require('../models/Medicine');
const Sale = require('../models/Sale');

function safeNum(v){ return Number(v || 0); }

router.get('/', async (req, res) => {
  try {
    // Optionally accept flockId or date range via query params
    const { flockId } = req.query;

    // 1) Get flock info (total chicks)
    const flockQuery = flockId ? { _id: flockId } : {};
    const flock = await Flock.findOne(flockQuery).lean();
    const totalChicks = flock ? safeNum(flock.total || flock.chicks || flock.count) : 0;

    // 2) Fetch ordered daily monitoring (daywise)
    const dmQuery = flockId ? { flock: flockId } : {};
    const daily = await DailyMonitoring.find(dmQuery).sort({ date: 1 }).lean();

    // 3) Sum total mortality cumulative
    let cumulativeMort = 0;
    const rows = daily.map(d => {
      const mort = safeNum(d.mortality);
      const prevCumulative = cumulativeMort;
      cumulativeMort += mort;

      const birdsAtStart = Math.max(0, totalChicks - prevCumulative);
      const feedKg = safeNum(d.feed_intake_kg || d.feed_intake || 0);
      const feedPerBird = birdsAtStart > 0 ? feedKg / birdsAtStart : 0;

      return {
        date: d.date,
        age: d.age,
        mortality: mort,
        cumulativeMortality: cumulativeMort,
        mortalityPercent: totalChicks > 0 ? (cumulativeMort / totalChicks) * 100 : 0,
        birdsAtStart,
        feedKg,
        feedPerBird
      };
    });

    // 4) Total feed in / out and remaining
    const feedQuery = flockId ? { flock: flockId } : {};
    const feedRecords = await Feed.find(feedQuery).lean();
    const totalFeedIn = feedRecords.reduce((s, f) => s + safeNum(f.in_kg || f.qty_kg || f.qty || 0), 0);
    const totalFeedOut = feedRecords.reduce((s, f) => s + safeNum(f.out_kg || f.out || 0), 0);
    const feedRemaining = totalFeedIn - totalFeedOut;

    // 5) Medicine grouped by date
    const medQuery = flockId ? { flock: flockId } : {};
    const meds = await Medicine.find(medQuery).lean();
    const medicineByDate = {};
    meds.forEach(m => {
      const d = (m.date || m.admin_date || m.createdAt || '').toString().slice(0,10);
      if (!medicineByDate[d]) medicineByDate[d] = [];
      medicineByDate[d].push(m);
    });

    // 6) Sales (if needed for remaining birds or weight)
    const saleQuery = flockId ? { flock: flockId } : {};
    const sales = await Sale.find(saleQuery).lean();
    const totalBirdsSold = sales.reduce((s, x) => s + safeNum(x.birds || x.count || x.qty), 0);
    const totalWeightSold = sales.reduce((s, x) => s + safeNum(x.weight || x.total_weight || 0), 0);

    // Final summary
    const lastCumulativeMort = cumulativeMort;
    const remainingChicks = Math.max(0, totalChicks - lastCumulativeMort - totalBirdsSold);

    res.json({
      totalChicks,
      remainingChicks,
      totalFeedIn,
      totalFeedOut,
      feedRemaining,
      totalBirdsSold,
      totalWeightSold,
      rows,
      medicineByDate,
      rawCounts: {
        dailyCount: daily.length,
        feedRecords: feedRecords.length,
        meds: meds.length,
        sales: sales.length
      }
    });
  } catch (err) {
    console.error('CurrentReport error', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

module.exports = router;
