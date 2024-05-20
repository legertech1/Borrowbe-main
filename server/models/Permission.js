const { primaryDB: db } = require("../../db");
const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema(
  {
    user: {
      type: String,
      required: true,
      unique: true,
    },
    hash: {
      type: String,
      required: true,
    },
    permissions: {
      type: Array,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Permission = db.model("Permission", permissionSchema);

module.exports = {
  Permission,
  permissionSchema,
};
