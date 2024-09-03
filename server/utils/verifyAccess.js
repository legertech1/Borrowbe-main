const { verifyHash } = require("./processHashes");

module.exports = function (user, name, action) {
  if (!user) return false;

  try {
    if (
      !user?.accessCode ||
      user?._id.toString() != user?.accessCode?.user.toString() ||
      !user?.accessCode?.collections?.get(name)[action] ||
      !verifyHash(user?.accessCode)
    )
      return false;
    else return true;
  } catch (err) {
    return false;
  }
};
