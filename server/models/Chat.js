const { secondaryDB: db } = require("../../db");
const mongoose = require("mongoose");
const verifyAccess = require("../utils/verifyAccess");
const { findOneAndDelete } = require("./Counter");

const messageSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Types.ObjectId,
      required: true,
    },
    to: {
      type: mongoose.Types.ObjectId,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    read: { type: Boolean, default: false, required: true },
    type: { type: String, required: true, default: "text" },
  },
  { timestamps: true }
);

const chatSchema = new mongoose.Schema(
  {
    participants: [mongoose.Types.ObjectId],
    messages: [messageSchema],
    blockedBy: [mongoose.Types.ObjectId],
    deletedBy: [mongoose.Types.ObjectId],
    ad: mongoose.Types.ObjectId,
  },
  { timestamps: true }
);

// Pre-find hook
chatSchema.pre("find", function (next) {
  const user = this.getOptions().user;
  const key = this.getOptions().key;

  if (verifyAccess(user, this.model.collection.name, "read")) {
    return next();
  } else {
    this.getFilter().participants = { $in: [user._id] };
    next();
  }
});

// Pre-save hook
chatSchema.pre("save", function (next) {
  const user = this.options?.user;
  const key = this.options?.key;
  if (!user) return next();

  if (!user) return next(new Error("Access Denied"));

  if (this.participants.includes(user?._id)) return next();

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
chatSchema.pre("remove", function (next) {
  const user = this.options?.user;
  const key = this.options?.key;
  if (!user) return next();

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
chatSchema.pre(["updateOne", "findOneAndUpdate"], function (next) {
  const user = this.getOptions().user;
  const key = this.getOptions().key;
  if (!user) return next();

  if (!user) {
    throw new Error("Access Denied");
  }
  if (verifyAccess(user, this.model.collection.name, "update")) {
    return next();
  } else {
    this.getFilter().participants = { $in: [user._id] };
    return next();
  }
});

// Pre-deleteOne hook
chatSchema.pre(
  ["deleteOne", "findOneAndDelete", "deleteMany"],
  function (next) {
    const user = this.getOptions().user;
    const key = this.getOptions().key;
    if (!user) return next();

    if (verifyAccess(user, this.model.collection.name, "delete")) {
      return next();
    } else {
      throw new Error("Access Denied");
    }
  }
);

// Pre-updateMany hook
chatSchema.pre("updateMany", function (next) {
  const user = this.getOptions().user;
  const key = this.getOptions().key;
  if (!user) return next();

  if (verifyAccess(user, this.model.collection.name, "update")) {
    return next();
  } else {
    throw new Error("Access Denied");
  }
});

module.exports = {
  Chat: db.model("Chat", chatSchema),
  chatSchema,
  messageSchema,
};
