const schedule = require("node-schedule");
const { Ad } = require("../models/Ad");
const { createHash, verifyHash } = require("../utils/processHashes");
const generateID = require("../utils/generateID");
const { EjectedAd } = require("../models/EjectedAd");
const sendNotification = require("../utils/sendNotification");
const { sendFCMNotification } = require("../utils/sendNotification");
const memo = require("../memo");
const { User } = require("../models/User");
const { Statistics } = require("../models/AdStatistics");
const getCartAndTotal = require("../utils/getCartAndTotal");
const createListingMeta = require("../utils/createListingMeta");
const { Balance } = require("../models/Balance");
const { Payment } = require("../models/Payment");
const { Category } = require("../models/Category");
const { Analytics } = require("../models/Analytics");
const countUserAds = require("../utils/countUserAds");
const dayConstant = 1000 * 60 * 60 * 24;
const errors = require("../utils/errors.json");
const processTransactions = require("../utils/processTransactions");
const { batchSize } = require("../../serverConstants");
const { updateOne } = require("../models/Counter");

let state = {};
let toCount = {};
const test = {
  assignCustomerIDs: async () => {
    console.log("start");
    const ads = await Ad.find({});
    ads.forEach(async (ad) => {
      user = await User?.findOne({ _id: ad?.user });
      ad.customerID = user?.customerID;
      if (!user.customerID) console.log(user);
      // console.log(ad);
      await ad.save();
    });
    console.log("done");
  },

  randomMetaUpdater: async () => {
    console.log("update");
    const ads = await Ad.find({});
    let updates = [];
    ads.forEach(async (ad) => {
      if (!ad.meta) return await ad.deleteOne();
      ad.meta.status = "active";
      ad.meta.featured = !Boolean(Math.floor(Math.random() * 4));
      ad.meta.highlighted = !Boolean(Math.floor(Math.random() * 5));
      ad.meta.homepageGallery = !Boolean(Math.floor(Math.random() * 6));

      ad.meta.listingRank =
        Math.random() *
        Math.random() *
        Math.random() *
        Math.random() *
        Math.random() *
        1000000;
      ad.meta.hash = createHash(ad.meta._doc);
      updates.push({
        updateOne: {
          filter: { _id: ad._id },
          update: {
            meta: ad.meta,
            priceHidden: !Boolean(Math.floor(Math.random() * 5)),
          },
        },
      });
    });

    await Ad.bulkWrite(updates);
    console.log("done");
  },
  doubleAds: async () => {
    console.log("doubling");
    try {
      const ads = await Ad.find({});
      ads.forEach(async (ad, i) => {
        delete ad._doc._id;

        const newAd = new Ad({ ...ad._doc, listingID: await generateID("A") });
        await newAd.save();
        if (i == ads.length - 1) console.log("done");
      });
    } catch (err) {
      console.log(err);
    }
  },
};

async function expireAd(ad, returnUpdate = false) {
  // console.log("expiring ad");
  ad.meta.status = "expired";
  ad.meta.highlighted = false;
  ad.meta.featured = false;
  ad.meta.homepageGallery = false;

  sendNotification(
    {
      link: "/profile",
      content: "Your ad with ID " + ad.listingID + " has expired.",
      image: ad.thumbnails[0],
    },
    ad.user
  );
  sendFCMNotification(req.user.deviceTokens, {
    title: "Ad Expired",
    body: "Your ad with ID " + ad.listingID + " has expired.",
  });
  if (ad.config.recurring) {
    sendNotification(
      {
        link: "/profile",
        content:
          "Auto-relist has been turned off for your ad with ID " + ad.listingID,
        image: ad.thumbnails[0],
      },
      ad.user
    );
    sendFCMNotification(req.user.deviceTokens, {
      title: "Auto-relist Off",
      body:
        "Auto-relist has been turned off for your ad with ID " + ad.listingID,
    });
  }

  ad.config.recurring = false;
  ad.meta.hash = createHash(ad.meta._doc);
  ad.config.hash = createHash(ad.config);
  if (returnUpdate) {
    toCount[ad.user] = true;
    return {
      updateOne: {
        filter: { _id: ad._id },
        update: { meta: ad.meta, config: ad.config },
      },
    };
  } else {
    await ad.save();
    countUserAds(ad.user, Ad, User);
  }
}

async function useRecurring(ad) {
  // console.log("recurring op");
  let user;
  if (state[ad.user]) user = state[ad.user];
  else {
    user = await User.findOne({ _id: ad.user });
    state[ad.user] = user;
  }
  if (!user) return await expireAd(ad, true);

  const [total, cart] = await getCartAndTotal(
    ad?.config?.next,
    ad.meta.category,
    user,
    true
  );
  const category = await Category.findOne({ name: ad.meta.category });
  if (!category) return expireAd(ad);
  if (ad.meta.status == "paused") {
    return await expireAd(ad, true);
  }

  const payment = new Payment({
    amount: total,
    user: user._id,
    cart: { ...cart, total },
    type: "internal",
    country: ad.meta.country,
    currency: ad.meta.country + "D",
    transactionID: await generateID("T"),
    billingInfo: {
      name: user.firstName + " " + user.lastname,
      email: user.email,
      address: null,
    },
    description: "Auto-relist Ad",
    ads: [ad._id],
  });

  processTransactions.queue(user._id, ad.meta.country, {
    payment,
    onSuccess: async function () {
      ad.meta = createListingMeta(category, payment, {
        subCategory: ad.meta.subCategory,
        youtube: ad.meta.youtube,
        website: ad.meta.website,
      });
      ad.config = {
        ...ad.config,
        current: ad.config.next,
        next: ad.config.next,
      };
      ad.meta.hash = createHash(ad.meta._doc);
      ad.config.hash = createHash(ad.config);
      await ad.save();
      sendNotification(
        {
          link: "/profile",
          content:
            "Your ad with ID " +
            ad.listingID +
            " has been relisted automatically. An amount of $" +
            total +
            " has been deducted from your Borrowbe balance.",
          image: ad.thumbnails[0],
        },
        ad.user
      );
      sendFCMNotification(req.user.deviceTokens, {
        title: "Ad Relisted",
        body:
          "Your ad with ID " +
          ad.listingID +
          " has been relisted automatically. An amount of $" +
          total +
          " has been deducted from your Borrowbe balance.",
      });
    },
    onFailure: async function () {
      sendNotification(
        {
          link: "/profile",
          content:
            "Your ad with ID " +
            ad.listingID +
            " could not be automatically relisted due to an error.",
          image: ad.thumbnails[0],
        },
        ad.user
      );
      sendFCMNotification(req.user.deviceTokens, {
        title: "Auto-relist Failed",
        body:
          "Your ad with ID " +
          ad.listingID +
          " could not be automatically relisted due to an error.",
      });
      return expireAd(ad);
    },
  });
  return null;
}

async function updateAd(ad, today) {
  if (!ad) return null;
  try {
    if (!verifyHash(ad.meta._doc)) {
      const ejectedAd = new EjectedAd({
        data: { ...ad._doc },
        reason: "invalid meta hash",
      });
      ejectedAd.save();
      ad.deleteOne();
      return null;
    }
    if (!verifyHash(ad.config)) {
      const ejectedAd = new EjectedAd({
        data: { ...ad._doc },
        reason: "invalid config hash",
      });
      ejectedAd.save();
      ad.deleteOne();
      return null;
    }
    if (!verifyHash(ad.location)) {
      const ejectedAd = new EjectedAd({
        data: { ...ad._doc },
        reason: "invalid location hash",
      });
      ejectedAd.save();
      ad.deleteOne();
      return null;
    }

    const _initialised = new Date(ad.meta.initialised);
    _initialised.setHours(0, 0, 0, 0);
    const initialised = _initialised.getTime();

    if (initialised + ad.meta.duration * dayConstant <= today) {
      if (ad.config.recurring) return await useRecurring(ad);
      return await expireAd(ad);
    }

    const featured =
      Number(ad?.config?.current?.addOns?.featured?.days || 0) +
      Number(ad?.config?.current?.package?.item?.featured || 0);
    const highlighted =
      Number(ad?.config?.current?.addOns?.highlighted?.days || 0) +
      Number(ad?.config?.current?.package?.item?.highlighted || 0);
    const homepageGallery =
      Number(ad?.config?.current?.addOns?.homepageGallery?.days || 0) +
      Number(ad?.config?.current?.package?.item?.homepageGallery || 0);
    const bumpUpFrequency = ad?.config?.current?.addOns?.bumpUp?.frequency || 0;

    if (ad.meta.featured && initialised + featured * dayConstant <= today) {
      ad.meta.featured = false;
    }
    if (
      ad.meta.highlighted &&
      initialised + highlighted * dayConstant <= today
    ) {
      ad.meta.highlighted = false;
    }
    if (
      ad.meta.homepageGallery &&
      initialised + homepageGallery * dayConstant <= today
    ) {
      ad.meta.homepageGallery = false;
    }
    if (((today - initialised) / dayConstant) % bumpUpFrequency === 0) {
      ad.meta.listingRank = Date.now();
    }

    ad.meta.hash = createHash(ad.meta._doc);
    return {
      updateOne: {
        filter: { _id: ad._id },
        update: { meta: ad.meta },
      },
    };
  } catch (err) {
    console.log(err);
  }
}

async function updateStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  if (!(await Analytics.findOne({ date: today })))
    await Analytics.create({
      date: today,
      visits: 0,
      searches: 0,
      searchArr: [],
    });
  await await Statistics.updateMany(
    {},
    {
      $unset: {
        ["clicks.byDate." +
        thirtyDaysAgo.toLocaleDateString().replaceAll("/", "-")]: "",
        ["impressions.byDate." +
        thirtyDaysAgo.toLocaleDateString().replaceAll("/", "-")]: "",
      },
      $set: {
        ["clicks.byDate." + today.toLocaleDateString().replaceAll("/", "-")]: 0,
        ["impressions.byDate." +
        today.toLocaleDateString().replaceAll("/", "-")]: 0,
      },
    }
  );
}

async function processBatch(batch, today) {
  // Process each document and filter out any null results
  const operations = await Promise.all(batch.map((ad) => updateAd(ad, today)));
  const validOperations = operations.filter((op) => op != null);

  if (validOperations.length > 0) {
    await Ad.bulkWrite(validOperations);
  } else {
    console.log("No valid operations to process");
  }
}

async function updateAds() {
  console.log("processing documents");
  const _today = new Date();
  _today.setHours(0, 0, 0, 0);
  const today = _today.getTime();
  const cursor = Ad.find().cursor();
  let batch = [];

  cursor
    .eachAsync(async (doc) => {
      batch.push(doc);
      if (batch.length >= batchSize) {
        await processBatch(batch, today);
        batch = [];
      }
    })
    .then(async () => {
      // Process any remaining documents in the last batch
      if (batch.length > 0) {
        await processBatch(batch);
      }
      console.log("All documents processed and updated");
      state = {};
      Object.keys(toCount).forEach((i) => countUserAds(i, Ad, User));
      toCount = {};
    })
    .catch((err) => {
      console.error("Error processing documents:", err);
      state = {};
      Object.keys(toCount).forEach((i) => countUserAds(i, Ad, User));
      toCount = {};
    });
}

async function updateAnalytics(data, tries = 0) {
  let counts = {};

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // If data is not provided, get and clear memo counts
    if (!data) {
      counts = memo.getCounts(); // You were missing this assignment
      memo.clearCounts();
    } else {
      counts = data;
    }

    // Perform the update
    await Analytics.findOneAndUpdate(
      { date: today },
      {
        $inc: {
          visits: counts.visits || 0,
          searches: counts.searches.length || 0, // This will count the number of searches
        },
        $push: { searchArr: { $each: counts.searches || [] } }, // Ensure to push an array, default to empty if not provided
      }
    );

    console.log("Analytics updated successfully");
  } catch (err) {
    console.error("Error updating analytics:", err);
    if (tries < 3) {
      await updateAnalytics(counts, tries + 1);
    }
  }
}
// schedule.scheduleJob("0 0 0 * * *", updateAds);
schedule.scheduleJob("0 0 0 * * *", updateStats);
schedule.scheduleJob("*/30 * * * *", () => {
  memo.clear();
  memo.clearVerificationCodes();
});
schedule.scheduleJob("*/2 * * * *", () => {
  memo.clearUsers();
});
schedule.scheduleJob("*/5 * * * *", () => {
  updateAnalytics();
});
// updateStats();
