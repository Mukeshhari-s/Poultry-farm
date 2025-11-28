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

module.exports = router;
