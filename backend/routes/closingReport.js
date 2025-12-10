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

// Map production cost per kg to G.C / kg based on user-provided slabs
function computeGcPerKgFromProductionCost(costPerKg) {
  const v = Number(costPerKg);
  if (!Number.isFinite(v)) return null;

  if (v <= 69.99) return 16.0;
  if (v <= 70.5) return 13.8;
  if (v <= 71.0) return 13.4;
  if (v <= 71.5) return 13.0;
  if (v <= 72.0) return 12.6;
  if (v <= 72.5) return 12.2;
  if (v <= 73.0) return 11.8;
  if (v <= 73.5) return 11.4;
  if (v <= 74.0) return 11.15;
  if (v <= 74.5) return 10.9;
  if (v <= 75.0) return 10.65;
  if (v <= 75.5) return 10.4;
  if (v <= 76.0) return 10.15;
  if (v <= 76.5) return 9.9;
  if (v <= 77.0) return 9.65;
  if (v <= 77.5) return 9.4;
  if (v <= 78.0) return 9.2;
  if (v <= 78.5) return 9.0;
  if (v <= 79.0) return 8.8;
  if (v <= 79.5) return 8.6;
  if (v <= 80.0) return 8.4;
  if (v <= 80.5) return 8.2;
  if (v <= 81.0) return 8.0;
  if (v <= 81.5) return 7.8;
  if (v <= 82.0) return 7.65;
  if (v <= 82.5) return 7.5;
  if (v <= 83.0) return 7.35;
  if (v <= 83.5) return 7.2;
  if (v <= 84.0) return 7.1;
  if (v <= 84.5) return 7.0;
  if (v <= 85.0) return 6.9;
  if (v <= 86.0) return 6.8;
  if (v <= 87.0) return 6.7;
  if (v <= 88.0) return 6.6;
  return 6.5; // 88.01 and over
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
  let summaryFeedInKg = 0;    // matches Feed page cumulative summary (kg)
  let summaryFeedOutKg = 0;   // matches Feed page cumulative summary (kg)
  let summaryFeedInCost = 0;  // matches Feed page cumulative summary (amount)
  let summaryFeedOutCost = 0; // matches Feed page cumulative summary (amount)
  feedRecords.forEach((f) => {
    const inKg = safeNum(f.kgIn ?? f.in_kg ?? f.qty_kg ?? f.qty ?? 0);
    const outKg = safeNum(f.kgOut ?? f.out_kg ?? f.out ?? 0);
    const recordCost = safeNum(f.totalCost ?? 0);
    const typeKey = String(f.typeKey || '').toLowerCase();
    const typeValue = String(f.type || '').toLowerCase();
    const isDailyUsage = Boolean(f.dailyRecord) || typeKey === 'daily usage' || typeValue === 'daily usage';

    if (inKg > 0) {
      totalFeedIn += inKg;
      const unitPrice = safeNum(f.unitPrice);
      const cost = f.totalCost !== undefined ? safeNum(f.totalCost) : safeNum(inKg * unitPrice);
      totalFeedCostIn += cost;
      if (!isDailyUsage) {
        summaryFeedInKg += inKg;
        summaryFeedInCost += cost;
      }
    }
    if (outKg > 0) {
      totalFeedOut += outKg;
      const unitPrice = safeNum(f.unitPrice);
      const cost = f.totalCost !== undefined ? safeNum(f.totalCost) : safeNum(outKg * unitPrice);
      totalFeedCostOut += cost;
      if (!isDailyUsage) {
        summaryFeedOutKg += outKg;
        summaryFeedOutCost += cost;
      }
    }
  });
  const feedRemaining = totalFeedIn - totalFeedOut;
  const feedCostRemaining = totalFeedCostIn - totalFeedCostOut;
  const netFeedKg = summaryFeedInKg - summaryFeedOutKg;
  const netFeedCost = summaryFeedInCost - summaryFeedOutCost;
  const totalFeedUsed = totalFeedIn - totalFeedOut;
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
  // Mean sale age = (sum of (birds sold on each sale * age in days at that sale)) / total birds sold
  let weightedAgeSum = 0;
  if (startDate && sales.length && totalBirdsSold > 0) {
    sales.forEach((sale) => {
      if (!sale.date) return;
      const birdsThisSale = safeNum(sale.birds || sale.count || sale.qty);
      if (!birdsThisSale) return;
      const diffMs = new Date(sale.date).getTime() - startDate.getTime();
      if (!Number.isFinite(diffMs) || diffMs < 0) return;
      const ageDays = diffMs / MS_PER_DAY;
      if (!Number.isFinite(ageDays) || ageDays < 0) return;
      weightedAgeSum += birdsThisSale * ageDays;
    });
  }
  const meanSaleAge = totalBirdsSold > 0 && weightedAgeSum > 0 ? weightedAgeSum / totalBirdsSold : null;

  const expectedBirdsSold = balanceChicks;
  const shortExcess = totalBirdsSold - expectedBirdsSold;
  const totalFeedIntakeKg = totalFeedIn - totalFeedOut;
  // Cumulative feed per bird uses netFeedKg (feed in - feed out, excluding daily usage)
  console.log('DEBUG: netFeedKg =', netFeedKg, 'balanceChicks =', balanceChicks, 'summaryFeedInKg =', summaryFeedInKg, 'summaryFeedOutKg =', summaryFeedOutKg);
  const cumulativeFeedPerBird = balanceChicks > 0 ? netFeedKg / balanceChicks : null;
  console.log('DEBUG: cumulativeFeedPerBird =', cumulativeFeedPerBird);
  const chickCostTotal = totalChickCost;
  // Feed cost based on net feed (same as Feed page net amount)
  const feedCostTotal = netFeedCost;
  const medicineCostTotal = totalMedicineCost;
  const overhead = totalChicks * 6;
  const totalCost = chickCostTotal + feedCostTotal + medicineCostTotal + overhead;
  const productionCost = totalWeightSold > 0 ? totalCost / totalWeightSold : null;
  const gcPerKg = productionCost != null ? computeGcPerKgFromProductionCost(productionCost) : null;
  const totalGc = gcPerKg != null && totalWeightSold > 0 ? gcPerKg * totalWeightSold : null;
  const tds = totalGc != null ? totalGc * 0.01 : null; // 1% TDS
  const netGc = totalGc != null && tds != null ? totalGc - tds : null;
  const finalAmount = netGc;
  // FCR = Feed in kg (net) / Weight of total birds (kg)
  const fcr = totalWeightSold > 0 ? netFeedKg / totalWeightSold : null;

  const performance = {
    housedChicks: totalChicks,
    // feedsInKg is not used anymore on the UI; feedIntakeKg represents feed used
    // feedsInKg: totalFeedUsed,
    // feedIntakeKg: totalFeedIntakeKg,
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
    gcPerKg,
    totalGc,
    tds,
    netGc,
    finalAmount,
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
    netFeedKg,
    netFeedCost,
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
      ['Feed in kg', formatNum(perf.feedsInKg ?? report.netFeedKg ?? (report.totalFeedIn - report.totalFeedOut), 2)],
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
        ['Feed cost', formatNum(perf.feedCost ?? report.netFeedCost ?? (report.totalFeedCostIn - report.totalFeedCostOut), 2)],
      ['Medicine cost', formatNum(perf.medicineCost ?? report.totalMedicineCost, 2)],
      ['Overhead', formatNum(perf.overhead, 2)],
      ['Total cost', formatNum(perf.totalCost, 2)],
      ['Production cost / kg', formatNum(perf.productionCost, 2)],
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

// Expose helper for other routes (e.g. dashboard summary)
router.buildClosingReport = buildClosingReport;

module.exports = router;
