const { secondaryDB: db } = require("../../db");
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  data: {
    type: Object,
  },
});
const DeletedUser = db.model("Deleted_User", userSchema);

module.exports = {
  DeletedUser,
};
