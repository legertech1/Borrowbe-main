const errors = require("./errors.json");
module.exports = (req, res, next) => {
  next();
  // if (!["management", "administrator"].includes(req.user.accountType))
  //   return res.status(401).send({ error: errors["unauthorized"] });
  // else next();
};
