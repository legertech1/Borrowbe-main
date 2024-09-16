const { secondaryDB: db } = require("../../db");
const mongoose = require("mongoose");

const permissionsSchema = new mongoose.Schema(
  {
    create: {
      type: Boolean,
      required: true,
      default: false,
    },
    update: {
      type: Boolean,
      required: true,
      default: false,
    },
    read: {
      type: Boolean,
      required: true,
      default: false,
    },
    delete: {
      type: Boolean,
      required: true,
      default: false,
    },
    override: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { versionKey: false, _id: false, timestamps: false }
);

const accessCodeSchema = new mongoose.Schema(
  {
    user: {
      required: true,
      type: mongoose.Types.ObjectId,
    },
    role: {
      required: false,
      type: String,
    },

    collections: {
      required: true,
      default: {},
      type: Map,
      of: permissionsSchema,
    },
    pages: {
      required: true,
      default: {},
      type: Map,
      of: Boolean,
    },
    commands: {
      required: true,
      type: Map,
      of: Boolean,
      default: {},
    },
    hash: {
      type: String,
    },
  },
  { versionKey: false, _id: false, timestamps: false }
);

module.exports = accessCodeSchema;
