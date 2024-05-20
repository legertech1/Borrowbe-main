module.exports = async function (userId, Ad, User) {

  try {
    const ads = await Ad.find({
      user: userId,
      "meta.status": { $in: ["active", "paused", "expired"] },
    });
    const total = ads.length;
    const obj = {};

    ads.forEach((ad) => {
      if (!obj[ad.meta.category]) {
        obj[ad.meta.category] = { expired: 0, free: 0, regular: 0 };
      }
      if (ad.meta.status == "expired") obj[ad.meta.category].expired += 1;
      else if (ad?.config?.current?.package?.free)
        obj[ad.meta.category].free += 1;
      else obj[ad.meta.category].regular += 1;
    });
    await User.updateOne(
      { _id: userId },
      { "data.postedAds": { total, ...obj } }
    );
    return { total, ...obj };
  } catch (err) {
    console.log(err);
  }
};
