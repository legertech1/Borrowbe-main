const { Ad } = require("../models/Ad");
const { User } = require("../models/User");
const express = require("express");
const router = new express.Router();
const errors = require("../utils/errors.json");
const authorize = require("../utils/authorize");
const generateID = require("../utils/generateID");
const jwt = require("jsonwebtoken");
const memo = require("../memo");
const createConnectionId = require("../utils/createConnectionId");
const { Payment } = require("../models/Payment");
const bcrypt = require("bcrypt");
const { createHash, verifyHash } = require("../utils/processHashes");
const { Category } = require("../models/Category");
const search = require("../utils/search");
const { uploadImage, deleteImage } = require("../AWS");
const sendNotification = require("../utils/sendNotification");
const { sendFCMNotification } = require("../utils/sendNotification");
const sendUpdate = require("../utils/sendUpdate");
const updateImpressions = require("../utils/updateImpressions");
const updateClick = require("../utils/updateClick");
const createListingMeta = require("../utils/createListingMeta");
const getCartAndTotal = require("../utils/getCartAndTotal");
const verifyCoordinates = require("../utils/verifyCoordinates");
const countUserAds = require("../utils/countUserAds");

router.get("/info/:id", async (req, res) => {
  const user = await User.findById(req.params.id)
    .select(
      "image firstName lastName nickname createdAt _id email BusinessInfo"
    )
    .lean();
  if (!user) return res.status(404).send(errors["user-not-found"]);
  res.send(user);
});
// fetch single ad
router.get("/ad/:id", async (req, res) => {
  try {
    let record;
    let key;
    let userId;
    try {
      key = jwt.verify(req.cookies.connection_id, process.env.JWT_SECRET);
    } catch (err) {}
    if (key) {
      record = memo.find(key);
      if (!record) {
        record = memo.find(createConnectionId(res, req.cookies.exclude));
      }
    }
    if (req.cookies.auth) {
      try {
        userId = jwt.verify(req.cookies.auth, process.env.JWT_SECRET)?.id;
      } catch (err) {}
    }

    const ad = await Ad.findOne({
      $or: [{ _id: req.params.id }, { listingID: req.params.id }],
    }).lean();
    if (!ad)
      return res.status(404).send({ error: errors["resourse-not-found"] });
    res.send(ad);
    if (req?.user?._id == ad.user) return;
    updateClick(record, ad, userId);
  } catch (err) {
    return res.status(500).send(errors["unexpected-error"]);
  }
});

router.get("/ad-info/:id", async (req, res) => {
  try {
    const ad = await Ad.findOne({
      $or: [{ _id: req.params.id }, { listingID: req.params.id }],
    })
      .select("-images -config -meta")
      .lean();
    if (!ad)
      return res.status(404).send({ error: errors["resourse-not-found"] });
    res.send(ad);
  } catch (err) {
    return res.status(500).send(errors["unexpected-error"]);
  }
});

router.post("/post-ad", authorize, async (req, res) => {
  sendUpdate("post-ad", "1", req.user._id);

  try {
    const paymentToken = req.body.token;

    const ad = req.body.ad;
    if (!req.user) return res.status(401).send(errors["unauthorized"]);
    if (!paymentToken)
      return res.status(401).send(errors["invalid-payment-token"]);
    let verifiedToken = null;
    try {
      verifiedToken = jwt.verify(paymentToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).send(errors["invalid-payment-token"]);
    }

    const payment = await Payment.findOne({ _id: verifiedToken.id });
    if (!payment) return res.status(404).send(errors["transaction-not-found"]);
    if (payment.ads?.length)
      return res.status(401).send({ error: errors["invalid-payment-token"] });
    const category = await Category.findOne({ name: payment.cart.category });
    if (!category) return res.status(400).send(errors["invalid-details"]);
    if (ad.location.components.country.short_name != payment.country)
      return res.status(400).send(errors["invalid-details"]);
    try {
      if (
        !(await verifyCoordinates(
          ad.location.coordinates.lat,
          ad.location.coordinates.long,
          payment.country
        ))
      )
        return res.status(400).send(errors["invalid-details"]);
    } catch (err) {
      return res.status(400).send(errors["invalid-details"]);
    }

    const cart = { ...payment.cart };

    const priceObj = {};
    if (ad.price && !ad.priceHidden) priceObj.price = Number(ad.price || 0);
    if (ad.installments && !ad.priceHidden)
      priceObj.installments = Number(ad.installments || 0);
    if (ad.total && !ad.priceHidden) priceObj.total = Number(ad.total || 0);

    const listingMetaData = createListingMeta(category, payment, req.body.ad);
    sendUpdate("post-ad", "2", req.user._id);
    const listing = new Ad({
      user: req.user._id,
      customerID: req.user?.customerID,
      listingID: await generateID("A"),
      ...ad,
      location: {
        ...ad.location,
        geoPoint: {
          type: "Point",
          coordinates: [
            ad.location.coordinates.long,
            ad.location.coordinates.lat,
          ],
        },
      },
      thumbnails: [
        ...(await Promise.all([...ad.thumbnails.map((i) => uploadImage(i))])),
      ],
      images: [
        ...(await Promise.all([...ad.images.map((i) => uploadImage(i))])),
      ],
      status: "active",
      meta: { ...listingMetaData },
      config: { current: cart, next: payment.cart },

      ...priceObj,
    });

    sendUpdate("post-ad", "3", req.user._id);
    listing.meta.hash = createHash(listing.meta._doc);
    listing.config.hash = createHash(listing.config);
    listing.location.hash = createHash(listing.location);
    if (/borrowbe\.com/i.test(req.user.email)) {
      listing.marked = true;
    }

    await listing.save();

    if (!verifyHash(payment._doc))
      return res.status(400).send(errors["invalid-hash"]);
    payment.ads = [listing._id];
    payment.description = "Post Ad";
    payment.hash = createHash(payment._doc);

    await payment.save();
    sendUpdate("post-ad", "4", req.user._id);
    sendNotification(
      {
        image: listing.thumbnails[0],

        content: "Your ad is Live now!\n Click here to view.",

        link: "/listing/" + listing._id,
      },
      req.user._id
    );

    try {
      sendFCMNotification(req.user.deviceTokens, {
        title: "Your ad is Live now!",
        body: listing.title || "New Ad",
      });
    } catch (err) {
      console.log(err);
    }

    res.send(listing);
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
});

router.post("/relist", authorize, async (req, res) => {
  try {
    const paymentToken = req.body.token;

    const ad = req.body.ad;
    if (!req.user)
      return res.status(401).send({ error: errors["unauthorized"] });
    if (!paymentToken)
      return res.status(401).send({ error: errors["invalid-payment-token"] });
    let verifiedToken = null;
    try {
      verifiedToken = jwt.verify(paymentToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).send({ error: errors["invalid-payment-token"] });
    }

    const payment = await Payment.findOne({ _id: verifiedToken.id });

    if (!payment) return res.status(404).send(errors["transaction-not-found"]);
    if (payment.ads?.length)
      return res.status(401).send({ error: errors["invalid-payment-token"] });
    const category = await Category.findOne({ name: payment.cart.category });
    if (!category) return res.status(400).send(errors["invalid-details"]);
    const listing = await Ad.findOne({ _id: req.body.id });
    if (listing.meta.status != "expired") {
      res.status(400).send("The Ad you're trying to relist is already active.");
    }

    if (listing.meta.status != "expired") {
      res.status(400).send("The Ad you're trying to relist is already active.");
    }

    if (listing.location.components.country.short_name != payment.country)
      return res.status(400).send(errors["invalid-details"]);
    try {
      if (
        !(await verifyCoordinates(
          listing.location.coordinates.lat,
          listing.location.coordinates.long,
          payment.country
        ))
      )
        return res.status(400).send(errors["invalid-details"]);
    } catch (err) {
      return res.status(400).send(errors["invalid-details"]);
    }
    listing.config = {
      ...listing.config,
      current: payment.cart,
      next: payment.cart,
    };
    listing.meta = createListingMeta(category, payment, {
      subCategory: listing.meta.subCategory,
      youtube: listing.meta.youtube,
      website: listing.meta.website,
    });

    listing.meta.hash = createHash(listing.meta._doc);
    listing.config.hash = createHash(listing.config);
    listing.location.hash = createHash(listing.location);

    await listing.save();
    if (!verifyHash(payment._doc))
      return res.status(400).send(errors["invalid-hash"]);
    payment.ads = [listing._id];
    payment.description = "Relist Ad";
    payment.hash = createHash(payment._doc);

    await payment.save();
    sendNotification(
      {
        image: listing.thumbnails[0],
        content: "Your ad is Live now!\n Click here to view.",
        link: "/listing/" + listing._id,
      },
      req.user._id
    );
    sendFCMNotification(req.user.deviceTokens, {
      title: "Your ad is Live now!",
      body: listing.title || "Relisted Ad",
    });

    res.send(listing);
  } catch (err) {
    console.log(err);
  }
});

router.put("/:id", authorize, async (req, res) => {
  const body = req.body;

  if (!req.user) return res.status(401).send({ error: errors["unauthorized"] });

  const ad = await Ad.findOne({
    _id: req.params.id,
    user: req.user._id,
  });
  let imagesToDelete = [];
  if (body.location.components.country.short_name != ad.meta.country)
    return res.status(400).send(errors["invalid-details"]);
  try {
    if (
      !(await verifyCoordinates(
        body.location.coordinates.lat,
        body.location.coordinates.long,
        ad.meta.country
      ))
    )
      return res.status(400).send(errors["invalid-details"]);
  } catch (err) {
    return res.status(400).send(errors["invalid-details"]);
  }

  //delete omitted images
  for (let img of ad.images) {
    if (!req.body.images.includes(img)) {
      imagesToDelete.push(img);
    }
  }
  for (let img of ad.thumbnails) {
    if (!req.body.thumbnails.includes(img)) {
      imagesToDelete.push(img);
    }
  }

  let images = req.body.images;
  let tbs = req.body.thumbnails;
  for (let i = 0; i < images.length; i++) {
    if (images[i].includes("base64")) images[i] = await uploadImage(images[i]);
  }
  for (let i = 0; i < tbs.length; i++) {
    if (tbs[i].includes("base64")) tbs[i] = await uploadImage(tbs[i]);
  }

  const location = body.location
    ? {
        ...body.location,
        geoPoint: {
          type: "Point",
          coordinates: [
            body.location.coordinates.long,
            body.location.coordinates.lat,
          ],
        },
      }
    : ad.location;

  await ad.updateOne({
    $set: {
      ...body,
      images: images,
      thumbnails: tbs,
      user: ad.user,
      meta: ad._doc.meta,
      config: ad._doc.config,
      location: location,
      price: Number(body.price),
    },
  });
  ad.location.hash = createHash(ad.location);

  await ad.save();
  return res.send({ acknowledged: true });
});

router.post("/search", async (req, res) => {
  try {
    let record;
    let userId;
    if (req.body.impressions) {
      let key;

      try {
        key = jwt.verify(req.cookies.connection_id, process.env.JWT_SECRET);
      } catch (err) {}
      if (key) {
        record = memo.find(key);
        if (!record) {
          record = memo.find(createConnectionId(res, req.cookies.exclude));
        }
      }
      if (req.cookies.auth) {
        try {
          userId = jwt.verify(req.cookies.auth, process.env.JWT_SECRET)?.id;
        } catch (err) {}
      }
    }
    const { results, total, page } = await search({
      ...req.body,
      count: req.body.impressions && !req.cookies.exclude ? true : false,
      select: {
        thumbnails: 1,
        _id: 1,
        title: 1,
        description: 1,
        price: 1,
        term: 1,
        location: 1,
        meta: 1,
        listingID: 1,
        user: 1,
        tax: 1,
        config: 1,
        tags: 1,
        createdAt: 1,
        priceHidden: 1,
        installments: 1,
        total: 1,
        type: 1,
      },
      country: req.country,
    });

    res.send({ results, total, page });

    try {
      if (record) await updateImpressions(record, results, userId);
    } catch (err) {
      console.log(err);
    }
  } catch (err) {
    console.log(err);
    return res.status(500).send("Something went wrong.");
  }
});

router.get("/add-to-wishlist/:id", authorize, async (req, res) => {
  let id = req.params.id;
  const user = await User.findOneAndUpdate(
    { _id: req.user._id },
    {
      $push: {
        "data.wishlist": id,
      },
    },

    { new: true }
  );

  res.send(user.data.wishlist);
});

router.get("/remove-from-wishlist/:id", authorize, async (req, res) => {
  let id = req.params.id;
  const user = await User.findOneAndUpdate(
    { _id: req.user._id },
    {
      $pull: {
        "data.wishlist": id,
      },
    },
    { new: true }
  );

  res.send(user.data.wishlist);
});

router.post("/save-search", authorize, async (req, res) => {
  const { query, category } = req.body;
  if (!category || typeof query != "string")
    return res.status(400).send({ error: errors["bad-request"] });
  const user = await User.findOneAndUpdate(
    { _id: req.user._id },
    {
      $push: {
        "data.searches": { query, category },
      },
    },
    { new: true }
  );
  res.send(user.data);
});
router.post("/delete-search", authorize, async (req, res) => {
  const { query, category } = req.body;
  if (!category || typeof query != "string")
    return res.status(400).send({ error: errors["bad-request"] });
  const user = await User.findOneAndUpdate(
    { _id: req.user._id },
    {
      $pull: {
        "data.searches": { query, category },
      },
    },
    { new: true }
  );
  res.send(user.data);
});

router.post("/delete-all-searches", authorize, async (req, res) => {
  const user = await User.findOneAndUpdate(
    { _id: req.user._id },
    {
      $pull: {
        "data.searches": { query: /.*/, category: /.*/ },
      },
    },
    { new: true }
  );
  res.send(user.data);
});

module.exports = router;

router.delete("/:id", authorize, async function (req, res) {
  const ad = await Ad.findOne({ _id: req.params.id });
  if (!ad) return res.status(404).send(errors["resourse-not-found"]);
  const deleted = await Ad.deleteOne({
    _id: req.params.id,
    user: req.user._id,
  });

  res.send(await countUserAds(req.user._id, Ad, User));
});

router.get("/pause/:id", authorize, async (req, res) => {
  const ad = await Ad.findOne({
    _id: req.params.id,
    user: req.user._id,
    "meta.status": "active",
  });
  if (!ad) return res.status("404").send(errors["resourse-not-found"]);
  ad.meta.status = "paused";
  ad.meta.hash = createHash(ad.meta._doc);

  await ad.save();

  return res.send(ad);
});

router.get("/resume/:id", authorize, async (req, res) => {
  const ad = await Ad.findOne({
    _id: req.params.id,
    user: req.user._id,
    "meta.status": "paused",
  });
  if (!ad) return res.status("404").send(errors["resourse-not-found"]);
  ad.meta.status = "active";
  ad.meta.hash = createHash(ad.meta._doc);

  await ad.save();

  return res.send(ad);
});

router.post("/ads-count-data", authorize, async (req, res) => {
  if (req.user._id != req.body.user)
    return res.status(401).send(errors["unauthorized"]);
  const userAds = await Ad.find({
    user: req.user._id,
    "meta.category":
      req.body.category == "All Categories" ? /.*/ : req.body.category,
    "meta.country": req.country,
  });
  const data = {};
  data.All = userAds.length;
  data.Active = userAds.reduce(
    (acc, item) => (item?.meta?.status == "active" ? acc + 1 : acc),
    0
  );
  data.Paused = userAds.reduce(
    (acc, item) => (item?.meta?.status == "paused" ? acc + 1 : acc),
    0
  );
  data.Expired = userAds.reduce(
    (acc, item) => (item?.meta?.status == "expired" ? acc + 1 : acc),
    0
  );
  data.Homepage = userAds.reduce(
    (acc, item) => (item?.meta?.homepageGallery ? acc + 1 : acc),
    0
  );
  data.Featured = userAds.reduce(
    (acc, item) => (item?.meta?.featured ? acc + 1 : acc),
    0
  );
  data.Highlighted = userAds.reduce(
    (acc, item) => (item?.meta?.highlighted ? acc + 1 : acc),
    0
  );
  res.send(data);
});

router.post("/batch", authorize, async (req, res) => {
  if (!req.body.type || !req.body.ids) return;
  let deleted;
  let ads = [];
  if (req.body.type == "delete") {
    await Ad.deleteMany({
      _id: { $in: req.body.ids },
      user: req.user._id,
    });
    deleted = await countUserAds(req.user._id, Ad, User);
  } else if (req.body.type == "pause") {
    ads = await Ad.find({
      _id: { $in: req.body.ids },
      user: req.user._id,
    });
    for (let ad of ads) {
      if (ad.meta.status == "active") {
        ad.meta.status = "paused";
        ad.meta.hash = createHash(ad.meta._doc);

        await ad.save();
      }
    }
  } else if (req.body.type == "resume") {
    ads = await Ad.find({
      _id: { $in: req.body.ids },
      user: req.user._id,
    });
    for (let ad of ads) {
      if (ad.meta.status == "paused") {
        ad.meta.status = "active";
        ad.meta.hash = createHash(ad.meta._doc);
        await ad.save();
      }
    }
  }
  res.send(deleted || ads);
});
router.post("/update-config/:id", authorize, async (req, res) => {
  const ad = await Ad.findOne({ _id: req.params.id, user: req.user._id });
  if (!ad) return res.status(404).send(errors["resourse-not-found"]);
  const [total, cart] = await getCartAndTotal(
    req.body.pricing,
    ad.meta.category,
    req.user
  );
  if (!verifyHash(ad?.config))
    return res.status(403).send(errors["altered-values-detected"]);
  ad.config.next = { ...cart, category: ad.meta.category, total };
  ad.config.hash = createHash(ad.config);

  await ad.save();
  res.send(ad);
});

router.post("/change-recurring-status/:id", authorize, async (req, res) => {
  let password = req.body.password;
  if (!req.user.password)
    return res
      .status(400)
      .send(
        "Please create your password from the settings section and try again."
      );
  const isMatch = await bcrypt.compare(password, req.user.password);
  if (!isMatch) return res.status(403).send(errors["wrong-password"]);

  const ad = await Ad.findOne({ _id: req.params.id, user: req.user._id });
  if (!ad) return res.status(404).send(errors["resourse-not-found"]);
  if (!verifyHash(ad?.config))
    return res.status(403).send(errors["altered-values-detected"]);
  ad.config.recurring = !ad.config.recurring;
  ad.config.hash = createHash(ad.config);

  await ad.save();
  res.send(ad);
});
