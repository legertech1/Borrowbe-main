const { primaryDB: db } = require("../../db");
const mongoose = require("mongoose");
const countryValidator = require("../utils/countryValidator");
const currencyValidator = require("../utils/currencyValidator");
const { createHash } = require("../utils/processHashes");
const verifyAccess = require("../utils/verifyAccess");

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

balanceSchema.pre(["findOne", "find"], function (next) {
  const user = this.getOptions().user;

  if (!user) return next();

  if (verifyAccess(user, this.model.collection.name, "read")) {
    next();
  } else {
    this.getFilter().user = user._id;
    next();
  }
});

balanceSchema.pre(
  ["updateOne", "updateMany", "findOneAndUpdate"],
  function (next) {
    const user = this.getOptions().user;

    if (!user) return next();

    if (verifyAccess(user, this.model.collection.name, "update")) {
      next();
    } else throw new Error("Access Denied");
  }
);
balanceSchema.pre(
  ["deleteOne", "deleteMany", "findOneAndDelete"],
  function (next) {
    const user = this.getOptions().user;

    if (!user) throw new Error("Access Denied");
    if (verifyAccess(user, this.model.collection.name, "delete")) {
      next();
    } else throw new Error("Access Denied");
  }
);

balanceSchema.pre("save", function (next) {
  const user = this.options.user;

  if (!user) return next();
  if (
    this.isNew
      ? verifyAccess(user, this.constructor.collection.name, "create")
      : verifyAccess(user, this.constructor.collection.name, "update")
  ) {
    return next();
  }
  throw new Error("Access Denied");
});

balanceSchema.pre("remove", function (next) {
  const user = this.options.user;

  if (!user) return next();
  if (verifyAccess(user, this.constructor.collection.name, "delete")) {
    return next();
  }
  throw new Error("Access Denied");
});
module.exports = {
  Balance: db.model("Balance", balanceSchema),
  balanceSchema,
};
