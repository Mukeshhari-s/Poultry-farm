const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const User = require('../models/User');
const Flock = require('../models/Flock');
const DailyMonitoring = require('../models/DailyMonitoring');
const Feed = require('../models/Feed');
const Medicine = require('../models/Medicine');
const Sale = require('../models/Sale');

const groupByOwner = (docs = []) =>
  docs.reduce((acc, doc) => {
    const ownerId = doc?.owner ? doc.owner.toString() : null;
    if (!ownerId) return acc;
    if (!acc[ownerId]) acc[ownerId] = [];
    acc[ownerId].push(doc);
    return acc;
  }, {});

const sanitizeUser = (userDoc) => ({
  id: userDoc._id,
  name: userDoc.name,
  email: userDoc.email,
  mobile: userDoc.mobile,
  role: userDoc.role,
  createdAt: userDoc.createdAt,
  updatedAt: userDoc.updatedAt,
});

const makeBatchBucket = (flock) => ({
  batch_no: flock.batch_no,
  flockId: flock._id,
  chicks: {
    start_date: flock.start_date,
    totalChicks: flock.totalChicks,
    pricePerChick: flock.pricePerChick,
    remarks: flock.remarks || null,
  },
  closing: {
    status: flock.status,
    closedAt: flock.closedAt || null,
    closeRemarks: flock.closeRemarks || null,
  },
  stats: {
    totalFeedKg: 0,
    totalMortality: 0,
    totalSalesKg: 0,
    totalSalesBirds: 0,
  },
  dailyEntries: [],
  feedEntries: [],
  medicineEntries: [],
  salesEntries: [],
});

router.use((req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
});

router.get('/hierarchy', async (req, res) => {
  try {
    const { userId } = req.query;
    let normalizedUserId = null;
    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ error: 'Invalid userId provided' });
      }
      normalizedUserId = userId;
    }

    const userFilter = normalizedUserId ? { _id: normalizedUserId } : {};
    const ownerFilter = normalizedUserId ? { owner: normalizedUserId } : {};

    const [users, flocks, dailyLogs, feedLogs, medicines, sales] = await Promise.all([
      User.find(userFilter).select('name email mobile role createdAt updatedAt').lean(),
      Flock.find(ownerFilter).lean(),
      DailyMonitoring.find(ownerFilter).lean(),
      Feed.find(ownerFilter).lean(),
      Medicine.find(ownerFilter).lean(),
      Sale.find(ownerFilter).lean(),
    ]);

    const flocksByOwner = groupByOwner(flocks);
    const dailyByOwner = groupByOwner(dailyLogs);
    const feedByOwner = groupByOwner(feedLogs);
    const medicineByOwner = groupByOwner(medicines);
    const salesByOwner = groupByOwner(sales);

    const response = users.map((userDoc) => {
      const ownerId = userDoc._id.toString();
      const ownedFlocks = flocksByOwner[ownerId] || [];
      const batchByNo = new Map();
      const batchById = new Map();

      ownedFlocks.forEach((flock) => {
        const bucket = makeBatchBucket(flock);
        batchByNo.set(String(flock.batch_no), bucket);
        batchById.set(flock._id.toString(), bucket);
      });

      const resolveBucket = (record) => {
        if (!record) return null;
        if (record.batch_no && batchByNo.has(String(record.batch_no))) {
          return batchByNo.get(String(record.batch_no));
        }
        const flockId = record.flockId || record.flock || record.flock_id;
        if (flockId && batchById.has(flockId.toString())) {
          return batchById.get(flockId.toString());
        }
        return null;
      };

      (dailyByOwner[ownerId] || []).forEach((entry) => {
        const bucket = resolveBucket(entry);
        if (!bucket) return;
        bucket.dailyEntries.push({
          _id: entry._id,
          date: entry.date,
          dateLabel: entry.dateLabel,
          age: entry.age,
          mortality: entry.mortality,
          feedBags: entry.feedBags,
          kgPerBag: entry.kgPerBag,
          feedKg: entry.feedKg,
          avgWeight: entry.avgWeight,
          remarks: entry.remarks || null,
        });
        bucket.stats.totalMortality += Number(entry.mortality || 0);
        bucket.stats.totalFeedKg += Number(entry.feedKg || 0);
      });

      (feedByOwner[ownerId] || []).forEach((entry) => {
        const bucket = resolveBucket(entry);
        if (!bucket) return;
        bucket.feedEntries.push({
          _id: entry._id,
          type: entry.type,
          date: entry.date,
          bagsIn: entry.bagsIn,
          bagsOut: entry.bagsOut,
          kgPerBag: entry.kgPerBag,
          kgIn: entry.kgIn,
          kgOut: entry.kgOut,
          unitPrice: entry.unitPrice,
          totalCost: entry.totalCost,
        });
      });

      (medicineByOwner[ownerId] || []).forEach((entry) => {
        const bucket = resolveBucket(entry);
        if (!bucket) return;
        bucket.medicineEntries.push({
          _id: entry._id,
          date: entry.date,
          medicine_name: entry.medicine_name,
          quantity: entry.quantity,
          dose: entry.dose,
          unitPrice: entry.unitPrice,
          totalCost: entry.totalCost,
        });
      });

      (salesByOwner[ownerId] || []).forEach((entry) => {
        const bucket = resolveBucket(entry);
        if (!bucket) return;
        bucket.salesEntries.push({
          _id: entry._id,
          date: entry.date,
          birds: entry.birds,
          cages: entry.cages,
          total_weight: entry.total_weight,
          vehicle_no: entry.vehicle_no,
          remarks: entry.remarks || null,
        });
        bucket.stats.totalSalesBirds += Number(entry.birds || 0);
        bucket.stats.totalSalesKg += Number(entry.total_weight || 0);
      });

      const batches = Array.from(batchByNo.values()).map((batch) => ({
        ...batch,
        counts: {
          daily: batch.dailyEntries.length,
          feed: batch.feedEntries.length,
          medicine: batch.medicineEntries.length,
          sales: batch.salesEntries.length,
        },
      })).sort((a, b) => {
        const aDate = a.chicks.start_date ? new Date(a.chicks.start_date).getTime() : 0;
        const bDate = b.chicks.start_date ? new Date(b.chicks.start_date).getTime() : 0;
        return bDate - aDate;
      });

      return {
        user: sanitizeUser(userDoc),
        batches,
      };
    });

    const totalFlocks = Object.values(flocksByOwner).reduce((sum, flockList) => sum + flockList.length, 0);

    res.json({
      generatedAt: new Date().toISOString(),
      users: response,
      counts: {
        users: response.length,
        flocks: totalFlocks,
      },
    });
  } catch (err) {
    console.error('admin hierarchy error', err);
    res.status(500).json({ error: 'Unable to build hierarchy', details: err.message });
  }
});

module.exports = router;
