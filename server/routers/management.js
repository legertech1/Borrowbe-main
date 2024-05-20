/////only for development purposes ///////////////////////////////////////////
const express = require("express");
const router = new express.Router();
const { User } = require("../models/User");
const { DeletedUser } = require("../models/DeletedUser");
const { Ad } = require("../models/Ad");
const { DeletedAd } = require("../models/DeletedAd");
const { paginateWithAggregation } = require("../utils/paginateWithAggregation");
const { default: mongoose } = require("mongoose");
const errors = require("../utils/errors.json");
const createAvatar = require("../utils/createAvatar");
const bcrypt = require("bcrypt");
const generateID = require("../utils/generateID");
const { Permission } = require("../models/Permission");
const { createHash, verifyHash } = require("../utils/processHashes");

router.get("/", async (req, res) => {
  const users = await User.find({});
  res.send(users);
});

// get permission by user id
router.get("/permissions/:id", async (req, res) => {
  const id = req.params.id;

  const permission = await Permission.findOne({ user: id });

  if (!permission)
    return res.status(404).send({ error: errors["resourse-not-found"] });
  res.status(200).send(permission);
});

const updateUserPermissions = async (userId, permissions) => {
  let perms = await Permission.findOne({ user: userId });

  if (!perms) {
    perms = new Permission({
      user: userId,
      permissions,
    });
  } else {
    if (
      !verifyHash({ permissions: perms.permissions, user: userId }, perms.hash)
    ) {
      throw new Error("Invalid hash");
    }
    perms.permissions = permissions;
  }

  perms.hash = createHash({ permissions, user: userId });
  await perms.save();
};

// update permission by user id
router.put("/permissions/:id", async (req, res) => {
  const userId = req.params.id;
  const { permissions } = req.body;

  await updateUserPermissions(userId, permissions);

  res.status(200).send({ info: "acknowledged" });
});

router.post("/register-employee", async (req, res) => {
  //get the fields
  const { firstName, lastName, email, password, permissions } = req.body;

  //check if empty
  if (!firstName || !email || !password)
    return res.status(400).send({ error: errors["all-fields-required"] });

  //check if duplicate
  const exists = await User.findOne({ email });
  if (exists)
    return res.status(400).send({ error: errors["user-already-exists"] });

  //hash password
  const hash = await bcrypt.hash(password, 12);

  //create profile picture
  const avatar = Buffer.from(
    createAvatar(firstName + " " + lastName),
    "base64"
  );

  //create user
  const user = new User({
    customerID: await generateID("C"),
    email,
    firstName,
    lastName,
    password: hash,
    verified: true,
    accountType: "user",
    image: {
      data: avatar,
    },
  });

  await user.save();

  if (permissions) {
    const permission = new Permission({
      user: user._id,
      hash: createHash({
        permissions,
        user: user._id,
      }),
      permissions,
    });
    await permission.save();
  }

  //sending response
  res.status(201).send({
    info: "employee created successfully",
  });
});

router.delete("/:id", async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  res.send({ info: "acknowledged" });
});

router.post("/search", async (req, res) => {
  try {
    // await addDummyUsers(200);

    // FIXME: add strong authentication to this route
    // TODO: Only allow admins to access this route

    const { filters, count, collectionName, page } = req.body; // Added 'page' parameter

    const limit = count || 10;
    const pageNumber = page || 1; // Added 'page' parameter

    let collection = null;

    switch (collectionName) {
      case "User":
        collection = User;
        break;
      case "Ad":
        collection = Ad;
        break;
      default:
        return res.status(400).send({ error: "Invalid collection" });
    }

    // Handle pagination for other collections
    const results = await collection
      .find(filters || {})
      .skip((pageNumber - 1) * limit)
      .limit(limit)
      .select(
        "-image -images -thumbnails -description -location -extraFields -password"
      );

    // Get the total count of documents that match the filters
    const totalCount = await collection.countDocuments(filters || {});

    // Calculate the total number of pages
    const totalPages = Math.ceil(totalCount / limit);

    const pagination = {
      totalResults: totalCount,
      totalPages: totalPages,
      currentPage: pageNumber,
    };

    res.send({ data: results, pagination: pagination });
  } catch (error) {
  
    res.status(400).send({ error: "Error searching data" });
  }
});

router.post("/delete-items", async (req, res) => {
  let { ids, collectionName } = req.body;

  if (!ids || !ids.length) {
    return res.status(400).send({ error: "No item ids provided" });
  }

  try {
    let collection;
    let deletedCollection;
    switch (collectionName) {
      case "User":
        collection = User;
        deletedCollection = DeletedUser;
        break;
      case "Ad":
        collection = Ad;
        deletedCollection = DeletedAd;
        break;
      case "Deleted_User":
        collection = DeletedUser;
        break;
      case "Deleted_Ad":
        collection = DeletedAd;
        break;

      default:
        return res.status(400).send({ error: "Invalid collection" });
    }

    if (!collection) {
      return res.status(400).send({ error: "Invalid collection" });
    }

    const items = await collection.find({ _id: { $in: ids } });

    if (deletedCollection) {
      let r1 = await deletedCollection.insertMany(
        items.map((item) => item.toObject())
      );
    }

    let r2 = await collection.deleteMany({ _id: { $in: ids } });

    res.send({ info: "acknowledged" });
  } catch (error) {
    res.status(500).send({ error: "Error deleting items" });
  }
});

router.post("/update-items", async (req, res) => {
  let { ids, collectionName, updates } = req.body;

  if (!ids || !ids.length) {
    return res.status(400).send({ error: "No item ids provided" });
  }

  try {
    let collection;
    switch (collectionName) {
      case "User":
        collection = User;
        break;
      case "Ad":
        collection = Ad;
        break;
      default:
        return res.status(400).send({ error: "Invalid collection" });
    }

    let r = await collection.updateMany({ _id: { $in: ids } }, updates);

    res.send({ info: "acknowledged" });
  } catch (error) {
    res.status(500).send({ error: "Error updating items" });
  }
});

router.get("/user/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-image -images -password"
    );
    res.send(user);
  } catch (error) {
    res.status(500).send({ error: "Error fetching user" });
  }
});

router.get("/ads/:userId", async (req, res) => {
  try {
    const ads = await Ad.find({ user: req.params.userId }).select(
      "-image -images -thumbnails -description -location -extraFields -password"
    );
    res.send(ads);
  } catch (error) {
    res.status(500).send({ error: "Error fetching ads" });
  }
});

// fetch ad by id
router.get("/ad/:id", async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    res.send(ad);
  } catch (error) {
    res.status(500).send({ error: "Error fetching ad" });
  }
});

// get user favorite ads
router.get("/favorites/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    if (!user?.data?.wishlist || !user?.data?.wishlist?.length) {
      return res.send([]);
    }
    const ads = await Ad.find({ _id: { $in: user.data.wishlist } }).select(
      "-image -images -thumbnails -description -location -extraFields -password"
    );

    res.send(ads);
  } catch (error) {
    res.status(500).send({ error: "Error fetching ads" });
  }
});

module.exports = router;
