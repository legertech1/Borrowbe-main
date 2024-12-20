const { v4: uuid } = require("uuid");
const jwt = require("jsonwebtoken");
const memo = require("../memo");

module.exports = function createConnectionId(res, exclude) {
  const id = uuid();
  const connection_id = jwt.sign(id, process.env.JWT_SECRET);
  memo.insert(id, exclude);
  res.cookie("connection_id", connection_id);
  return id;
};
