const express = require("express");
const router = express.Router();
const Medicine = require("../models/Medicine");
const Flock = require("../models/Flock");

// ✅ GET active batch numbers (MongoDB version)
router.get("/batches", async (req, res) => {
  try {
    const batches = await Flock.find(
      { status: "active" },
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
    const { batch_no, date, medicine_name, quantity, dose } = req.body;

    const med = new Medicine({
      batch_no,
      date,
      medicine_name,
      quantity,
      dose
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
    const data = await Medicine.find().sort({ date: -1 });
    res.json(data);
  } catch (err) {
    console.error("Error fetching medicine:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ UPDATE medicine entry
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { batch_no, date, medicine_name, quantity, dose } = req.body || {};

    const med = await Medicine.findById(id);
    if (!med) return res.status(404).json({ error: 'Medicine entry not found' });

    if (batch_no !== undefined) med.batch_no = batch_no;
    if (date !== undefined) {
      if (!date) return res.status(400).json({ error: 'date is required' });
      const parsedDate = new Date(date);
      if (Number.isNaN(parsedDate.getTime())) return res.status(400).json({ error: 'Invalid date' });
      med.date = parsedDate;
    }
    if (medicine_name !== undefined) med.medicine_name = medicine_name;
    if (quantity !== undefined) {
      const qty = Number(quantity);
      if (!Number.isFinite(qty) || qty < 0) return res.status(400).json({ error: 'quantity must be >= 0' });
      med.quantity = qty;
    }
    if (dose !== undefined) med.dose = dose;

    await med.save();
    res.json(med);
  } catch (err) {
    console.error('Error updating medicine:', err);
    res.status(500).json({ error: 'Error updating medicine' });
  }
});

module.exports = router;
