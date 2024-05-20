const { primaryDB: db } = require("../../db");
const mongoose = require("mongoose");
const currencyValidator = require("../utils/currencyValidator");
const countryValidator = require("../utils/countryValidator");

const cartSchema = new mongoose.Schema(
  {
    package: {
      name: { type: String, required: true },
      item: {
        price: { type: Number, required: true },
        images: { type: Number, required: true },
        featured: { type: Number, required: true, default: 0 },
        highlighted: { type: Number, required: true, default: 0 },
        homepageGallery: { type: Number, required: true, default: 0 },
      },
      free: { type: Boolean, default: false },
    },
    addOns: {
      bumpUp: { type: Object },
      highlighted: { type: Object },
      featured: { type: Object },
      homepageGallery: { type: Object },
    },
    extras: {
      website: { type: Object },
      youtube: { type: Object },
      business: { type: Object },
    },
    category: { type: String, required: true },
    total: { type: Number, required: true },
  },
  { _id: false, versionKey: false }
);

const paymentSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      validate: {
        validator: (v) => v >= 0,
        message: "Amount cannot be negative",
      },
    },
    type: {
      type: String,
      required: true,
      validate: {
        validator: (v) => ["external", "internal"].includes(v),
        message: "Payment type must be sither internal or external",
      },
    },
    cart: { type: cartSchema },
    paymentIntent: { type: String },
    user: { type: mongoose.Types.ObjectId, required: true },
    ads: [mongoose.Types.ObjectId],
    description: String,
    transactionID: { type: String, required: true, unique: true },
    balance: { type: mongoose.Types.ObjectId },
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
    billingInfo: Object,
  },
  { timestamps: true, versionKey: false }
);

module.exports = {
  Payment: db.model("Payment", paymentSchema),
  paymentSchema,
  cartSchema,
};
