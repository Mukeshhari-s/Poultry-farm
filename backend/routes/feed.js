const express = require('express');
const router = express.Router();
const Feed = require('../models/Feed'); // make sure this matches models/Feed.jsconsole.log('Feed model loaded:', !!Feed && Feed.modelName ? Feed.modelName : typeof Feed);
function isFutureDate(d) {
  if (!d) return false;
  const input = new Date(d);
  const today = new Date();

  // Reset today's time to midnight (so time won't affect comparison)
  today.setHours(0, 0, 0, 0);
  input.setHours(0, 0, 0, 0);

  return input > today;
}


// Feed IN
router.post('/in', async (req, res) => {
  console.log('POST /api/feed/in called - body:', req.body);
  try {
    const { type, date, bagsIn = 0, kgIn = 0, flockId } = req.body;
    if (!type) return res.status(400).json({ error: 'type is required' });
    if (isFutureDate(date)) return res.status(400).json({ error: 'date cannot be in the future' });
    if (bagsIn < 0 || kgIn < 0) return res.status(400).json({ error: 'bagsIn/kgIn cannot be negative' });

    
    const feed = new Feed({ type, date: date || new Date(), bagsIn, kgIn, flockId });
    await feed.save();
    res.status(201).json(feed);
  } catch (err) {
    console.error('Error in /in:', err);
    res.status(500).json({ error: err.message });
  }
});

// Feed OUT
router.post('/out', async (req, res) => {
  console.log('POST /api/feed/out called - body:', req.body);
  try {
    const { type, date, kgOut = 0, flockId } = req.body;
    if (!type) return res.status(400).json({ error: 'type is required' });
    if (isFutureDate(date)) return res.status(400).json({ error: 'date cannot be in the future' });
    if (kgOut <= 0) return res.status(400).json({ error: 'kgOut must be greater than 0' });

    const feed = new Feed({ type, date: date || new Date(), kgOut, flockId });
    await feed.save();
    res.status(201).json(feed);
  } catch (err) {
    console.error('Error in /out:', err);
    res.status(500).json({ error: err.message });
  }
});

// List all feed logs
router.get('/', async (req, res) => {
  console.log('GET /api/feed called - query:', req.query);
  try {
    const { flockId } = req.query;
    const q = flockId ? { flockId } : {};
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
    const { id } = req.params;
    const { type, date, bagsIn, kgIn, kgOut, flockId } = req.body || {};

    const feed = await Feed.findById(id);
    if (!feed) return res.status(404).json({ error: 'Feed entry not found' });

    if (type !== undefined) {
      if (!type) return res.status(400).json({ error: 'type is required' });
      feed.type = type;
    }

    if (date !== undefined) {
      if (!date) return res.status(400).json({ error: 'date is required' });
      if (isFutureDate(date)) return res.status(400).json({ error: 'date cannot be in the future' });
      const parsedDate = new Date(date);
      if (Number.isNaN(parsedDate.getTime())) return res.status(400).json({ error: 'Invalid date' });
      feed.date = parsedDate;
    }

    if (bagsIn !== undefined) {
      const value = Number(bagsIn);
      if (value < 0) return res.status(400).json({ error: 'bagsIn cannot be negative' });
      feed.bagsIn = value;
    }

    if (kgIn !== undefined) {
      const value = Number(kgIn);
      if (value < 0) return res.status(400).json({ error: 'kgIn cannot be negative' });
      feed.kgIn = value;
    }

    if (kgOut !== undefined) {
      const value = Number(kgOut);
      if (value < 0) return res.status(400).json({ error: 'kgOut cannot be negative' });
      feed.kgOut = value;
    }

    if (flockId !== undefined) {
      feed.flockId = flockId;
    }

    const saved = await feed.save();
    res.json(saved);
  } catch (err) {
    console.error('Error updating feed entry:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
