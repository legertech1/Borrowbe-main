const express = require("express");
const authorize = require("../utils/authorize");
const router = new express.Router();
const secret = process.env.STRIPE_SECRET;
const stripe = require("stripe")(secret);
const { Category } = require("../models/Category");
const jwt = require("jsonwebtoken");
const errors = require("../utils/errors.json");
const { Payment } = require("../models/Payment");
const { createHash, verifyHash } = require("../utils/processHashes");
const { Balance } = require("../models/Balance");
const bcrypt = require("bcrypt");
const getCartAndTotal = require("../utils/getCartAndTotal");
const generateID = require("../utils/generateID");
const processBalanceTransaction = require("../utils/processBalanceTransaction");
const processTransactions = require("../utils/processTransactions");

router.get("/config", (req, res) => {
  res.send({ key: process.env.STRIPE_KEY });
});

router.post("/transactions", authorize, async (req, res) => {
  const { page, type } = req.body;
  const transactions = await Payment.find({
    user: req.user._id,
    country: req.country,
    type,
    amount: { $ne: 0 },
  })
    .sort("-createdAt")
    .skip((page - 1) * 20)
    .limit(20)
    .lean();
  res.send(transactions);
});

router.post("/create-payment-intent", authorize, async (req, res) => {
  try {
    const balance = req.body.balance;
    let total;
    let cart;

    if (!balance)
      [total, cart] = await getCartAndTotal(
        req.body.pricing,
        req.body.category,
        req.user
      );
    else {
      if (total > 1000) return res.status(400).send(errors["amount-too-big"]);
      total = balance;
      // cart = { balance };
    }

    if (Number(total) != 0 && !req.body.billing)
      return res.status(400).send(errors["bad-request"]);
    if (Number(total) == 0 && !balance) {
      const payment = new Payment({
        amount: total,
        user: req.user._id,
        cart: { ...cart, total },
        type: "external",
        country: req.country,
        currency: req.country + "D",
        transactionID: await generateID("T"),
        billingInfo: {
          name: req.user.firstName + " " + (req.user.lastName || ""),
          email: req.user.email,
          address: null,
        },
        description: "Post Free Ad",
      });

      payment.hash = createHash(payment._doc);

      await payment.save();
      const paymentToken = jwt.sign(
        { id: payment._id, user: req.user._id },
        process.env.JWT_SECRET
      );
      return res.send({ token: paymentToken, free: true });
    }

    const customer = await stripe.customers.create({
      name: req.user.firstName + " " + (req.user.lastName || ""),
      email: req.user.email,
      address: {
        line1: req.body.billing.line1,
        postal_code: req.body.billing.postal_code,
        city: req.body.billing.city,
        state: req.body.billing.state,
        country: req.country,
      },
    });

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: "2023-10-16" }
    );

    if (!total) throw new Error(errors["transaction-terminated"]);
    if (!balance && !cart) throw new Error(errors["transaction-terminated"]);
    const paymentIntent = await stripe.paymentIntents.create({
      currency: (req.country + "D").toLowerCase(),
      amount: (total * 100).toFixed(0),
      description: "Digital goods/services from Borrowbe.ca",
      automatic_payment_methods: {
        enabled: true,
      },
      customer: customer.id,
      receipt_email: req.user.email,
    });
    const token = jwt.sign(
      {
        id: paymentIntent.id,
        cart: cart ? { ...cart, total } : null,
        user: req.user._id,
        billingInfo: {
          name: req.user.firstName + " " + (req.user.lastName || ""),
          email: req.user.email,
          address: {
            line1: req.body.billing.line1,
            postal_code: req.body.billing.postal_code,
            city: req.body.billing.city,
            state: req.body.billing.state,
            country: req.country,
          },
        },
      },
      process.env.JWT_SECRET
    );

    res.send({
      clientSecret: paymentIntent.client_secret,
      total,
      token,
      ephemeralKey: ephemeralKey.secret,
      customer: customer.id,
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.post("/confirm-payment", authorize, async (req, res) => {
  let token = null;

  try {
    token = jwt.verify(req.body.token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(403).send(errors["invalid-transaction-token"]);
  }
  if (!token) return res.status(403).send(errors["invalid-transaction-token"]);
  const cart = token.cart;
  if (!req.body.balance && !cart)
    return res.status(403).send(errors["invalid-cart-data"]);
  if (token.user != req.user._id)
    return res.status(403).send(errors["unauthorized"]);

  const intent = await stripe.paymentIntents.retrieve(token.id);

  if (intent.status != "succeeded")
    return res.status(400).send(errors["payment-unsuccessful"]);

  const payment = new Payment({
    amount: (intent.amount / 100).toFixed(2),
    user: req.user._id,
    cart: token.cart || null,
    paymentIntent: intent.id,
    type: "external",
    country: req.country,
    currency: req.country + "D",
    transactionID: await generateID("T"),
    billingInfo: token.billingInfo || {},
    description: req.body.balance ? "Add balance " : "Post Ad",
  });

  payment.hash = createHash(payment._doc);

  if (req.body.balance) {
    let balance;
    try {
      let balance = await processTransactions.exec(
        payment,
        req.user._id,
        req.country
      );
    } catch (err) {
      return res.status(403).send(err.message);
    }

    return res.send("Acknowledged");
    // return res.send(balance);
  }
  await payment.save();
  const paymentToken = jwt.sign(
    { id: payment._id, user: req.user._id },
    process.env.JWT_SECRET
  );
  res.send({ token: paymentToken });
});

router.post("/pay-with-balance", authorize, async (req, res) => {
  let token = null;
  let password = req.body.password;
  if (!req.user.password)
    return res
      .status(400)
      .send(
        "Please create your password from the settings section and try again."
      );
  const isMatch = await bcrypt.compare(password, req.user.password);
  if (!isMatch) return res.status(403).send(errors["wrong-password"]);

  try {
    token = jwt.verify(req.body.token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(403).send(errors["invalid-transaction-token"]);
  }
  if (!token) return res.status(403).send(errors["invalid-transaction-token"]);
  const cart = token.cart;
  if (!cart) return res.status(403).send(errors["invalid-cart-data"]);
  if (token.user != req.user._id)
    return res.status(403).send(errors["unauthorized"]);

  const intent = await stripe.paymentIntents.retrieve(token.id);

  const payment = new Payment({
    amount: (intent.amount / 100).toFixed(2),
    user: req.user._id,
    cart: token.cart,
    type: "internal",
    country: req.country,
    currency: req.country + "D",
    transactionID: await generateID("T"),
    billingInfo: token.billingInfo,
    description: "Post Ad",
  });

  try {
    let balance = await processTransactions.exec(
      payment,
      req.user._id,
      req.country
    );
  } catch (err) {
    return res.status(403).send(err.message);
  }
  const paymentToken = jwt.sign(
    { id: payment._id, user: req.user._id },
    process.env.JWT_SECRET
  );
  res.send({ token: paymentToken });
});
module.exports = router;
