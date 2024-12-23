const { User } = require("../models/User");
const { Ad } = require("../models/Ad");
const { Statistics } = require("../models/AdStatistics");

const express = require("express");
const bcrypt = require("bcrypt");

const router = new express.Router();
const errors = require("../utils/errors.json");
const createAvatar = require("../utils/createAvatar");
const authorize = require("../utils/authorize");
const { uploadImage, deleteImage } = require("../AWS");
const memo = require("../memo");
const createConnectionId = require("../utils/createConnectionId");
const { Balance } = require("../models/Balance");
const { createHash } = require("../utils/processHashes");
const createVerificationCode = require("../utils/createVerificationCode");
const { Chat } = require("../models/Chat");
const { Notification } = require("../models/Notifications");
const sendMail = require("../utils/sendmail");
const createEmailHtml = require("../utils/createEmailHtml");
const createZendeskTick = require("../utils/zendesk");
router.get("/init", function (req, res) {
  if (!req.cookies.connection_id) {
    createConnectionId(res, req.cookies.exclude);
  }

  res.send({ acknowledged: true });
});
router.post("/contact-us", async (req, res) => {
  try {
    const {
      adIdAccountId,
      name,
      email,
      contactReason,
      description,
      subject: sub,
    } = req.body;

    if (!name || !email || !sub || !contactReason)
      return res
        .status(400)
        .send("Incorrect or insufficient information.please try again");
    const subject = "New Query: Contact us form";
    const to = "support@borrowbe.com";
    const html = `
    <div>
            <p>
                <strong>Name:&nbsp;&nbsp;</strong>
                <span>${name}</span>
            </p>
            <p>
                <strong>Email:&nbsp;&nbsp;</strong>
                <span>${email}</span>
            </p>
            <p>
                <strong>Subject:&nbsp;&nbsp;</strong>
                <span>${sub}</span>
            </p>
            <p>
                <strong>Contact Reason:&nbsp;&nbsp;</strong>
                <span>${contactReason}</span>
            </p><p>
                <strong>Description:&nbsp;&nbsp;</strong>
                <span>${description}</span>
            </p>
            <p>
                <strong>Ad/Account ID:&nbsp;&nbsp;</strong>
                <span>${adIdAccountId}</span>
            </p>
    </div>
    `;
    sendMail({ to, subject, html });
    sendMail({
      to: email,
      subject: "Your query has been received at Borrowbe.",
      html: createEmailHtml({
        heading: "Your query has been received at Borrowbe.",
        content: `<p>Dear ${name.split(" ")[0]},</p>
        <p>Thank you for reaching out to BorrowBe Support!</p>
        <p>We have successfully received your query with subject: ${sub}.</p> 
        <p>Our team is reviewing your request and will get back to you as soon as possible.</p>
        <p>While we work on addressing your query, here are a few resources that might help: https://borrowbe.com/faq</p>
        <p>We appreciate your patience and will do our best to respond promptly.</p>
        <p>Best regards,<br/> The BorrowBe Support Team<p>`,
      }),
    });
    createZendeskTick({ subject: sub, html, name, email });

    res.json({ data: "request submitted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: "Error submit query" });
  }
});

router.get("/get-stats", authorize, async (req, res) => {
  const ads = await Ad.find({
    user: req.user._id,
    "meta.category": req.query.category || /.*/,
    "meta.country": req.country,
  }).lean();
  const stats = await Statistics.find({
    ad: { $in: ads.map((ad) => ad._id) },
  }).lean();

  const keys = getPast30Days();

  const map = {
    impressions: {},
    clicks: {},
    ctr: {},
  };

  keys.forEach((key, i) => {
    stats.forEach((stat) => {
      if (!map.impressions[key]) map.impressions[key] = 0;
      map.impressions[key] += stat.impressions.byDate[key] || 0;
      if (!map.clicks[key]) map.clicks[key] = 0;
      map.clicks[key] += stat.clicks.byDate[key] || 0;
    });
    map.ctr[key] = (map.clicks[key] / map.impressions[key]) * 100 || 0;
  });
  res.send(map);
});
router.get("/balance", authorize, async (req, res) => {
  const balance = await Balance.findOne({
    user: req.user._id,
    country: req.country,
    currency: req.country + "D",
  });

  if (!balance && ["US", "CA"].includes(req.country)) {
    const _balance = new Balance({
      amount: 0,
      user: req.user._id,
      country: req.country,
      currency: req.country + "D",
    });
    _balance.hash = createHash(_balance._doc);
    await _balance.save();
    return res.send(_balance);
  }
  if (!balance) return res.status(404).send(errors["resourse-not-found"]);

  return res.send(balance);
});
router.get("/:id", async (req, res) => {
  const user = await User.findOne(
    { _id: req.params.id },
    { password: 0 }
  ).lean();

  if (!user) return res.status(404).send(errors["user-not-found"]);
  return res.send({
    ...user,
    data: { postedAds: { total: user?.data?.postedAds?.total } },
  });
});

router.use(authorize);
router.get("/get-status/:id", async (req, res) => {
  try {
    return res.send({ active: memo.check(req.params.id) });
  } catch (err) {
    console.log(err);
    res.status(500).send(errors["unexpected-error"]);
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (id != req.user._id)
      return res.status(401).send({ error: errors["unauthorized"] });
    const body = req.body;

    const user = await User.findOne({ _id: id });
    if (!body.image) {
      body.image = await uploadImage(
        createAvatar(body.firstName + " " + body.lastName)
      );
      deleteImage(user?.image);
    } else if (!body?.image?.includes("https://")) {
      body.image = await uploadImage(body.image);
      deleteImage(user?.image);
    }

    const data = await User.findOneAndUpdate({ _id: id }, body, {
      new: true,
    });

    res.send(data);
  } catch (err) {
    console.log(err);
  }
});

router.put("/update-business-info/:id", async (req, res) => {
  const id = req.params.id;
  if (id != req.user._id)
    return res.status(401).send({ error: errors["unauthorized"] });
  let logo = req.user.BusinessInfo?.LOGO || "";

  if (logo != req.body.LOGO && req.body.LOGO) {
    logo = await uploadImage(req.body.LOGO);
    deleteImage(req.user.BusinessInfo?.LOGO);
  } else if (!req.body.LOGO) {
    logo = "";
    deleteImage(req.user.BusinessInfo?.LOGO);
  }

  const user = await User.findOneAndUpdate(
    { _id: req.user._id },
    {
      BusinessInfo: {
        ...req.body,
        LOGO: logo,
      },
    },
    { new: true }
  );
  return res.send(user.BusinessInfo);
});

router.post("/create-verification-code", async (req, res) => {
  const { subject, email } = req.body;
  if (!subject || !email) return res.status(400).send("Insufficient data");

  const code = memo.getVerificationCode(req.user._id);
  if (email != req.user?.email && subject != "to verify your new email")
    return res.status(401).send("This email does not match your account");
  else if (subject == "to verify your new email") {
    const user = await User?.findOne({ email });
    if (user)
      return res
        .status(403)
        .send("This email is already connected to another account");
  }
  if (code[subject]?.expiresAt > Date.now())
    return res
      .status(401)
      .send(
        "Please wait for " +
          Math.floor((code[subject]?.expiresAt - Date.now()) / 1000 / 60) +
          " minutes and " +
          Math.floor(((code[subject]?.expiresAt - Date.now()) / 1000) % 60) +
          " seconds before retrying"
      );
  createVerificationCode(req.user, subject, email);

  res.send("Verification code sent Successfully");
});

router.post("/create-password", async (req, res) => {
  const { code, password, email } = req.body;
  const vc = memo.getVerificationCode(req.user._id)["to create your password"];
  if (!vc) return res.status(401).send("Unauthorised");
  if (code != vc.code || vc.expiresAt < Date.now())
    return res
      .status(400)
      .send("Incorrect verification code. please try again.");
  if (!password) return res.status(400).send("incorrect details");
  if (vc.email != email) return res.status(401).send("Unauthorised");

  const hash = await bcrypt.hash(password, 12);
  req.user.password = hash;
  await req.user?.save();
  memo.deleteVerificationCode(req.user?._id);
  res.send("Password created successfully");
});
router.post("/delete-account", async (req, res) => {
  const { code, password, email } = req.body;
  const vc = memo.getVerificationCode(req.user._id)["to delete your account"];
  if (!vc) return res.status(401).send("Unauthorised");
  if (code != vc.code || vc.expiresAt < Date.now())
    return res
      .status(400)
      .send("Incorrect verification code. please try again.");
  if (!password) return res.status(400).send("incorrect details");
  if (vc.email != email) return res.status(401).send("Unauthorised");
  await Ad.deleteMany({ user: req.user._id });
  await Notification.deleteOne({ user: req.user._id });
  await Chat.deleteMany({ participants: { $in: [req.user._id] } });
  await Balance.deleteMany({ user: req.user._id });
  await User.deleteOne({ _id: req.user._id });

  res.clearCookie("auth");
  res.send("Account deleted successfully");
});
router.post("/change-password", async (req, res) => {
  const { code, password, email } = req.body;
  const vc = memo.getVerificationCode(req.user._id)["to change your password"];
  console.log(vc);
  if (!vc) return res.status(401).send("Unauthorised");
  if (code != vc.code || vc.expiresAt < Date.now())
    return res
      .status(400)
      .send("Incorrect verification code. please try again.");
  if (!password) return res.status(400).send("incorrect details");
  const isCorrectPass = await bcrypt.compare(password, req.user.password);
  if (isCorrectPass)
    return res
      .status(400)
      .send("New password cannot be the same as the old password.");
  if (vc.email != email) return res.status(401).send("Unauthorised");
  if (await bcrypt.compare(password, req.user.password)) {
    return res
      .status(400)
      .send("New password cant be the same as the old password.");
  }
  const hash = await bcrypt.hash(password, 12);
  req.user.password = hash;
  await req.user?.save();
  memo.deleteVerificationCode(req.user?._id);
  res.send("Password changed successfully");
});

router.post("/change-email", async (req, res) => {
  const { code1, email1, code2, email2, password } = req.body;
  let vc = memo.getVerificationCode(req.user._id)["to change your email"];
  if (!vc) return res.status(401).send("Unauthorised");
  if (code1 != vc.code || vc.expiresAt < Date.now())
    return res
      .status(400)
      .send("Incorrect verification code. please try again.");
  if (vc.email != email1) return res.status(401).send("Unauthorised");
  vc = memo.getVerificationCode(req.user._id)["to verify your new email"];
  if (!vc) return res.status(401).send("Unauthorised");
  if (code2 != vc.code || vc.expiresAt < Date.now())
    return res
      .status(400)
      .send("Incorrect verification code. please try again.");
  if (vc.email != email2) return res.status(401).send("Unauthorised");
  if (!password) return res.status(400).send("incorrect details");
  const isCorrectPass = await bcrypt.compare(password, req.user.password);
  if (!isCorrectPass) return res.status(401).send("Incorrect Password");
  if (req.user?.email != email1)
    return res.status(400).send("incorrect details");
  req.user.email = email2;
  await req.user?.save();
  res.send("email changed successfully");
});

router.post("/update-config", async (req, res) => {
  try {
    const config = req.body;
    delete config._id;

    await User.findOneAndUpdate({ _id: req.user._id }, { config });
    return res.status(200).send("ok");
  } catch (err) {
    console.log(err);
  }
});

router.post("/add-billing-address", async (req, res) => {
  const address = req.body;
  if (
    !address ||
    !address.line1 ||
    !address.city ||
    !address.state ||
    !address.postal_code
  )
    return res.status(400).send("Bad request");
  if (req.user.config.billingAddresses[req.country].length >= 5)
    return res.status(401).send("Maximum number of saved addresses present.");

  req.user.config.billingAddresses[req.country].push(address);
  await req.user.save();
  res.send("Address saved.");
});
router.post("/remove-billing-address", async (req, res) => {
  await User.updateOne(
    { _id: req.user._id },
    {
      $pull: {
        "config.billingAddresses.CA": req.body,
        "config.billingAddresses.US": req.body,
      },
    }
  );
  res.send("Address deleted.");
});

// Save device token
router.post("/save-device-token", async (req, res) => {
  try {
    const userId = req.user._id;
    const { token, deviceUID } = req.body;

    if (!token || !deviceUID) {
      return res.status(400).send("Bad request");
    }

    const filter = { _id: userId, "deviceTokens.deviceUID": deviceUID };
    const update = {
      $set: { "deviceTokens.$.token": token },
    };
    const options = { new: true };

    // First try to update an existing device token
    let result = await User.findOneAndUpdate(filter, update, options);

    if (!result) {
      // If no document is found, add a new device token entry
      result = await User.findOneAndUpdate(
        { _id: userId },
        { $push: { deviceTokens: { deviceUID, token } } },
        { upsert: true, new: true }
      );
    }

    console.log("Device token upserted:", result);
    res.send("Device token saved successfully");
  } catch (error) {
    console.log("Error saving device token:", error);
    res.status(500).send("Error saving device token");
  }
});

// Remove device token
router.post("/remove-device-token", async (req, res) => {
  const userId = req.user._id;
  const { deviceUID } = req.body;
  // remove deviceUID and its token
  const result = await User.updateOne(
    { _id: userId },
    { $pull: { deviceTokens: { deviceUID } } }
  );
  console.log("Device token removed:", result);
  res.send("Device token removed successfully");
});

module.exports = router;

function getPast30Days() {
  const dates = [];
  const today = new Date();

  for (let i = 0; i < 30; i++) {
    const pastDate = new Date(today);
    pastDate.setDate(today.getDate() - i);
    dates.push(pastDate.toISOString().split("T")[0]);
  }

  return dates;
}
