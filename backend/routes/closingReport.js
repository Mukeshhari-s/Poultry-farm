// backend/routes/currentReport.js
const express = require('express');
const PDFDocument = require('pdfkit');
const router = express.Router();

const DailyMonitoring = require('../models/DailyMonitoring');
const Feed = require('../models/Feed');
const Flock = require('../models/Flock');
const Medicine = require('../models/Medicine');
const Sale = require('../models/Sale');

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MIN_RECORD_DAYS = 35;
const SALES_TOLERANCE = 10;

function safeNum(v) {
  return Number(v || 0);
}

async function buildClosingReport(ownerId, flockId) {
  const flockQuery = flockId ? { _id: flockId, owner: ownerId } : { owner: ownerId };
  const flock = await Flock.findOne(flockQuery).lean();
  if (!flock) return null;
  const totalChicks = safeNum(flock.totalChicks ?? flock.total ?? flock.chicks ?? flock.count);
  const pricePerChick = safeNum(flock.pricePerChick);
  const totalChickCost = safeNum(totalChicks * pricePerChick);

  const dmQuery = { batch_no: flock.batch_no, owner: ownerId };
  const daily = await DailyMonitoring.find(dmQuery).sort({ date: 1 }).lean();
  let cumulativeMort = 0;
  const rows = daily.map((d) => {
    const mort = safeNum(d.mortality);
    const prevCumulative = cumulativeMort;
    cumulativeMort += mort;
    const birdsAtStart = Math.max(0, totalChicks - prevCumulative);
    const feedKg = safeNum(d.feed_intake_kg || d.feed_intake || d.feedKg || d.feedKgToday || 0);
    const feedPerBird = birdsAtStart > 0 ? feedKg / birdsAtStart : 0;
    return {
      date: d.date,
      age: d.age,
      mortality: mort,
      cumulativeMortality: cumulativeMort,
      mortalityPercent: totalChicks > 0 ? (cumulativeMort / totalChicks) * 100 : 0,
      birdsAtStart,
      feedKg,
      feedPerBird,
      avgWeight: safeNum(d.avgWeight),
    };
  });
  const totalMortality = cumulativeMort;
  const mortalityPercent = totalChicks > 0 ? (totalMortality / totalChicks) * 100 : 0;
  const balanceChicks = Math.max(0, totalChicks - totalMortality);

  const feedQuery = { owner: ownerId, $or: [{ flockId: flock._id }, { batch_no: flock.batch_no }] };
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

  const medQuery = { batch_no: flock.batch_no, owner: ownerId };
  const meds = await Medicine.find(medQuery).lean();
  const medicineByDate = {};
  let totalMedicineCost = 0;
  meds.forEach((m) => {
    const d = (m.date || m.admin_date || m.createdAt || '').toString().slice(0, 10);
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

  const saleQuery = { batch_no: flock.batch_no, owner: ownerId };
  const sales = await Sale.find(saleQuery).lean();
  const totalBirdsSold = sales.reduce((s, x) => s + safeNum(x.birds || x.count || x.qty), 0);
  const totalWeightSold = sales.reduce((s, x) => s + safeNum(x.weight || x.total_weight || 0), 0);
  const avgWeightPerBird = totalBirdsSold > 0 ? totalWeightSold / totalBirdsSold : 0;
  const latestAvgWeightRecorded = rows.length ? safeNum(rows[rows.length - 1].avgWeight) : null;
  const avgWeightReference = avgWeightPerBird || latestAvgWeightRecorded;
  const lastCumulativeMort = cumulativeMort;
  const remainingChicks = Math.max(0, totalChicks - lastCumulativeMort - totalBirdsSold);

  const startDate = flock.start_date ? new Date(flock.start_date) : null;
  const saleAges = sales
    .map((sale) => {
      if (!startDate || !sale.date) return null;
      const diff = new Date(sale.date).getTime() - startDate.getTime();
      if (!Number.isFinite(diff) || diff < 0) return null;
      return diff / MS_PER_DAY;
    })
    .filter((age) => Number.isFinite(age));
  const meanSaleAge = saleAges.length ? saleAges.reduce((sum, age) => sum + age, 0) / saleAges.length : null;

  const expectedBirdsSold = balanceChicks;
  const shortExcess = totalBirdsSold - expectedBirdsSold;
  const totalFeedIntakeKg = totalFeedOut;
  const cumulativeFeedPerBird = balanceChicks > 0 ? totalFeedIntakeKg / balanceChicks : null;
  const chickCostTotal = totalChickCost;
  const feedCostTotal = totalFeedCostOut;
  const medicineCostTotal = totalMedicineCost;
  const overhead = totalChicks * 6;
  const totalCost = chickCostTotal + feedCostTotal + medicineCostTotal + overhead;
  const productionCost = totalWeightSold > 0 ? totalCost / totalWeightSold : null;
  const fcr = avgWeightReference > 0 ? cumulativeFeedPerBird / avgWeightReference : null;

  const performance = {
    housedChicks: totalChicks,
    feedsInKg: totalFeedIn,
    feedIntakeKg: totalFeedIntakeKg,
    cumulativeFeedPerBird,
    totalMortality,
    mortalityPercent,
    totalBirdsSales: totalBirdsSold,
    weightOfTotalBirds: totalWeightSold,
    avgWeight: avgWeightPerBird,
    shortExcess,
    expectedBirdsSold,
    meanAge: meanSaleAge,
    fcr,
    chickCost: chickCostTotal,
    feedCost: feedCostTotal,
    medicineCost: medicineCostTotal,
    overhead,
    totalCost,
    productionCost,
    gcPerKg: null,
    totalGc: null,
    tds: null,
    netGc: null,
    finalAmount: null,
  };

  const hasMinRecords = rows.length >= MIN_RECORD_DAYS;
  const salesMatchesInventory = Math.abs(shortExcess) <= SALES_TOLERANCE;
  const validation = {
    minRecordDays: MIN_RECORD_DAYS,
    recordCount: rows.length,
    hasMinRecords,
    expectedBirdsSold,
    tolerance: SALES_TOLERANCE,
    salesMatchesInventory,
    salesDelta: shortExcess,
    performanceReady: hasMinRecords || salesMatchesInventory,
  };

  return {
    flock,
    totalChicks,
    pricePerChick,
    totalChickCost,
    remainingChicks,
    totalMortality,
    mortalityPercent,
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
    cumulativeFeedPerBird,
    performance,
    validation,
    rawCounts: {
      dailyCount: daily.length,
      feedRecords: feedRecords.length,
      meds: meds.length,
      sales: sales.length,
    },
  };
}

router.get('/', async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { flockId } = req.query;
    const report = await buildClosingReport(ownerId, flockId);
    if (!report) return res.status(404).json({ error: 'Flock/batch not found' });
    res.json(report);
  } catch (err) {
    console.error('CurrentReport error', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.get('/:flockId/pdf', async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { flockId } = req.params;
    const report = await buildClosingReport(ownerId, flockId);
    if (!report) return res.status(404).json({ error: 'Flock/batch not found' });
    const perf = report.performance || {};
    const validation = report.validation || {};
    const formatNum = (value, decimals = 2) => {
      const num = Number(value);
      if (!Number.isFinite(num)) return String(value ?? '-');
      return num.toFixed(decimals);
    };
    const formatSigned = (value, decimals = 2) => {
      const num = Number(value);
      if (!Number.isFinite(num)) return '-';
      const formatted = Math.abs(num).toFixed(decimals);
      return `${num >= 0 ? '+' : '-'}${formatted}`;
    };
    const doc = new PDFDocument({ margin: 50 });
    const filename = `${report.flock.batch_no || 'performance-report'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    doc.pipe(res);
    doc.fontSize(18).text('Batch Performance Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Batch: ${report.flock.batch_no || 'N/A'}`);
    doc.text(`Start date: ${report.flock.start_date ? new Date(report.flock.start_date).toLocaleDateString() : 'N/A'}`);
    doc.text(`Status: ${report.flock.status || 'active'}`);
    doc.text(`Records captured: ${report.rows?.length || 0}`);
    doc.moveDown();
    doc.fontSize(14).text('Performance Summary');
    doc.fontSize(11);
    const summaryMetrics = [
      ['Housed chicks', formatNum(perf.housedChicks, 0)],
      ['Feeds in (kg)', formatNum(perf.feedsInKg ?? report.totalFeedIn, 2)],
      ['Feed used (kg)', formatNum(perf.feedIntakeKg ?? report.totalFeedOut, 2)],
      ['Mortality', formatNum(perf.totalMortality ?? report.totalMortality, 0)],
      ['Mortality %', formatNum(perf.mortalityPercent ?? report.mortalityPercent, 2)],
      ['Total birds sold', formatNum(perf.totalBirdsSales ?? report.totalBirdsSold, 0)],
      ['Total bird weight (kg)', formatNum(perf.weightOfTotalBirds ?? report.totalWeightSold, 3)],
      ['Avg weight (kg)', formatNum(perf.avgWeight ?? report.avgWeightPerBird, 3)],
      ['Cumulative feed per bird (kg)', formatNum(perf.cumulativeFeedPerBird ?? report.cumulativeFeedPerBird, 3)],
      ['Short / Excess (+/-)', formatSigned(perf.shortExcess ?? 0, 0)],
      ['Mean sale age (days)', formatNum(perf.meanAge, 1)],
      ['FCR', formatNum(perf.fcr, 3)],
      ['Chick cost', formatNum(perf.chickCost ?? report.totalChickCost, 2)],
      ['Feed cost', formatNum(perf.feedCost ?? report.totalFeedCostOut, 2)],
      ['Medicine cost', formatNum(perf.medicineCost ?? report.totalMedicineCost, 2)],
      ['Overhead', formatNum(perf.overhead, 2)],
      ['Total cost', formatNum(perf.totalCost, 2)],
      ['Production cost / kg', formatNum(perf.productionCost, 3)],
      ['G.C / kg', perf.gcPerKg ? formatNum(perf.gcPerKg, 3) : '-'],
      ['Total', perf.totalGc ? formatNum(perf.totalGc, 2) : '-'],
      ['TDS (1%)', perf.tds ? formatNum(perf.tds, 2) : '-'],
      ['Net G.C', perf.netGc ? formatNum(perf.netGc, 2) : '-'],
      ['Final amount', perf.finalAmount ? formatNum(perf.finalAmount, 2) : '-'],
    ];
    summaryMetrics.forEach(([label, value]) => {
      doc.text(`${label}: ${value}`);
    });
    doc.moveDown();
    doc.fontSize(14).text('Validation');
    doc.fontSize(10);
    doc.text(`Record count: ${validation.recordCount || report.rows?.length || 0}`);
    doc.text(`Minimum days met: ${validation.hasMinRecords ? 'Yes' : 'No'} (need ${validation.minRecordDays || MIN_RECORD_DAYS})`);
    doc.text(
      `Sales alignment: ${validation.salesMatchesInventory ? 'Yes' : 'No'} (delta ${formatSigned(
        validation.salesDelta ?? 0,
        0
      )}, tolerance ±${validation.tolerance || SALES_TOLERANCE})`
    );
    doc.moveDown();
    doc.fontSize(12).text('Notes');
    doc.fontSize(10).text('G.C related values depend on manual input and are left blank intentionally.');
    doc.end();
  } catch (err) {
    console.error('closing report pdf error', err);
    res.status(500).json({ error: 'Unable to build PDF', details: err.message });
  }
});

module.exports = router;
