const { User } = require("../models/User");
module.exports = async function (ids) {
  await User.updateMany({}, { $pull: { "data.wishlist": { $in: ids } } });
};
