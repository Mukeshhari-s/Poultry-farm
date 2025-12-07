const express = require('express');
const router = express.Router();
const Feed = require('../models/Feed');
const Flock = require('../models/Flock');

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}
function isFutureDate(d) {
  if (!d) return false;
  const input = new Date(d);
  const today = new Date();

  // Reset today's time to midnight (so time won't affect comparison)
  today.setUTCHours(0, 0, 0, 0);
  input.setUTCHours(0, 0, 0, 0);

  return input > today;
}

function roundKg(value) {
  return Math.round(value * 1000) / 1000;
}

function normalizeType(value) {
  if (value === undefined || value === null) return { display: '', key: '' };
  const display = String(value).trim();
  if (!display) return { display: '', key: '' };
  return { display, key: display.toLowerCase() };
}

async function getFeedBalance({ ownerId, flockId }) {
  const match = { owner: ownerId };
  if (flockId) match.flockId = flockId;

  const stats = await Feed.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalIn: { $sum: '$kgIn' },
        totalOut: { $sum: '$kgOut' }
      }
    }
  ]);
  const [totals] = stats;
  const inKg = totals?.totalIn || 0;
  const outKg = totals?.totalOut || 0;
  return inKg - outKg;
}


// Feed IN
router.post('/in', async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { type, date, bagsIn = 0, kgPerBag = 0, flockId, unitPrice } = req.body;
    if (!type) return res.status(400).json({ error: 'type is required' });
    const { display: normalizedType, key: typeKey } = normalizeType(type);
    if (!normalizedType) return res.status(400).json({ error: 'type is required' });
    if (isFutureDate(date)) return res.status(400).json({ error: 'date cannot be in the future' });

    const bagsValue = Number(bagsIn ?? 0);
    const kgPerBagValue = Number(kgPerBag ?? 0);
    if (!Number.isFinite(bagsValue) || bagsValue < 0) return res.status(400).json({ error: 'bagsIn cannot be negative' });
    if (!Number.isFinite(kgPerBagValue) || kgPerBagValue < 0) return res.status(400).json({ error: 'kgPerBag cannot be negative' });
    if (bagsValue > 0 && kgPerBagValue === 0) {
      return res.status(400).json({ error: 'kgPerBag is required when bagsIn is provided' });
    }

    const kgIn = roundKg(bagsValue * kgPerBagValue);

    const unitPriceValue = Number(unitPrice ?? 0);
    if (!Number.isFinite(unitPriceValue) || unitPriceValue <= 0) {
      return res.status(400).json({ error: 'unitPrice must be greater than 0' });
    }
    const totalCost = roundMoney(kgIn * unitPriceValue);

    let flockDoc = null;
    if (flockId) {
      flockDoc = await Flock.findOne({ _id: flockId, owner: ownerId });
      if (!flockDoc) return res.status(404).json({ error: 'Batch not found' });
    }

    const entryDate = date ? new Date(date) : new Date();
    if (Number.isNaN(entryDate.getTime())) return res.status(400).json({ error: 'Invalid date' });
    entryDate.setUTCHours(0, 0, 0, 0);

    const feed = new Feed({
      owner: ownerId,
      type: normalizedType,
      typeKey,
      date: entryDate,
      bagsIn: bagsValue,
      kgPerBag: kgPerBagValue,
      kgIn,
      unitPrice: unitPriceValue,
      totalCost,
      flockId: flockDoc?._id || null,
      batch_no: flockDoc?.batch_no || null,
    });
    await feed.save();
    res.status(201).json(feed);
  } catch (err) {
    console.error('Error in /in:', err);
    res.status(500).json({ error: err.message });
  }
});

// Feed OUT
router.post('/out', async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { type, date, bagsOut = 0, kgPerBag = 0, flockId, unitPrice } = req.body;
    if (!type) return res.status(400).json({ error: 'type is required' });
    const { display: normalizedType, key: typeKey } = normalizeType(type);
    if (!normalizedType) return res.status(400).json({ error: 'type is required' });
    if (isFutureDate(date)) return res.status(400).json({ error: 'date cannot be in the future' });

    const bagsValue = Number(bagsOut ?? 0);
    const kgPerBagValue = Number(kgPerBag ?? 0);
    if (!Number.isFinite(bagsValue) || bagsValue <= 0) {
      return res.status(400).json({ error: 'bagsOut must be greater than 0' });
    }
    if (!Number.isFinite(kgPerBagValue) || kgPerBagValue <= 0) {
      return res.status(400).json({ error: 'kgPerBag must be greater than 0 for feed out' });
    }

    const kgOutValue = roundKg(bagsValue * kgPerBagValue);
    if (kgOutValue <= 0) {
      return res.status(400).json({ error: 'Computed kgOut must be greater than 0' });
    }

    let flockDoc = null;
    if (flockId) {
      flockDoc = await Flock.findOne({ _id: flockId, owner: ownerId });
      if (!flockDoc) return res.status(404).json({ error: 'Batch not found' });
    }

    const availableFeedKg = await getFeedBalance({ ownerId, flockId: flockDoc?._id });
    if (kgOutValue > availableFeedKg + 1e-6) {
      const formatted = Math.max(availableFeedKg, 0).toFixed(2);
      return res.status(400).json({ error: `Only ${formatted} kg available for ${normalizedType}${flockDoc ? ` in ${flockDoc.batch_no}` : ''}` });
    }

    const entryDate = date ? new Date(date) : new Date();
    if (Number.isNaN(entryDate.getTime())) return res.status(400).json({ error: 'Invalid date' });
    entryDate.setUTCHours(0, 0, 0, 0);

    const unitPriceValue = Number(unitPrice ?? 0);
    if (!Number.isFinite(unitPriceValue) || unitPriceValue <= 0) {
      return res.status(400).json({ error: 'unitPrice must be greater than 0' });
    }
    const totalCost = roundMoney(kgOutValue * unitPriceValue);

    const feed = new Feed({
      owner: ownerId,
      type: normalizedType,
      typeKey,
      date: entryDate,
      bagsOut: bagsValue,
      kgPerBag: kgPerBagValue,
      kgOut: kgOutValue,
      unitPrice: unitPriceValue,
      totalCost,
      flockId: flockDoc?._id || null,
      batch_no: flockDoc?.batch_no || null,
    });
    await feed.save();
    res.status(201).json(feed);
  } catch (err) {
    console.error('Error in /out:', err);
    res.status(500).json({ error: err.message });
  }
});

// List all feed logs
router.get('/', async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { flockId, batch_no } = req.query;
    const q = { owner: ownerId };
    if (flockId) q.flockId = flockId;
    if (batch_no) q.batch_no = batch_no;
    const list = await Feed.find(q).sort({ date: -1 });
    res.json(list);
  } catch (err) {
    console.error('Error in GET /api/feed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update feed entry
router.patch('/:id', async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { id } = req.params;
    const { type, date, bagsIn, bagsOut, kgPerBag, kgIn, kgOut, flockId, unitPrice, totalCost } = req.body || {};

    const feed = await Feed.findOne({ _id: id, owner: ownerId });
    if (!feed) return res.status(404).json({ error: 'Feed entry not found' });

    if (type !== undefined) {
      if (!type) return res.status(400).json({ error: 'type is required' });
      const { display: normalizedType, key: typeKey } = normalizeType(type);
      if (!normalizedType) return res.status(400).json({ error: 'type is required' });
      feed.type = normalizedType;
      feed.typeKey = typeKey;
    }

    if (date !== undefined) {
      if (!date) return res.status(400).json({ error: 'date is required' });
      if (isFutureDate(date)) return res.status(400).json({ error: 'date cannot be in the future' });
      const parsedDate = new Date(date);
      if (Number.isNaN(parsedDate.getTime())) return res.status(400).json({ error: 'Invalid date' });
      parsedDate.setUTCHours(0, 0, 0, 0);
      feed.date = parsedDate;
    }

    let shouldRecomputeKgIn = false;
    let shouldRecomputeKgOut = false;

    if (bagsIn !== undefined) {
      const value = Number(bagsIn);
      if (!Number.isFinite(value) || value < 0) return res.status(400).json({ error: 'bagsIn cannot be negative' });
      feed.bagsIn = value;
      shouldRecomputeKgIn = true;
    }

    if (bagsOut !== undefined) {
      const value = Number(bagsOut);
      if (!Number.isFinite(value) || value < 0) return res.status(400).json({ error: 'bagsOut cannot be negative' });
      feed.bagsOut = value;
      shouldRecomputeKgOut = true;
    }

    if (kgPerBag !== undefined) {
      const value = Number(kgPerBag);
      if (!Number.isFinite(value) || value < 0) return res.status(400).json({ error: 'kgPerBag cannot be negative' });
      feed.kgPerBag = value;
      if (feed.bagsIn > 0) shouldRecomputeKgIn = true;
      if (feed.bagsOut > 0) shouldRecomputeKgOut = true;
    }

    if (!shouldRecomputeKgIn && kgIn !== undefined) {
      const value = Number(kgIn);
      if (!Number.isFinite(value) || value < 0) return res.status(400).json({ error: 'kgIn cannot be negative' });
      feed.kgIn = value;
    }

    if (shouldRecomputeKgIn) {
      if (feed.bagsIn > 0 && feed.kgPerBag === 0) {
        return res.status(400).json({ error: 'kgPerBag is required when bagsIn is provided' });
      }
      feed.kgIn = roundKg(feed.bagsIn * (feed.kgPerBag || 0));
    }

    if (!shouldRecomputeKgOut && kgOut !== undefined) {
      const value = Number(kgOut);
      if (!Number.isFinite(value) || value < 0) return res.status(400).json({ error: 'kgOut cannot be negative' });
      feed.kgOut = value;
    }

    if (shouldRecomputeKgOut) {
      if (feed.bagsOut > 0 && feed.kgPerBag === 0) {
        return res.status(400).json({ error: 'kgPerBag is required when bagsOut is provided' });
      }
      feed.kgOut = roundKg(feed.bagsOut * (feed.kgPerBag || 0));
    }

    if (flockId !== undefined) {
      if (!flockId) {
        feed.flockId = null;
        feed.batch_no = null;
      } else {
        const flockDoc = await Flock.findOne({ _id: flockId, owner: ownerId });
        if (!flockDoc) return res.status(404).json({ error: 'Batch not found' });
        feed.flockId = flockDoc._id;
        feed.batch_no = flockDoc.batch_no;
      }
    }

    let nextUnitPrice = typeof feed.unitPrice === 'number' ? feed.unitPrice : 0;
    let shouldRecomputeCost = false;

    if (unitPrice !== undefined) {
      const value = Number(unitPrice);
      if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ error: 'unitPrice must be greater than 0' });
      feed.unitPrice = value;
      nextUnitPrice = value;
      shouldRecomputeCost = true;
    }

    if (
      shouldRecomputeKgIn || shouldRecomputeKgOut ||
      (kgIn !== undefined && feed.kgIn > 0) ||
      (kgOut !== undefined && feed.kgOut > 0)
    ) {
      shouldRecomputeCost = true;
    }

    if (shouldRecomputeCost) {
      const baseKg = feed.kgIn > 0 ? feed.kgIn : feed.kgOut;
      const computedCost = roundMoney(baseKg * nextUnitPrice);
      feed.totalCost = computedCost;
    } else if (totalCost !== undefined) {
      const value = Number(totalCost);
      if (!Number.isFinite(value) || value < 0) return res.status(400).json({ error: 'totalCost cannot be negative' });
      feed.totalCost = roundMoney(value);
    }

    const saved = await feed.save();
    res.json(saved);
  } catch (err) {
    console.error('Error updating feed entry:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
