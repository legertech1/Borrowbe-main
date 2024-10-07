const { primaryDB: db } = require("../../db");
const mongoose = require("mongoose");
const { locationSchema } = require("./Location");
const {
  defaultNotificationConfig,
  defaultEmailConfig,
} = require("../../serverConstants");
const accessCodeSchema = require("./AccessCode");
const verifyAccess = require("../utils/verifyAccess");

const businessInfoSchema = new mongoose.Schema({
  LOGO: String,
  name: String,
  address: String,
  youtube: String,
  website: String,
  phone: String,
  email: String,
});
const addressSchema = new mongoose.Schema({
  line1: String,
  city: String,
  state: String,
  postal_code: String,
});
const infoSchema = new mongoose.Schema({
  phone: {
    type: String,
  },
  city: {
    type: String,
  },
  province: {
    type: String,
  },

  nickname: {
    type: String,
  },
});

const DeviceTokenSchema = new mongoose.Schema({
  deviceUID: {
    type: String,
    required: false,
  },
  token: {
    type: String,
    required: false,
  },
});

const dataSchema = new mongoose.Schema(
  {
    postedAds: { type: Object, required: true },
    wishlist: [
      {
        type: mongoose.Types.ObjectId,
      },
    ],

    searches: [{ type: Object }],
  },
  { timestamps: false, _id: false, versionKey: false }
);

const configSchema = new mongoose.Schema(
  {
    notificationConfig: { type: Object, required: true },
    emailConfig: { type: Object, required: true },
    billingAddresses: {
      CA: [addressSchema],
      US: [addressSchema],
    },
  },
  { versionKey: false }
);

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    customerID: {
      type: String,
      required: true,
      unique: true,
    },
    lastName: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    verified: { type: Boolean, required: true, default: false },
    authenticationRisk: { type: Number, required: true, default: 0 },
    accountLocked: { type: Boolean, required: true, default: false },
    image: { type: String, required: true },

    info: { type: infoSchema, default: {} },
    data: {
      type: dataSchema,
      required: true,
      default: {
        wishlist: [],
        searches: [],
        postedAds: { totalAds: 0 },
      },
    },
    BusinessInfo: { type: businessInfoSchema, default: {} },
    deviceTokens: [DeviceTokenSchema],
    config: {
      type: configSchema,
      required: true,
      default: {
        notificationConfig: defaultNotificationConfig,
        emailConfig: defaultEmailConfig,
        billingAddresses: {
          CA: [],
          US: [],
        },
      },
    },
    accessCode: {
      type: accessCodeSchema,
      required: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);
// Pre-find hook
userSchema.pre(["find", "findOne"], function (next) {
  const user = this.getOptions().user;
  if (!user) return next();
  if (verifyAccess(user, this.model.collection.name, "read")) {
    return next();
  } else {
    throw new Error("Access Denied");
  }
});

// Pre-save hook
userSchema.pre("save", function (next) {
  const user = this.options?.user;

  if (this.isModified("accessCode")) {
    if (verifyAccess(user, this.constructor.collection.name, "override")) {
      next();
    } else {
      throw new Error("Access Denied");
    }
  }
  if (!user) return next();

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
userSchema.pre("remove", function (next) {
  const user = this.options?.user;
  const key = this.options?.key;
  if (!user) return next();

  if (verifyAccess(user, this.constructor.collection.name, "delete")) {
    return next();
  } else {
    throw new Error("Access Denied");
  }
});

// Pre-updateOne hook
userSchema.pre(
  ["updateOne", "findOneAndUpdate", "updateMany"],
  function (next) {
    const user = this.getOptions().user;

    const update = this.getUpdate();

    const requireOverride =
      (update.$set && update.$set["accessCode"]) || update.accessCode;
    if (requireOverride) {
      if (verifyAccess(user, this.model.collection.name, "override")) {
        next();
      } else {
        throw new Error("Access Denied");
      }
    }
    if (!user) return next();

    if (verifyAccess(user, this.model.collection.name, "update")) {
      return next();
    } else {
      throw new Error("Access Denied");
    }
  }
);

// Pre-deleteOne hook

// Pre-updateMany hook

// Pre-deleteMany hook
userSchema.pre(
  ["deleteMany", "deleteOne", "findOneAndDelete"],
  function (next) {
    const user = this.getOptions().user;

    if (!user) return next();

    if (verifyAccess(user, this.model.collection.name, "delete")) {
      return next();
    } else {
      throw new Error("Access Denied");
    }
  }
);
const User = db.model("User", userSchema);
module.exports = {
  User,
  userSchema,
  infoSchema,
  businessInfoSchema,
};
