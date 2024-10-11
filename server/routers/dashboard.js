const express = require("express");
const router = new express.Router();
const { User } = require("../models/User");
const { DeletedUser } = require("../models/DeletedUser");
const { Ad } = require("../models/Ad");
const memo = require("../memo");
const { Category } = require("../models/Category");
const { Payment } = require("../models/Payment");
const { Analytics } = require("../models/Analytics");
const verifyAccess = require("../utils/verifyAccess");

router.get("/total-users", async (req, res) => {
  if (!verifyAccess(req.user, "users", "read"))
    return res.status(500).send("Access Denied");
  try {
    const count = await User.countDocuments({
      marked: { $ne: true },
    }).setOptions({
      user: req.user,
    });
    res.status(200).send({ count });
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

router.get("/total-ads", async (req, res) => {
  if (!verifyAccess(req.user, "ads", "read"))
    return res.status(500).send("Access Denied");
  try {
    const count = await Ad.countDocuments({
      marked: { $ne: true },
    }).setOptions({ user: req.user });
    res.status(200).send({ count });
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

router.get("/active-users", async (req, res) => {
  if (!verifyAccess(req.user, "users", "read"))
    return res.status(500).send("Access Denied");
  try {
    res.status(200).send({ count: memo.countActiveUsers() });
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

router.get("/active-ads", async (req, res) => {
  if (!verifyAccess(req.user, "ads", "read"))
    return res.status(500).send("Access Denied");
  try {
    const count = await Ad.countDocuments({
      "meta.status": "active",
      marked: { $ne: true },
    }).setOptions({ user: req.user });
    res.status(200).send({ count });
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

router.get("/category-count", async (req, res) => {
  if (!verifyAccess(req.user, "categories", "read"))
    return res.status(500).send("Access Denied");
  try {
    const count = await Category.countDocuments({
      status: "active",
    }).setOptions({ user: req.user });
    res.status(200).send({ count });
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

router.get("/revenue-today", async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0); // Set to the start of the day

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999); // Set to the end of the day

    const payments = await Payment.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
      amount: { $gt: 0 },
      type: "external",
      country: "CA",
    }).setOptions({ user: req.user });
    let revenue = 0;
    for (let i = 0; i < payments.length; i++) {
      revenue += payments[i].amount; // Fixed the variable name to `payments[i].amount`
    }
    res.send({ revenue });
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

router.get("/visits", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const count = await Analytics.findOne({ date: today }).setOptions({
      user: req.user,
    });

    if (!count) {
      return res.status(200).send({ count: 0 }); // Handle case where no document is found
    }

    res.status(200).send({ count: count.visits || 0 });
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

router.get("/searches", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const count = await Analytics.findOne({ date: today }).setOptions({
      user: req.user,
    });

    if (!count) {
      return res.status(200).send({ count: 0 }); // Handle case where no document is found
    }

    res.status(200).send({ count: count.searches || 0 });
  } catch (err) {
    return res.status(500).send(err.message);
  }
});
router.get("/users-gained/:days", async (req, res) => {
  try {
    const today = new Date();
    // today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - Math.min(req.params.days || 7, 60));

    // Fetch users created in the last 30 days
    const users = await User.find({
      createdAt: { $gte: thirtyDaysAgo, $lt: Date.now() },
      marked: { $ne: true },
    }).setOptions({ user: req.user });
    const ads = await Ad.find({
      createdAt: { $gte: thirtyDaysAgo, $lt: Date.now() },
      marked: { $ne: true },
    }).setOptions({ user: req.user });
    // Create an object to store user counts by date
    const userCountByDate = {};

    // Fill in dates with zero if no users were created that day
    for (let i = Math.min(req.params.days || 7, 60); i >= 0; i--) {
      const dateKey = new Date(today);
      dateKey.setDate(today.getDate() - i);
      const formattedDate = dateKey.toISOString().split("T")[0];

      // If the date is not in the object, set it to 0

      userCountByDate[formattedDate] = { users: 0, ads: 0 };
    }
    // Iterate through the fetched users
    users.forEach((user) => {
      const date = user.createdAt.toISOString().split("T")[0]; // Format date as YYYY-MM-DD

      // If the date is not already a key in the object, initialize it

      // Increment the count for the date
      userCountByDate[date].users++;
    });
    ads.forEach((user) => {
      const date = user.createdAt.toISOString().split("T")[0]; // Format date as YYYY-MM-DD

      // If the date is not already a key in the object, initialize it

      // Increment the count for the date
      userCountByDate[date].ads++;
    });

    // Log the result and send it back

    return res.send(userCountByDate);
  } catch (err) {
    console.log(err);
    return res.status(500).send(err.message);
  }
});

router.get("/search-analytics/:days", async (req, res) => {
  try {
    const today = new Date();
    // today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - Math.min(req.params.days || 7, 60));
    const stats = await Analytics.find({
      date: { $gte: thirtyDaysAgo, $lt: Date.now() },
    }).setOptions({ user: req.user });

    const data = {};
    for (let i = Math.min(req.params.days || 7, 60); i >= 0; i--) {
      const dateKey = new Date(today);
      dateKey.setDate(today.getDate() - i);
      const formattedDate = dateKey.toISOString().split("T")[0];

      // If the date is not in the object, set it to 0

      data[formattedDate] = { visits: 0, searches: 0 };
    }

    stats.forEach((stat) => {
      const date = stat.date.toISOString().split("T")[0]; // Format date as YYYY-MM-DD

      // If the date is not already a key in the object, initialize it

      data[date] = {
        visits: Math.max(stat.visits, data[date].visits),
        searches: Math.max(stat.searches, data[date].searches),
      };
    });
    return res.send(data);
  } catch (err) {
    console.log(err);
    return res.status(500).send(err.message);
  }
});
module.exports = router;
