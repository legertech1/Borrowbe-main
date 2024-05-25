const { Statistics } = require("../models/AdStatistics");
module.exports = async function updateClick(record, listing, userId) {
  if (!record) return;
  try {
    if (!record.clicks) record.clicks = {};
    if (!record.clicks[listing._id]) {
      record.clicks[listing._id] = 1;

      const today = new Date();

      const key = "clicks.byDate." + today.toISOString().split("T")[0];
      if (userId == listing.user) return;
      await Statistics.updateOne(
        { ad: listing._id },
        {
          $inc: {
            "clicks.total": 1,
            [key]: 1,
          },
        }
      );
    }
  } catch (error) {
    console.log("error: ", error);
  }
};
