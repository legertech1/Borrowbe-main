const { primaryDB: db } = require("../../db");
const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  current: { type: Number, required: true, default: 0 },
});

module.exports = db.model("Counter", counterSchema);
