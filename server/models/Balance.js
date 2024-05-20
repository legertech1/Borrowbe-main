const { primaryDB: db } = require("../../db");
const mongoose = require("mongoose");
const countryValidator = require("../utils/countryValidator");
const currencyValidator = require("../utils/currencyValidator");

const balanceSchema = new mongoose.Schema(
  {
    balance: {
      type: Number,
      default: 0,
      required: true,
      validate: {
        validator: (v) => v >= 0,
        message: "Balance cannot be negative",
      },
    },
    user: { type: mongoose.Types.ObjectId, required: true },
    hash: { type: String },
    country: {
      type: String,
      required: true,
      validate: {
        validator: countryValidator.validator,
        message: countryValidator.message,
      },
    },
    currency: {
      type: String,
      required: true,
      validate: {
        validator: currencyValidator.validator,
        message: currencyValidator.message,
      },
    },
  },
  { versionKey: false, timestamps: true }
);

module.exports = {
  Balance: db.model("Balance", balanceSchema),
  balanceSchema,
};
