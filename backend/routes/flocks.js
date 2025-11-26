const express = require('express');
const router = express.Router();
const Flock = require('../models/Flock');

router.post('/', async (req,res)=>{
  try{
    const f = new Flock(req.body);
    await f.save();
    res.status(201).json(f);
  }catch(err){ res.status(500).json({ error: err.message }); }
});

router.get('/', async (req,res)=>{
  const list = await Flock.find().sort({ createdAt: -1 });
  res.json(list);
});

module.exports = router;
