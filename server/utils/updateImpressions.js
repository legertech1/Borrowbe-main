const { Statistics } = require("../models/AdStatistics");

module.exports = async function updateImpressions(record, results, userId) {
  const toupdate = [];

  if (!record.impressions) record.impressions = {};
  results.forEach((listing) => {
    if (!record.impressions[listing._id]) {
      record.impressions[listing._id] = 1;
      if (userId == listing.user) return;
      toupdate.push(listing._id);
    }
  });

  const today = new Date();

  const key = "impressions.byDate." + today.toISOString().split("T")[0];
  await Statistics.updateMany(
    { ad: { $in: toupdate } },
    {
      $inc: {
        "impressions.total": 1,
        [key]: 1,
      },
    }
  );
};
