const mongoose = require("mongoose");
const { secondaryDB: db } = require("../../db");
const analyticsSchema = new mongoose.Schema({
  date: {
    type: Date, // Use Date type for efficient queries
    required: true,
    unique: true,
  },
  searchArr: {
    type: [
      {
        query: String,
        category: String,
        location: mongoose.Schema.Types.Mixed,
      },
    ],
    required: true,
    default: [],
  },
  visits: {
    type: Number,
    required: true,
    default: 0,
  },
  searches: {
    type: Number,
    required: true,
    default: 0,
  },
});

module.exports = {
  Analytics: db.model("Analytics", analyticsSchema),
  analyticsSchema,
};
