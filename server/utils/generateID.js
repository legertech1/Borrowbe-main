const Counter = require("../models/Counter");

module.exports = async function generateID(name) {
  try {
    let counter = String(
      (
        await Counter.findOneAndUpdate(
          { name },
          { $inc: { current: 1 } },
          { new: true, upsert: true }
        )
      ).current
    );

    while (counter.length < 8) {
      counter = "0" + counter;
    }
    return name + counter;
  } catch (err) {
    console.log(error);
  }
};
