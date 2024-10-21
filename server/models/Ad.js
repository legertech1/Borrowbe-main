const { primaryDB: db } = require("../../db");
const mongoose = require("mongoose");
const { locationSchema } = require("./Location");
const adStatusValidator = require("../utils/adStatusValidator");
const { cartSchema } = require("./Payment");
const deleteFromWishlists = require("../utils/deleteFromWishlists");
const countUserAds = require("../utils/countUserAds");
const { User } = require("./User");
const countryValidator = require("../utils/countryValidator");
const { Statistics } = require("./AdStatistics");
const verifyAccess = require("../utils/verifyAccess");
const metaSchema = new mongoose.Schema(
  {
    featured: { type: Boolean, default: false, required: true },
    highlighted: { type: Boolean, default: false, required: true },
    listingRank: { type: Date, required: true },
    homepageGallery: { type: Boolean, default: false, required: true },
    duration: { type: Number, required: true },
    initialised: { type: Date, required: true },
    hash: { type: String },
    category: { type: String, required: true },
    subCategory: { type: String, required: true },
    status: {
      type: String,
      required: true,
      default: "inactive",
      validate: {
        validator: adStatusValidator.validator,
        message: adStatusValidator.message,
      },
    },
    business: { type: Boolean, required: true, default: false },
    youtube: { type: String },
    website: { type: String },
    country: {
      type: String,
      required: true,
      validate: {
        validator: countryValidator.validator,
        message: countryValidator.message,
      },
    },
  },
  {
    _id: false, // This option disables the automatic creation of _id field for subdocuments
    versionKey: false, // This option disables the automatic creation of __v field for subdocuments
  }
);

const adSchema = new mongoose.Schema(
  {
    listingID: {
      type: String,
      required: true,
      unique: true,
    },
    user: {
      type: mongoose.Types.ObjectId,
      required: true,
    },
    customerID: {
      type: String,
    },
    title: {
      type: String,
    },
    description: {
      type: String,
    },
    priceHidden: {
      type: Boolean,
      default: false,
    },
    price: {
      type: Number,
      required: false,
      min: 0,
      max: 100000000000000,
    },
    installments: {
      type: Number,
      required: false,
      min: 0,
      max: 1000,
    },
    total: {
      type: Number,
      required: false,
      min: 0,
      max: 100000000000000,
    },
    tax: {
      type: String,
      required: true,
      validate: {
        validator: (v) => ["GST", "HST", "TAX", "none"],
        message: "invalid tax value",
      },
    },
    term: {
      type: String,
      validate: {
        validator: (v) => ["Day", "Week", "Month", "Year"],
        message: "invalid term value",
      },
    },
    thumbnails: [String],
    images: [String],
    tags: [String],
    website: String,
    youtube: String,

    extraFields: {
      type: Object,
      required: true,
      default: {},
    },
    location: {
      type: locationSchema,
    },
    showPreciseLocation: Boolean,

    config: {
      current: { type: cartSchema, required: true },
      next: { type: cartSchema, required: true },
      recurring: { type: Boolean, required: true, default: false },
      hash: { type: String },
    },
    meta: { type: metaSchema, required: true },
    marked: { type: Boolean, required: false },
  },
  { timestamps: true }
);
adSchema.pre("save", async function () {
  try {
    if (this.isNew) {
      const today = new Date();

      const key = today.toISOString().split("T")[0];
      const stats = new Statistics({
        ad: this._id,
        listingID: this.listingID,
        user: this.user,

        clicks: { byDate: { [key]: 0 } },
        impressions: { byDate: { [key]: 0 } },
      });
      await stats.save();
    }
    countUserAds(this.user, Ad, User);
  } catch (error) {
    console.error("Error in post-save hook:", error);
  }
});
adSchema.pre(
  "deleteOne",
  { document: true, query: true },
  async function (next) {
    deleteFromWishlists([this._id]);

    await Statistics.deleteOne({ ad: this._id });
    next();
  }
);
adSchema.pre(
  "deleteMany",
  { document: true, query: true },
  async function (next) {
    try {
      const query = this.getQuery();

      const documentsToDelete = await this.model.find(query);
      deleteFromWishlists([...documentsToDelete.map((i) => i._id)]);

      await Statistics.deleteMany({
        ad: { $in: [...documentsToDelete?.map((d) => d._id)] },
      });
      next();
    } catch (error) {
      // Handle error
      console.error("Error:", error);
      next(error);
    }
  }
);
adSchema.pre(["find", "findOne"], function (next) {
  const user = this.getOptions()?.user;
  if (!user) return next();
  if (verifyAccess(user, this.model.collection.name, "read")) {
    return next();
  } else throw new Error("Access Denied");
});
adSchema.pre(["updateMany", "findOneAndUpdate", "updateOne"], function (next) {
  const user = this.getOptions()?.user;
  const update = this.getUpdate();

  if (!user) return next();
  if (
    (update.$set && (update.$set.config || update.$set.meta)) ||
    update.meta ||
    update.config
  ) {
    if (
      verifyAccess(user, this.model.collection.name, "override") &&
      verifyAccess(user, this.model.collection.name, "update")
    ) {
      return next();
    } else throw new Error("Access Denied");
  }

  if (verifyAccess(user, this.model.collection.name, "update")) {
    return next();
  } else {
    throw new Error("Access Denied");
  }
});
adSchema.pre("save", function (next) {
  const user = this.options?.user;
  if (!user) return next();
  if (this.isModified("meta") || this.isModified("config")) {
    if (
      verifyAccess(
        user,
        this.constructor.collection.name,
        "override" &&
          verifyAccess(user, this.constructor.collection.name, "update")
      )
    ) {
      return next();
    } else {
      throw new Error("Access Denied");
    }
  }

  if (
    this.isNew
      ? verifyAccess(user, this.constructor.collection.name, "create")
      : verifyAccess(user, this.constructor.collection.name, "update")
  ) {
    return next();
  } else {
    throw new Error("Access Denied");
  }
});
adSchema.pre("remove", function (next) {
  const user = this.options?.user;

  if (!user) return next();

  if (verifyAccess(user, this.constructor.collection.name, "delete")) {
    return next();
  } else {
    if (!this.isModified("user") && this.user.toString() == user._id.toString())
      return next();
    else throw new Error("Access Denied");
  }
});
adSchema.pre(["deleteMany", "findOneAndDelete", "deleteOne"], function (next) {
  const user = this.getOptions()?.user;

  if (!user) return next();

  if (verifyAccess(user, this.model.collection.name, "delete")) {
    return next();
  } else {
    this.getFilter().user = user._id;
    return next();
  }
});
const Ad = db.model("Ad", adSchema);

module.exports = { Ad, adSchema };
