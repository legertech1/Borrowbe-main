const { primaryDB: db } = require("../../db");
const mongoose = require("mongoose");
const statusValidator = require("../utils/statusValidator");
const archive = mongoose.Schema({
  data: {
    type: Object,
    required: true,
  },
  user: {
    name: { type: String, required: true },
    id: { type: mongoose.Types.ObjectId, required: true },
  },
});

const categoryArchiveSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    
  },

  archive: [{ type: archive, required: true, default: [] }],
  current: { type: Object, required: true },
});

module.exports = {
  CategoryArchive: db.model("CategoryArchive", categoryArchiveSchema),
  categoryArchiveSchema,
};
