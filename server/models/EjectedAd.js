const { secondaryDB: db } = require("../../db");
const mongoose = require("mongoose");

const ejectedAdSchema = new mongoose.Schema({
  data: {
    type: Object,
  },
  reason: String,
});
const EjectedAd = db.model("Ejected_Ad", ejectedAdSchema);

module.exports = {
  EjectedAd,
};
