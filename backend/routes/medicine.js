const express = require("express");
const router = express.Router();
const Medicine = require("../models/Medicine");
const Flock = require("../models/Flock");

const roundMoney = (value) => Math.round(value * 100) / 100;

// ✅ GET active batch numbers (MongoDB version)
router.get("/batches", async (req, res) => {
  try {
    const batches = await Flock.find(
      { status: "active", owner: req.user._id },
      { batch_no: 1, _id: 0 }
    );

    res.json(batches);  // [{ batch_no: "B001" }, { batch_no: "B002" }]
  } catch (err) {
    console.error("Error fetching batches:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ ADD medicine (MongoDB version)
router.post("/", async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { batch_no, date, medicine_name, quantity, dose, unitPrice } = req.body;

    const batch = await Flock.findOne({ batch_no, owner: ownerId });
    if (!batch) return res.status(404).json({ error: "Batch not found" });

    const qtyValue = Number(quantity);
    if (!Number.isFinite(qtyValue) || qtyValue <= 0) return res.status(400).json({ error: "quantity must be greater than 0" });

    const priceValue = Number(unitPrice);
    if (!Number.isFinite(priceValue) || priceValue <= 0) return res.status(400).json({ error: "unitPrice must be greater than 0" });

    const parsedDate = date ? new Date(date) : new Date();
    if (Number.isNaN(parsedDate.getTime())) return res.status(400).json({ error: "Invalid date" });
    parsedDate.setUTCHours(0, 0, 0, 0);

    const totalCost = roundMoney(qtyValue * priceValue);

    const med = new Medicine({
      owner: ownerId,
      batch_no,
      date: parsedDate,
      medicine_name,
      quantity: qtyValue,
      dose,
      unitPrice: priceValue,
      totalCost
    });

    await med.save();

    res.json({ message: "Medicine Added Successfully" });
  } catch (err) {
    console.error("Error saving medicine:", err);
    res.status(500).json({ error: "Error saving medicine" });
  }
});

// ✅ GET all medicine data (MongoDB version)
router.get("/", async (req, res) => {
  try {
    const data = await Medicine.find({ owner: req.user._id }).sort({ date: -1 });
    res.json(data);
  } catch (err) {
    console.error("Error fetching medicine:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ UPDATE medicine entry
router.patch('/:id', async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { id } = req.params;
    const { batch_no, date, medicine_name, quantity, dose, unitPrice } = req.body || {};

    const med = await Medicine.findOne({ _id: id, owner: ownerId });
    if (!med) return res.status(404).json({ error: 'Medicine entry not found' });

    if (batch_no !== undefined) {
      const batch = await Flock.findOne({ batch_no, owner: ownerId });
      if (!batch) return res.status(404).json({ error: 'Batch not found' });
      med.batch_no = batch_no;
    }
    if (date !== undefined) {
      if (!date) return res.status(400).json({ error: 'date is required' });
      const parsedDate = new Date(date);
      if (Number.isNaN(parsedDate.getTime())) return res.status(400).json({ error: 'Invalid date' });
      parsedDate.setUTCHours(0, 0, 0, 0);
      med.date = parsedDate;
    }
    if (medicine_name !== undefined) med.medicine_name = medicine_name;
    let nextQuantity = typeof med.quantity === 'number' ? med.quantity : 0;
    let nextUnitPrice = typeof med.unitPrice === 'number' ? med.unitPrice : 0;
    let shouldRecomputeCost = false;
    if (quantity !== undefined) {
      const qty = Number(quantity);
      if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'quantity must be > 0' });
      med.quantity = qty;
      nextQuantity = qty;
      shouldRecomputeCost = true;
    }
    if (dose !== undefined) med.dose = dose;
    if (unitPrice !== undefined) {
      const priceValue = Number(unitPrice);
      if (!Number.isFinite(priceValue) || priceValue <= 0) return res.status(400).json({ error: 'unitPrice must be > 0' });
      med.unitPrice = priceValue;
      nextUnitPrice = priceValue;
      shouldRecomputeCost = true;
    }

    if (shouldRecomputeCost) {
      med.totalCost = roundMoney(nextQuantity * nextUnitPrice);
    }

    await med.save();
    res.json(med);
  } catch (err) {
    console.error('Error updating medicine:', err);
    res.status(500).json({ error: 'Error updating medicine' });
  }
});

module.exports = router;
