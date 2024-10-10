const { primaryDB: db } = require("../../db");
const mongoose = require("mongoose");
const statusValidator = require("../utils/statusValidator");
const termValidator = require("../utils/termValidator");
const inputTypeValidator = require("../utils/inputTypeValidator");
const { defaultCategoryPricing } = require("../../serverConstants");
const verifyAccess = require("../utils/verifyAccess");

const packageSchema = new mongoose.Schema(
  {
    price: { type: Number, required: true, default: 20 },
    freeAds: { type: Number, required: true, default: 2 },
    images: { type: Number, required: true, default: 12 },
    featured: { type: Number, required: true, default: 0 },
    highlighted: { type: Number, required: true, default: 0 },
    homepageGallery: { type: Number, required: true, default: 0 },
  },
  { _id: false, versionKey: false }
);
const addOnsSchema = new mongoose.Schema(
  {
    bumpUp: {
      type: [{ price: Number, frequency: Number }],
      default: [{ price: 5, frequency: 14 }],
    },
    highlighted: {
      type: [{ price: Number, days: Number }],
      default: [{ price: 10, days: 7 }],
    },
    featured: {
      type: [{ price: Number, days: Number }],
      default: [{ price: 5, days: 7 }],
    },
    homepageGallery: {
      type: [{ price: Number, days: Number }],
      default: [{ price: 20, days: 7 }],
    },
  },
  { _id: false, versionKey: false }
);
const extrasSchema = new mongoose.Schema(
  {
    website: {
      type: {
        price: { type: Number, required: true, default: 5 },
      },
    },
    youtube: {
      type: {
        price: { type: Number, required: true, default: 5 },
      },
    },
    business: {
      type: {
        price: { type: Number, required: true, default: 100 },
      },
    },
  },
  { _id: false, versionKey: false }
);

const ruleDefaults = {
  adDuration: 30,

  minPrice: 1,

  maxPrice: 100000,

  maxAds: 10,

  minAdTerm: "day",
};

const rulesSchema = new mongoose.Schema(
  {
    adDuration: {
      type: Number,
      required: true,
      default: 30,
    },

    minPrice: {
      type: Number,
      default: 1,
      required: true,
    },
    maxPrice: {
      type: Number,
      default: 100000,
      required: true,
    },
    maxAds: {
      type: Number,
      default: 10,
      required: true,
    },
    minAdTerm: {
      type: String,

      validate: {
        validator: termValidator.validator,
        message: termValidator.message,
      },

      default: "day",
      required: true,
    },
  },
  { _id: false, versionKey: false }
);

const fieldSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    inputType: {
      type: String,
      default: "text",
      required: true,
      validate: {
        validator: inputTypeValidator.validator,
        message: inputTypeValidator.message,
      },
    },
    required: {
      type: Boolean,
      required: true,
      default: true,
    },
    info: {
      type: String,
    },
    placeholder: { type: String },
    options: [{ type: String }],
  },
  { timestamps: true }
);

const subCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    fields: {
      type: [
        {
          type: fieldSchema,
        },
      ],
      default: [],
    },
    rules: {
      type: rulesSchema,
      required: true,
      default: {},
    },
    extraRules: {
      type: Object,
    },
    status: {
      type: String,
      validate: {
        validator: statusValidator.validator,
        message: statusValidator.message,
      },
      default: "active",
      required: true,
    },
  },
  { timestamps: true }
);

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    pricing: {
      type: {
        Basic: { type: packageSchema, required: true },
        Standard: { type: packageSchema, required: true },
        Premium: { type: packageSchema, required: true },
        AddOns: { type: addOnsSchema, required: true },
        Extras: { type: extrasSchema, required: true },
      },
      required: true,
      default: defaultCategoryPricing,
    },
    num: Number,
    fields: {
      type: [
        {
          type: fieldSchema,
        },
      ],
      default: [],
    },
    subCategories: [
      {
        type: subCategorySchema,
        default: [],
      },
    ],
    rules: {
      type: rulesSchema,
      required: true,
      default: ruleDefaults,
    },
    status: {
      type: String,
      validate: {
        validator: statusValidator.validator,
        message: statusValidator.message,
      },
      default: "active",
      required: true,
    },
    icon: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

categorySchema.pre(["find", "findOne"], function (next) {
  const user = this.getOptions()?.user;
  if (!user) return next();
  if (verifyAccess(user, this.model.collection.name, "read")) {
    return next();
  } else throw new Error("Access Denied");
});

// Pre-save hook
categorySchema.pre("save", function (next) {
  const user = this.options?.user;
  if (!user) throw new Error("Access Denied");
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

// Pre-remove hook
categorySchema.pre("remove", function (next) {
  const user = this.options?.user;

  if (!user) {
    throw new Error("Access Denied");
  }

  if (verifyAccess(user, this.constructor.collection.name, "delete")) {
    return next();
  } else {
    throw new Error("Access Denied");
  }
});

// Pre-updateOne hook
categorySchema.pre(
  ["updateOne", "updateMany", "findOneAndUpdate"],
  function (next) {
    const user = this.getOptions()?.user;

    if (!user) {
      throw new Error("Access Denied");
    }

    if (verifyAccess(user, this.model.collection.name, "update")) {
      return next();
    } else {
      throw new Error("Access Denied");
    }
  }
);

// Pre-deleteOne hook
categorySchema.pre(
  ["deleteOne", "deleteMany", "findOneAndDelete"],
  function (next) {
    const user = this.getOptions()?.user;

    if (verifyAccess(user, this.model.collection.name, "delete")) {
      return next();
    } else {
      throw new Error("Access Denied");
    }
  }
);

module.exports = {
  Category: db.model("Category", categorySchema),
  categorySchema,
  subCategorySchema,
  fieldSchema,
  ruleDefaults,
};
