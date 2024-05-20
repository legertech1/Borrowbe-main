const { secondaryDB: db } = require("../../db");
const mongoose = require("mongoose");

const deletedAdSchema = new mongoose.Schema({
  data: {
    type: Object,
  },
});
const DeletedAd = db.model("Deleted_Ad", deletedAdSchema);

module.exports = {
  DeletedAd,
};
