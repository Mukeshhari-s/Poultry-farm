const express = require("express");
const router = express.Router();
const Medicine = require("../models/Medicine");
const Flock = require("../models/Flock");

// GET active batch numbers
router.get("/batches", async (req, res) => {
  try {
    const batches = await Flock.findAll({
      where: { status: "active" },
      attributes: ["batch_no"]
    });
    res.json(batches);
  } catch (err) {
    res.status(500).send(err);
  }
});

// ADD medicine
router.post("/", async (req, res) => {
  try {
    const { batch_no, date, medicine_name, quantity, dose } = req.body;

    // Save to DB
    await Medicine.create({ batch_no, date, medicine_name, quantity, dose });

    res.json({ message: "Medicine Added Successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error saving medicine");
  }
});

// GET all medicine data
router.get("/", async (req, res) => {
  try {
    const data = await Medicine.findAll({ order: [["date", "DESC"]] });
    res.json(data);
  } catch (err) {
    res.status(500).send(err);
  }
});

module.exports = router;
