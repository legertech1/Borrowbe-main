const { primaryDB: db } = require("../../db");
const { Payment } = require("../models/Payment");
const { Balance } = require("../models/Balance"); // Assuming Balance is exported from this path
const { createHash, verifyHash } = require("./processHashes"); // Assuming these utilities are defined here
const errors = require("./errors.json");
module.exports = async function processBalanceTransaction(
  payment,
  user,
  country,
  retries = 0
) {
  const session = await db.startSession();
  session.startTransaction();
  try {
    const balance = await Balance.findOne({ user, country }).session(session);

    if (!retries) {
      if (
        !balance ||
        !verifyHash(balance._doc) ||
        balance.user.toString() != payment.user.toString() ||
        payment.balance
      ) {
        throw new Error(errors["unexpected-error"]);
      }
    }
    if (payment.type === "internal" && balance.balance < payment.amount) {
      throw new Error(errors["insufficient-funds"]);
    }
    if (payment.type === "internal") {
      balance.balance -= payment.amount;
    } else {
      balance.balance += payment.amount;
    }

    payment.balance = balance._id;
    payment.hash = createHash(payment._doc);
    balance.balance = balance.balance.toFixed(2);
    balance.hash = createHash(balance._doc);

    await payment.save({ session });

    await balance.save({ session });
    const res = await session.commitTransaction();
    if (res.ok) {
      session.endSession();
      console.log("transaction completed");
      return balance;
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.log(9, Number(retries) < 5);
    if (error.code && error.code == "112" && retries < 5) {
      console.log(10);
      return await processBalanceTransaction(
        payment,
        user,
        country,
        (retries || 0) + 1
      );
    }

    console.error("Transaction aborted due to an error:", error);
    throw error;
  }
};
