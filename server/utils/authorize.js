const jwt = require("jsonwebtoken");
const { User } = require("../models/User");
const errors = require("./errors.json");
const memo = require("../memo");
module.exports = async function authorize(req, res, next) {
  //check if token exists
  const token = req?.cookies?.auth || req?.headers["mobile-token"]; // get token from cookie or header

  if (!token)
    return res.status(400).send({ error: errors["no-token-provided"] });
  //verify token
  let verified;
  try {
    verified = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).send({ error: errors["invalid-token"] });
  }
  if (!verified)
    return res.status(401).send({ error: errors["invalid-token"] });

  //find user
  const user = await User.findOne({ _id: verified.id });
  if (!user) return res.status(401).send({ error: errors["user-not-found"] });

  //set user on request
  req.user = user;
  if (!memo.check(user._id)) {
    memo.setActive(user._id);
  }
  next();
};
