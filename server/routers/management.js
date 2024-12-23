/////only for development purposes ///////////////////////////////////////////
const express = require("express");
const router = new express.Router();
const { User } = require("../models/User");
const { DeletedUser } = require("../models/DeletedUser");
const { Ad } = require("../models/Ad");
const { DeletedAd } = require("../models/DeletedAd");
const bcrypt = require("bcrypt");
const { createHash, verifyHash } = require("../utils/processHashes");
const runCommand = require("../utils/runCommand");
const authorize = require("../utils/authorize");
const createAvatar = require("../utils/createAvatar");
const generateID = require("../utils/generateID");
const { uploadImage } = require("../AWS");

router.post("/command", async (req, res) => {
  res.send(await runCommand(req.body.command, req.body));
});
router.use(authorize);
router.post("/create-user", async (req, res) => {
  try {
    //get the fields
    const { firstName, lastName, email, password } = req.body;

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
    const avatar = createAvatar(firstName + " " + lastName);

    //create user
    const user = new User({
      customerID: await generateID("C"),
      email,
      firstName,
      lastName,
      password: hash,
      image: await uploadImage(avatar),
      verified: true,
    });
    user.options = { user: req.user };
    await user.save();
    res.send(user);
  } catch (err) {
    console.log(err);
    res.status(500).send(err.message);
  }
});
router.post("/update-access-code/:id", async (req, res) => {
  try {
    const accessCode = req.body.accessCode;
    await User.findOneAndUpdate(
      { _id: req.params.id },
      {
        accessCode: {
          user: req.params.id,
          ...accessCode,
          hash: createHash(accessCode),
        },
      }
    ).setOptions({ user: req.user });
    res.send("ok");
  } catch (err) {
    console.log(err);
    res.status(500).send(err.message);
  }
});
router.delete("/:id", async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id).setOptions({
      user: req.user,
    });
    res.send({ info: "acknowledged" });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.post("/search", async (req, res) => {
  try {
    const { filters, count, collectionName, page, sort } = req.body;

    const limit = count || 10;
    const pageNumber = page || 1;
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
      .sort(sort || { _id: -1 })
      .skip((pageNumber - 1) * limit)
      .limit(limit)
      .select(
        "-image -images -thumbnails -description -location -extraFields -password"
      )
      .setOptions({
        user: req.user,
      });

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
  } catch (err) {
    res.status(500).send(err.message);
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

    const items = await collection.find({ _id: { $in: ids } }).setOptions({
      user: req.user,
    });

    // if (deletedCollection) {
    //   let r1 = await deletedCollection
    //     .insertMany(items.map((item) => item.toObject()))
    //     .setOptions({
    //       user: req.user,
    //     });
    // }

    let r2 = await collection.deleteMany({ _id: { $in: ids } }).setOptions({
      user: req.user,
    });

    res.send({ info: "acknowledged" });
  } catch (err) {
    res.status(500).send(err.message);
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

    let r = await collection
      .updateMany({ _id: { $in: ids } }, updates)
      .setOptions({
        user: req.user,
      });
    const docs = await collection.find({ _id: { $in: ids } }).setOptions({
      user: req.user,
    });
    res.send(docs);
  } catch (err) {
    console.log(err);
    res.status(500).send(err.message);
  }
});

router.get("/user/:id", async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id }).setOptions({
      user: req.user,
    });
    res.send(user);
  } catch (err) {
    console.log(err);
    res.status(500).send(err.message);
  }
});

router.get("/ads/:userId", async (req, res) => {
  try {
    const ads = await Ad.find({ user: req.params.userId })
      .select(
        "-image -images -thumbnails -description -location -extraFields -password"
      )
      .setOptions({
        user: req.user,
      });
    res.send(ads);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// fetch ad by id
router.get("/ad/:id", async (req, res) => {
  try {
    const ad = await Ad.findOne({ _id: req.params.id }).setOptions({
      user: req.user,
    });
    res.send(ad);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// get user favorite ads
router.get("/favorites/:userId", async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.userId }).setOptions({
      user: req.user,
    });
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    if (!user?.data?.wishlist || !user?.data?.wishlist?.length) {
      return res.send([]);
    }
    const ads = await Ad.find({ _id: { $in: user.data.wishlist } })
      .select(
        "-image -images -thumbnails -description -location -extraFields -password"
      )
      .setOptions({
        user: req.user,
      });

    res.send(ads);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.get("/mark/:collection/:id", async (req, res) => {
  try {
    let collection = null;
    switch (req.params.collection) {
      case "Ad":
        collection = Ad;
        break;
      case "User":
        collection = User;
        break;
      default:
        return res.status(400).send("Invalid type");
    }
    await collection
      ?.findOneAndUpdate({ _id: req.params.id }, { marked: true })
      .setOptions({ user: req.user });
    res.send({ info: "acknowledged" });
  } catch (err) {
    res.status(500).send(err.message);
  }
});
router.get("/unmark/:collection/:id", async (req, res) => {
  try {
    let collection = null;
    switch (req.params.collection) {
      case "Ad":
        collection = Ad;
        break;
      case "User":
        collection = User;
        break;
      default:
        return res.status(400).send("Invalid type");
    }
    await collection
      ?.findOneAndUpdate({ _id: req.params.id }, { marked: false })
      .setOptions({ user: req.user });
    res.send({ info: "acknowledged" });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
