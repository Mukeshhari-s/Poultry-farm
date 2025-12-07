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
    const ownerId = req.user._id;
    // Optionally accept flockId or date range via query params
    const { flockId } = req.query;

    // 1) Get flock info (total chicks)
    const flockQuery = flockId ? { _id: flockId, owner: ownerId } : { owner: ownerId };
    const flock = await Flock.findOne(flockQuery).lean();
    const totalChicks = flock ? safeNum(flock.totalChicks ?? flock.total ?? flock.chicks ?? flock.count) : 0;
    const pricePerChick = flock ? safeNum(flock.pricePerChick) : 0;
    const totalChickCost = safeNum(totalChicks * pricePerChick);

    // 2) Fetch ordered daily monitoring (daywise)
    const dmQuery = flock ? { batch_no: flock.batch_no, owner: ownerId } : { owner: ownerId };
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
    const feedQuery = flock ? { owner: ownerId, $or: [{ flockId: flock._id }, { batch_no: flock.batch_no }] } : { owner: ownerId };
    const feedRecords = await Feed.find(feedQuery).lean();
    let totalFeedIn = 0;
    let totalFeedOut = 0;
    let totalFeedCostIn = 0;
    let totalFeedCostOut = 0;
    feedRecords.forEach((f) => {
      const inKg = safeNum(f.kgIn ?? f.in_kg ?? f.qty_kg ?? f.qty ?? 0);
      const outKg = safeNum(f.kgOut ?? f.out_kg ?? f.out ?? 0);
      if (inKg > 0) {
        totalFeedIn += inKg;
        const unitPrice = safeNum(f.unitPrice);
        const cost = f.totalCost !== undefined ? safeNum(f.totalCost) : safeNum(inKg * unitPrice);
        totalFeedCostIn += cost;
      }
      if (outKg > 0) {
        totalFeedOut += outKg;
        const unitPrice = safeNum(f.unitPrice);
        const cost = f.totalCost !== undefined ? safeNum(f.totalCost) : safeNum(outKg * unitPrice);
        totalFeedCostOut += cost;
      }
    });
    const feedRemaining = totalFeedIn - totalFeedOut;
    const feedCostRemaining = totalFeedCostIn - totalFeedCostOut;

    // 5) Medicine grouped by date
    const medQuery = flock ? { batch_no: flock.batch_no, owner: ownerId } : { owner: ownerId };
    const meds = await Medicine.find(medQuery).lean();
    const medicineByDate = {};
    let totalMedicineCost = 0;
    meds.forEach(m => {
      const d = (m.date || m.admin_date || m.createdAt || '').toString().slice(0,10);
      if (!medicineByDate[d]) medicineByDate[d] = [];
      const unitPrice = safeNum(m.unitPrice);
      const quantity = safeNum(m.quantity);
      const totalCost = m.totalCost !== undefined ? safeNum(m.totalCost) : safeNum(quantity * unitPrice);
      totalMedicineCost += totalCost;
      medicineByDate[d].push({
        _id: m._id,
        medicine_name: m.medicine_name || m.name || m.drug,
        quantity,
        dose: m.dose || null,
        unitPrice,
        totalCost,
        batch_no: m.batch_no || null,
      });
    });

    // 6) Sales (if needed for remaining birds or weight)
    const saleQuery = flock ? { batch_no: flock.batch_no, owner: ownerId } : { owner: ownerId };
    const sales = await Sale.find(saleQuery).lean();
    const totalBirdsSold = sales.reduce((s, x) => s + safeNum(x.birds || x.count || x.qty), 0);
    const totalWeightSold = sales.reduce((s, x) => s + safeNum(x.weight || x.total_weight || 0), 0);
    const avgWeightPerBird = totalBirdsSold > 0 ? totalWeightSold / totalBirdsSold : 0;

    // Final summary
    const lastCumulativeMort = cumulativeMort;
    const remainingChicks = Math.max(0, totalChicks - lastCumulativeMort - totalBirdsSold);

    res.json({
      totalChicks,
      pricePerChick,
      totalChickCost,
      remainingChicks,
      totalFeedIn,
      totalFeedOut,
      feedRemaining,
      totalFeedCostIn,
      totalFeedCostOut,
      feedCostRemaining,
      totalBirdsSold,
      totalWeightSold,
      avgWeightPerBird,
      totalMedicineCost,
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
