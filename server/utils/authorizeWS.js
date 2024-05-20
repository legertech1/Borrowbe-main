const cookie = require("cookie");
const jwt = require("jsonwebtoken");
const { User } = require("../models/User");
const errors = require("./errors.json");
const memo = require("../memo");
module.exports = async (socket, next) => {
  let token;

  try {
    token =
      socket.handshake.auth["mobile-token"] ||
      cookie.parse(socket.handshake.headers.cookie).auth;
  } catch (err) {
    return next(new Error(errors["unauthorized"]));
  }

  if (!token) return next(new Error(errors["unauthorized"]));
  //verify token
  let verified;
  try {
    verified = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return next(new Error(errors["unauthorized"]));
  }
  if (!verified) return next(new Error(errors["unauthorized"]));

  //find user
  const user = await User.findOne({ _id: verified.id });
  if (!user) return next(new Error(errors["user-not-found"]));

  //set user on request
  socket.user = user;
  if (!memo.check(user._id)) {
    memo.setActive(user._id);
  }

  next();
};
