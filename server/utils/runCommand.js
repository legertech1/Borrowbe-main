const { listCollections, primaryDB, secondaryDB } = require("../../db");
const { User } = require("../models/User");
const { createHash } = require("./processHashes");

module.exports = async function (comm, args) {
  try {
    if (!commands[comm]) return { type: "error", message: "Command not found" };
    return await commands[comm](args);
  } catch (err) {
    console.log(err);
    return { type: "error", message: err.message };
  }
};

const commands = {
  make_admin: async function ({ key, user }) {
    if (key != process.env.ROOT_PASSKEY) throw new Error("Invalid passkey");
    const doc = await User.findOne({ _id: user });
    const primaryDbCollections = await listCollections(primaryDB);
    const secondaryDbCollections = await listCollections(secondaryDB);
    const allCollections = [...primaryDbCollections, ...secondaryDbCollections];
    doc.accessCode = {
      user,
      collections: new Map(),
      role: "admin",
      pages: {
        Ads: true,
        Dashboard: true,
        Users: true,
        Categories: true,
        Permissions: true,
        UserDetails: true,
        AdDetails: true,
      },
    };
    allCollections.forEach((c) => {
      doc.accessCode.collections.set(c, {
        read: true,
        create: true,
        update: true,
        delete: true,
        override: true,
      });
    });

    doc.accessCode.hash = createHash(doc.accessCode);
    doc.options = { key: process.env.ROOT_PASSKEY };

    await doc.save();
    return {
      message: "User has been given admin privilages successfully",
      type: "info",
    };
  },
};
