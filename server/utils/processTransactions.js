const { primaryDB: db } = require("../../db");
const { Payment } = require("../models/Payment");
const { Balance } = require("../models/Balance"); // Assuming Balance is exported from this path
const { createHash, verifyHash } = require("./processHashes"); // Assuming these utilities are defined here
const errors = require("./errors.json");
const state = {};
const sendUpdate = require("./sendUpdate");

module.exports = {
  exec: async function (payment, user, country, retries = 0) {
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
       
        sendUpdate("balance-updated", balance, user);
        return balance;
      }
    } catch (error) {
      session.inTransaction() && (await session.abortTransaction());
      session.endSession();

      if (error.code && retries < 5) {
        console.log(10);
        return await this.exec(payment, user, country, (retries || 0) + 1);
      }

      console.error("Transaction aborted due to an error:", error);
      throw error;
    }
  },
  queue: function (user, country, { payment, onSuccess, onFailure }) {
    if (!state[user + country]) {
      state[user + country] = [];
      setTimeout(() => {
        this.processQueue(user, country);
      }, 5000);
    }
    state[user + country].push({ payment, onSuccess, onFailure });
    // console.log(state);
  },
  processQueue: async function (user, country, retries) {
    if (!state[user + country] || !state[user + country].length) return;
    const session = await db.startSession({
      maxTransactionTimeMS: 300000,
    });
    await session.startTransaction();
    try {
      const processes = [...state[user + country]];
      const balance = await Balance.findOne({ user, country }).session(session);
      if (!balance || !verifyHash(balance._doc)) {
        await session.abortTransaction();
        session.endSession();
        return processes.forEach((p) =>
          p.onFailure(errors["altered-values-detected"])
        );
      }

      for (let process of processes) {
        let { payment } = process;
        if (
          payment?.user?.toString() != balance.user.toString() ||
          payment.balance
        ) {
          process.error = errors["unexpected-error"];
          continue;
        }
        if (
          payment.type == "internal" &&
          balance.balance - payment.amount < 0
        ) {
          process.error = errors["insufficient-funds"];
          continue;
        }
        if (payment.type === "internal") {
          balance.balance -= payment.amount;
        } else {
          balance.balance += payment.amount;
        }
        payment.balance = balance._id;
        payment.hash = createHash(payment._doc);
        balance.balance = balance.balance.toFixed(2);
        await payment.save({ session });
      }
      balance.hash = createHash(balance._doc);
      await balance.save({});
      const res = await session.commitTransaction();
      if (res.ok) {
        session.endSession();

        processes.forEach((p) => {
          if (p.error) p.onFailure(p.error);
          else p.onSuccess();

          state[user + country].shift();
        });
        if (!state[user + country].length) delete state[user + country];
        sendUpdate("balance-updated", balance, user);
      }
    } catch (error) {
      session.inTransaction() && (await session.abortTransaction());
      session.endSession();

      if (error.code && retries < 5) {
       
        return this.processQueue(user, country, retries + 1);
      }

      console.error("Transaction aborted due to an error:", error);
      throw error;
    }
  },
};
