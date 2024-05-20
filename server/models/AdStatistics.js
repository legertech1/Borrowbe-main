const { secondaryDB: db } = require("../../db");
const mongoose = require("mongoose");

const statisticsSchema = new mongoose.Schema(
  {
    ad: { type: mongoose.Types.ObjectId, required: true },
    listingID: { type: String, required: true },
    user: { type: mongoose.Types.ObjectId, required: true },
    clicks: {
      byDate: { type: Map, of: Number },
    },
    impressions: {
      byDate: { type: Map, of: Number },
    },
  },
  { timestamps: true, versionKey: false }
);

module.exports = { Statistics: db.model("Ad_Statistics", statisticsSchema) };
