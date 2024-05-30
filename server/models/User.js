const { primaryDB: db } = require("../../db");
const mongoose = require("mongoose");
const { locationSchema } = require("./Location");
const {
  defaultNotificationConfig,
  defaultEmailConfig,
} = require("../../serverConstants");

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
    required: true,
  },
  token: {
    type: String,
    required: true,
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

const configSchema = new mongoose.Schema({
  notificationConfig: { type: Object, required: true },
  emailConfig: { type: Object, required: true },
  billingAddresses: {
    CA: [addressSchema],
    US: [addressSchema],
  },
});

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
  },
  {
    timestamps: true,
  }
);

const User = db.model("User", userSchema);
module.exports = {
  User,
  userSchema,
  infoSchema,
  businessInfoSchema,
};
