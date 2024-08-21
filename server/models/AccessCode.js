const { secondaryDB: db } = require("../../db");
const mongoose = require("mongoose");

const permissions = new mongoose.Schema({
  name: {
    required: true,
    type: String,
  },
  
});
const accessCodeSchema = new mongoose.Schema({
  user: {
    required: true,
    type: mongoose.Types.ObjectId,
  },
  access: {
    required: true,
    default: [],
    type: {},
  },
});
